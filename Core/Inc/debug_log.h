#ifndef DEBUG_LOG_H
#define DEBUG_LOG_H

#include "usart.h"
#include <string.h>
#include<stdio.h>

/* =========================
   Enable Logs
   ========================= */

#define LOG_ENABLE 1
#define LOG_ENABLE_INFO 0
#define LOG_ENABLE_WARN 0
#define LOG_ENABLE_ERROR 0
#define LOG_ENABLE_TMSG 1

#if LOG_ENABLE
#if LOG_ENABLE_INFO

#define LOG_INFO(fmt, ...)                          \
do {                                                \
    char buffer[100];                               \
    int len = snprintf(buffer, sizeof(buffer),      \
                       "[INFO] " fmt "\r\n",        \
                       ##__VA_ARGS__);             \
    HAL_UART_Transmit(&huart1,                      \
                      (uint8_t*)buffer,             \
                      len,                          \
                      HAL_MAX_DELAY);              \
} while (0)
#else
#define LOG_INFO(fmt, ...)
#endif
#if LOG_ENABLE_WARN
#define LOG_WARN(msg) \
    HAL_UART_Transmit(&huart1, \
    (uint8_t*)"[WARN] " msg "\r\n", \
    sizeof("[WARN] " msg "\r\n") - 1, \
    10)
#else
#define LOG_WARN(msg)
#endif
#if LOG_ENABLE_ERROR
#define LOG_ERROR(msg) \
    HAL_UART_Transmit(&huart1, \
    (uint8_t*)"[ERROR] " msg "\r\n", \
    sizeof("[ERROR] " msg "\r\n") - 1, \
    10)
#else
#define LOG_ERROR(msg)
#endif
#if LOG_ENABLE_TMSG
#define SEND_TMSG(fmt, ...)                          \
do {                                                \
    char buffer[100];                               \
    int len = snprintf(buffer, sizeof(buffer),      \
                       "[TMSG] " fmt "\r\n",        \
                       ##__VA_ARGS__);             \
    HAL_UART_Transmit(&huart1,                      \
                      (uint8_t*)buffer,             \
                      len,                          \
                      HAL_MAX_DELAY);              \
} while (0)
#else
#define SEND_TMSG(fmt, ...)
#endif
#else

#define LOG_INFO(fmt, ...)
#define LOG_WARN(msg)
#define LOG_ERROR(msg)
#define SEND_TMSG(fmt, ...)

#endif

#endif