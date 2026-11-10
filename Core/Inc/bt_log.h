#ifndef BT_LOG_H
#define BT_LOG_H

/*
 * Non-blocking log / console.
 *
 *   Bluetooth : USART6 (HC-05 "RatRocket", 9600 8N1) - always on.
 *   Wired     : USART1 (FTDI, 115200)  - optional mirror for bench work.
 *
 * TX: printf-style. The line is formatted in the caller (a few tens of us),
 *     copied into a per-UART ring buffer and sent by the UART TX interrupt.
 *     Callers never wait on the UART. If a ring is full the line is dropped
 *     and counted (BT_Log_DroppedCount / BT_Log_WiredDroppedCount).
 *     Time-critical code (e.g. the 1 kHz control loop) must not call these at
 *     all: push raw samples to a queue and format them in a low-priority task.
 * RX: Bluetooth bytes are collected by the USART6 RX interrupt into lines
 *     terminated by '\r' or '\n'. Poll BT_Log_GetLine() from a task.
 *
 * Call from tasks only (not from ISRs), after the scheduler has started.
 */

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/* Start USART6 reception. Call once after MX_USART6_UART_Init(). */
void BT_Log_Init(void);

/* Formatted output to Bluetooth (+ USART1 if mirrored). End lines with "\r\n". */
void BT_Log_Printf(const char *fmt, ...) __attribute__((format(printf, 1, 2)));

/* Also copy every BT_Log_Printf() line to USART1. Only enable this in modes
 * where nothing else transmits on USART1 (i.e. not in the web-sim mode,
 * whose [TMSG] protocol uses blocking USART1 writes). */
void BT_Log_SetMirrorUart1(bool enable);

/* Print only to USART1 (and only if the mirror is enabled). Used while the
 * HC-05 is in AT mode, where anything sent on USART6 is parsed as a command. */
void BT_Log_Uart1Only(const char *fmt, ...) __attribute__((format(printf, 1, 2)));

/* Copy the next received line (without the terminator) into out.
 * Returns true if a line was available. */
bool BT_Log_GetLine(char *out, size_t out_size);

/* ---- USB-C console (CDC, driverless virtual COM port) ----
 * Output goes to Bluetooth, USART1 (if mirrored) and USB-C at the same time;
 * commands may arrive on Bluetooth or USB-C. Called from usbd_cdc_if.c. */
void BT_Log_UsbRx(const uint8_t *data, uint32_t len);
void BT_Log_UsbPump(void);      /* drain the USB ring; safe to call any time */
void BT_Log_UsbTxDone(void);    /* from the CDC transmit-complete callback   */
bool BT_Log_UsbConnected(void);

uint32_t BT_Log_DroppedCount(void);
uint32_t BT_Log_WiredDroppedCount(void);
uint32_t BT_Log_UsbDroppedCount(void);
uint32_t BT_Log_RxByteCount(void);

#define BT_LOG(fmt, ...) BT_Log_Printf(fmt "\r\n", ##__VA_ARGS__)

#endif /* BT_LOG_H */
