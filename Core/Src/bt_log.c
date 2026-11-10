#include "bt_log.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "usart.h"
#include "usb_device.h"
#include "usbd_cdc_if.h"

#define BT_TX_BUF_SIZE     1024U   /* USART6, 9600 baud  (~1 s of text)   */
#define WIRED_TX_BUF_SIZE  2048U   /* USART1, 115200 baud                 */
#define USB_TX_BUF_SIZE    2048U   /* USB-C CDC, as fast as the host reads */
#define USB_TX_CHUNK       64U     /* one full-speed bulk packet           */
#define BT_RX_LINE_SIZE    48U
#define BT_FMT_BUF_SIZE    160U

/* ---------------- Non-blocking TX channels ----------------
 * Each UART has a ring buffer drained by its TX-complete interrupt.
 * head is advanced only by tasks (inside a critical section); tail/tx_len are
 * advanced by the TX path, which runs either inside a task critical section or
 * in the UART ISR (priority 5, masked by the critical section), so the two
 * never run concurrently. Writers never wait: if a line does not fit it is
 * dropped and counted. */
typedef struct {
    UART_HandleTypeDef *huart;
    uint8_t *buf;
    uint16_t size;
    volatile uint16_t head;
    volatile uint16_t tail;
    volatile uint16_t tx_len;     /* bytes handed to HAL, 0 = idle */
    volatile uint32_t dropped;
} TxChan;

static uint8_t s_bt_buf[BT_TX_BUF_SIZE];
static uint8_t s_wired_buf[WIRED_TX_BUF_SIZE];
static TxChan s_bt    = { .huart = &huart6, .buf = s_bt_buf,    .size = BT_TX_BUF_SIZE };
static TxChan s_wired = { .huart = &huart1, .buf = s_wired_buf, .size = WIRED_TX_BUF_SIZE };

/* ---------------- USB-C console (CDC) ----------------
 * Same contract as the UART channels: never block, drop when full. The ring is
 * drained by BT_Log_UsbPump(), called after every write, from the CDC
 * transmit-complete callback and from BT_Log_GetLine() (polled by the console
 * loops). Nothing is buffered while no host is connected, so a robot running
 * on a powerbank does not fill the ring with text nobody reads. */
static uint8_t s_usb_buf[USB_TX_BUF_SIZE];
static uint8_t s_usb_chunk[USB_TX_CHUNK];   /* stays valid until the IN transfer ends */
static volatile uint16_t s_usb_head, s_usb_tail;
static volatile uint16_t s_usb_busy;        /* bytes handed to the CDC class, 0 = idle */
static volatile uint32_t s_usb_dropped;

extern USBD_HandleTypeDef hUsbDeviceFS;   /* defined in usb_device.c */

static bool usb_ready(void)
{
    return hUsbDeviceFS.dev_state == USBD_STATE_CONFIGURED;
}

/* ---------------- RX line assembly (Bluetooth) ---------------- */
static uint8_t s_rx_byte;
static char s_rx_work[BT_RX_LINE_SIZE];
static uint8_t s_rx_work_len;
static char s_rx_line[BT_RX_LINE_SIZE];
static volatile bool s_rx_line_ready;
static volatile uint32_t s_rx_bytes;

static volatile bool s_mirror_uart1;

/* Must be called with UART interrupts masked (critical section or ISR). */
static void chan_kick(TxChan *c)
{
    if (c->tx_len != 0U || c->head == c->tail) {
        return;
    }
    /* Send the contiguous part; the wrapped remainder goes on the next kick. */
    uint16_t len = (c->head > c->tail) ? (uint16_t)(c->head - c->tail)
                                       : (uint16_t)(c->size - c->tail);
    if (HAL_UART_Transmit_IT(c->huart, &c->buf[c->tail], len) == HAL_OK) {
        c->tx_len = len;
    }
}

static void chan_write(TxChan *c, const uint8_t *data, uint16_t len)
{
    taskENTER_CRITICAL();
    uint16_t used = (uint16_t)((c->head + c->size - c->tail) % c->size);
    uint16_t free_space = (uint16_t)(c->size - 1U - used);
    if (len > free_space) {
        c->dropped++;
    } else {
        for (uint16_t i = 0; i < len; i++) {
            c->buf[c->head] = data[i];
            c->head = (uint16_t)((c->head + 1U) % c->size);
        }
        chan_kick(c);
    }
    taskEXIT_CRITICAL();
}

static void usb_write(const uint8_t *data, uint16_t len)
{
    if (!usb_ready()) {
        return;                      /* no host: nothing to queue, nothing lost */
    }
    uint32_t pri = __get_PRIMASK();
    __disable_irq();
    uint16_t used = (uint16_t)((s_usb_head + USB_TX_BUF_SIZE - s_usb_tail) % USB_TX_BUF_SIZE);
    if (len > (uint16_t)(USB_TX_BUF_SIZE - 1U - used)) {
        s_usb_dropped++;
    } else {
        for (uint16_t i = 0; i < len; i++) {
            s_usb_buf[s_usb_head] = data[i];
            s_usb_head = (uint16_t)((s_usb_head + 1U) % USB_TX_BUF_SIZE);
        }
    }
    __set_PRIMASK(pri);
}

/* Runs from tasks and from the USB interrupt, so the ring is protected with
 * PRIMASK rather than a FreeRTOS critical section (which an ISR must not take).
 * Copies without consuming: the bytes stay in the ring until the CDC class has
 * accepted them, so a busy host costs nothing but a retry. */
void BT_Log_UsbPump(void)
{
    if (!usb_ready()) {
        return;
    }
    uint16_t n = 0;
    uint32_t pri = __get_PRIMASK();
    __disable_irq();
    if (s_usb_busy == 0U && s_usb_head != s_usb_tail) {
        /* Consume and claim in one step. Advancing the tail afterwards would
         * race with the completion interrupt, which pumps again and would
         * re-send the same bytes. */
        while (n < USB_TX_CHUNK && s_usb_tail != s_usb_head) {
            s_usb_chunk[n++] = s_usb_buf[s_usb_tail];
            s_usb_tail = (uint16_t)((s_usb_tail + 1U) % USB_TX_BUF_SIZE);
        }
        s_usb_busy = n;              /* claim: no second pump may start or reuse the chunk */
    }
    __set_PRIMASK(pri);

    if (n == 0U) {
        return;
    }
    if (CDC_Transmit_FS(s_usb_chunk, n) != USBD_OK) {
        s_usb_dropped++;             /* cannot happen while we hold the claim */
        s_usb_busy = 0;
    }
}

/* Called from the CDC transmit-complete callback. */
void BT_Log_UsbTxDone(void)
{
    s_usb_busy = 0;
    BT_Log_UsbPump();
}

static int format(char *buf, size_t size, const char *fmt, va_list args)
{
    int n = vsnprintf(buf, size, fmt, args);
    if (n >= (int)size) {
        n = (int)size - 1;   /* truncated */
    }
    return n;
}

void BT_Log_Init(void)
{
    s_rx_work_len = 0;
    s_rx_line_ready = false;
    HAL_UART_Receive_IT(&huart6, &s_rx_byte, 1);
}

void BT_Log_SetMirrorUart1(bool enable)
{
    s_mirror_uart1 = enable;
}

void BT_Log_Printf(const char *fmt, ...)
{
    char buf[BT_FMT_BUF_SIZE];
    va_list args;
    va_start(args, fmt);
    int n = format(buf, sizeof(buf), fmt, args);
    va_end(args);
    if (n <= 0) {
        return;
    }
    chan_write(&s_bt, (const uint8_t *)buf, (uint16_t)n);
    if (s_mirror_uart1) {
        chan_write(&s_wired, (const uint8_t *)buf, (uint16_t)n);
    }
    usb_write((const uint8_t *)buf, (uint16_t)n);
    BT_Log_UsbPump();
}

void BT_Log_Uart1Only(const char *fmt, ...)
{
    if (!s_mirror_uart1) {
        return;
    }
    char buf[BT_FMT_BUF_SIZE];
    va_list args;
    va_start(args, fmt);
    int n = format(buf, sizeof(buf), fmt, args);
    va_end(args);
    if (n > 0) {
        chan_write(&s_wired, (const uint8_t *)buf, (uint16_t)n);
    }
}

bool BT_Log_GetLine(char *out, size_t out_size)
{
    BT_Log_UsbPump();                /* polled by every console loop */
    if (!s_rx_line_ready || out_size == 0U) {
        return false;
    }
    taskENTER_CRITICAL();
    strncpy(out, s_rx_line, out_size - 1U);
    out[out_size - 1U] = '\0';
    s_rx_line_ready = false;
    taskEXIT_CRITICAL();
    return true;
}

uint32_t BT_Log_DroppedCount(void)      { return s_bt.dropped; }
uint32_t BT_Log_WiredDroppedCount(void) { return s_wired.dropped; }
uint32_t BT_Log_UsbDroppedCount(void)   { return s_usb_dropped; }
bool BT_Log_UsbConnected(void)          { return usb_ready(); }
uint32_t BT_Log_RxByteCount(void)       { return s_rx_bytes; }

/* ---------------- HAL callbacks ---------------- */

void HAL_UART_TxCpltCallback(UART_HandleTypeDef *huart)
{
    TxChan *c = (huart->Instance == USART6) ? &s_bt
              : (huart->Instance == USART1) ? &s_wired
              : NULL;
    if (c == NULL) {
        return;
    }
    c->tail = (uint16_t)((c->tail + c->tx_len) % c->size);
    c->tx_len = 0;
    chan_kick(c);
}

/* One received character. Bluetooth (USART6) and USB-C (CDC) feed the same
 * line buffer, so every command works the same over either link. Both callers
 * are interrupts of equal priority, so they cannot interleave; tasks reading
 * the line do so inside a critical section. */
static void feed_rx_char(char c)
{
    s_rx_bytes++;

    if (c == '\r' || c == '\n') {
        /* Ignore empty lines (e.g. the '\n' of a "\r\n" pair). If the previous
         * line hasn't been consumed yet, the new one is dropped. */
        if (s_rx_work_len > 0U && !s_rx_line_ready) {
            memcpy(s_rx_line, s_rx_work, s_rx_work_len);
            s_rx_line[s_rx_work_len] = '\0';
            s_rx_line_ready = true;
        }
        s_rx_work_len = 0;
    } else if (s_rx_work_len < BT_RX_LINE_SIZE - 1U) {
        s_rx_work[s_rx_work_len++] = c;
    }
}

void BT_Log_UsbRx(const uint8_t *data, uint32_t len)
{
    for (uint32_t i = 0; i < len; i++) {
        feed_rx_char((char)data[i]);
    }
}

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance != USART6) {
        return;
    }
    feed_rx_char((char)s_rx_byte);
    HAL_UART_Receive_IT(&huart6, &s_rx_byte, 1);
}

void HAL_UART_ErrorCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance != USART6) {
        return;
    }
    /* Overrun/noise aborts IT reception; re-arm it so the console stays alive. */
    if (huart->RxState == HAL_UART_STATE_READY) {
        HAL_UART_Receive_IT(&huart6, &s_rx_byte, 1);
    }
}
