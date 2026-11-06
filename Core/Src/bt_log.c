#include "bt_log.h"

#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "usart.h"

#define BT_TX_BUF_SIZE     1024U   /* USART6, 9600 baud  (~1 s of text)   */
#define WIRED_TX_BUF_SIZE  2048U   /* USART1, 115200 baud                 */
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

void HAL_UART_RxCpltCallback(UART_HandleTypeDef *huart)
{
    if (huart->Instance != USART6) {
        return;
    }
    char c = (char)s_rx_byte;
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
