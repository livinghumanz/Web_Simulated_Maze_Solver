#include "app_bt_test.h"

#include <ctype.h>
#include <stdbool.h>
#include <stdio.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"
#include "tim.h"
#include "battery.h"
#include "bt_log.h"
#include "dip_switch.h"
#include "motor.h"
#include "dfu.h"

#define POLL_PERIOD_MS       20U
#define HEARTBEAT_PERIOD_MS  1000U

#define BTNAME_MAX_LEN       20U
#define BTNAME_HOST_GRACE_MS 4000U    /* time for the PC/phone to disconnect */
#define BTNAME_WINDOW_MS     30000U   /* time the user has to hold the HC-05 button */

static bool s_heartbeat = true;
static char s_rename_result[96] ="no rename attempted since boot";

/* TIM4 = left encoder, TIM2 = right encoder (16-bit, shown signed). */
static int16_t enc_left(void)  { return (int16_t)TIM4->CNT; }
static int16_t enc_right(void) { return (int16_t)TIM2->CNT; }

static void print_dip(uint8_t dip)
{
    BT_LOG("DIP: SW1=%s SW2=%s SW3=%s SW4=%s (0x%X) -> %s",
           (dip & DIP_SW1) ? "ON" : "off", (dip & DIP_SW2) ? "ON" : "off",
           (dip & DIP_SW3) ? "ON" : "off", (dip & DIP_SW4) ? "ON" : "off",
           dip, DIP_ModeName(dip));
}

static void print_help(void)
{
    BT_LOG("Commands:");
    BT_LOG("  PING        -> PONG");
    BT_LOG("  DIP         switch state (live)");
    BT_LOG("  BAT         battery voltage");
    BT_LOG("  ENC         encoder counts   ENC0  reset them");
    BT_LOG("  LED R|G|B   toggle an RGB LED");
    BT_LOG("  HB ON|OFF   1 Hz heartbeat on/off");
    BT_LOG("  STAT        link + RTOS stats");
    BT_LOG("  BTNAME <n>  rename the HC-05 (hold its button when told)");
    BT_LOG("  BTINFO      result of the last rename");
}

/* ---------- HC-05 rename via AT commands ----------
 * The HC-05 only parses AT commands while its KEY pin is high (the button on
 * the breakout board) and no remote device is connected. In that state it
 * answers on USART6 at the normal data baud rate (9600). Everything sent on
 * USART6 is parsed as a command, so progress is printed on USART1 only. */

static bool at_command(const char *cmd, const char *expect, char *resp, size_t resp_size,
                       uint32_t timeout_ms)
{
    while (BT_Log_GetLine(resp, resp_size)) { }   /* discard stale lines */
    BT_Log_Printf("%s\r\n", cmd);
    BT_Log_Uart1Only("[AT] -> %s\r\n", cmd);

    uint32_t start = HAL_GetTick();
    while (HAL_GetTick() - start < timeout_ms) {
        if (BT_Log_GetLine(resp, resp_size)) {
            BT_Log_Uart1Only("[AT] <- %s\r\n", resp);
            if (strncmp(resp, expect, strlen(expect)) == 0) {
                return true;
            }
            if (strncmp(resp, "ERROR", 5) == 0) {
                return false;
            }
        }
        osDelay(10);
    }
    return false;
}

static bool valid_bt_name(const char *name)
{
    size_t len = strlen(name);
    if (len == 0U || len > BTNAME_MAX_LEN) {
        return false;
    }
    for (const char *p = name; *p; ++p) {
        if (!isalnum((unsigned char)*p) && *p != '-' && *p != '_') {
            return false;
        }
    }
    return true;
}

static void rename_hc05(const char *name)
{
    char resp[48];
    char cmd[40];

    BT_LOG("Renaming HC-05 to '%s'.", name);
    BT_LOG("1) Disconnect Bluetooth now.");
    BT_LOG("2) Press and HOLD the button on the HC-05 until the blue LED stops flashing (max 30 s).");
    osDelay(BTNAME_HOST_GRACE_MS);

    BT_Log_Uart1Only("[AT] waiting for AT mode (hold the HC-05 button)...\r\n");
    bool in_at_mode = false;
    uint32_t start = HAL_GetTick();
    while (HAL_GetTick() - start < BTNAME_WINDOW_MS) {
        HAL_GPIO_TogglePin(RGB_Blue_GPIO_Port, RGB_Blue_Pin);
        if (at_command("AT", "OK", resp, sizeof(resp), 400)) {
            in_at_mode = true;
            break;
        }
    }
    HAL_GPIO_WritePin(RGB_Blue_GPIO_Port, RGB_Blue_Pin, GPIO_PIN_RESET);

    if (!in_at_mode) {
        snprintf(s_rename_result, sizeof(s_rename_result), "FAILED: HC-05 never answered AT");
    } else {
        snprintf(cmd, sizeof(cmd), "AT+NAME=%s", name);
        if (!at_command(cmd, "OK", resp, sizeof(resp), 1500)) {
            snprintf(s_rename_result, sizeof(s_rename_result), "FAILED: AT+NAME rejected (%s)", resp);
        } else if (at_command("AT+NAME?", "+NAME", resp, sizeof(resp), 1500)) {
            snprintf(s_rename_result, sizeof(s_rename_result), "OK: module reports %s", resp);
        } else {
            snprintf(s_rename_result, sizeof(s_rename_result), "OK: AT+NAME accepted (read-back n/a)");
        }
    }
    BT_Log_Uart1Only("[AT] result: %s\r\n", s_rename_result);
    BT_Log_Uart1Only("[AT] release the button; reconnect and send BTINFO\r\n");
}

static void handle_command(char *line)
{
    /* Command word is case-insensitive; arguments keep their case. */
    char upper[48];
    size_t i = 0;
    for (; line[i] && i < sizeof(upper) - 1U; ++i) {
        upper[i] = (char)toupper((unsigned char)line[i]);
    }
    upper[i] = '\0';

    if (strncmp(upper, "BTNAME ", 7) == 0) {
        const char *name = line + 7;
        if (valid_bt_name(name)) {
            rename_hc05(name);
        } else {
            BT_LOG("BTNAME: use 1-%u chars of A-Z a-z 0-9 - _", (unsigned)BTNAME_MAX_LEN);
        }
        return;
    }
    if (strcmp(upper, "DFU") == 0) {
        Dfu_Enter();
    }
    if (strcmp(upper, "BTINFO") == 0) {
        BT_LOG("BTINFO: %s", s_rename_result);
        return;
    }
    line = upper;

    if (strcmp(line, "PING") == 0) {
        BT_LOG("PONG");
    } else if (strcmp(line, "HELP") == 0 || strcmp(line, "?") == 0) {
        print_help();
    } else if (strcmp(line, "DIP") == 0) {
        print_dip(DIP_Read());
    } else if (strcmp(line, "BAT") == 0) {
        BT_LOG("BAT: %lu mV", (unsigned long)Battery_ReadMv());
    } else if (strcmp(line, "ENC") == 0) {
        BT_LOG("ENC: L=%d R=%d", enc_left(), enc_right());
    } else if (strcmp(line, "ENC0") == 0) {
        TIM4->CNT = 0;
        TIM2->CNT = 0;
        BT_LOG("ENC: reset");
    } else if (strcmp(line, "LED R") == 0) {
        HAL_GPIO_TogglePin(RGB_Red_GPIO_Port, RGB_Red_Pin);
        BT_LOG("LED R toggled");
    } else if (strcmp(line, "LED G") == 0) {
        HAL_GPIO_TogglePin(RGB_Green_GPIO_Port, RGB_Green_Pin);
        BT_LOG("LED G toggled");
    } else if (strcmp(line, "LED B") == 0) {
        HAL_GPIO_TogglePin(RGB_Blue_GPIO_Port, RGB_Blue_Pin);
        BT_LOG("LED B toggled");
    } else if (strcmp(line, "HB ON") == 0) {
        s_heartbeat = true;
        BT_LOG("Heartbeat on");
    } else if (strcmp(line, "HB OFF") == 0) {
        s_heartbeat = false;
        BT_LOG("Heartbeat off");
    } else if (strcmp(line, "STAT") == 0) {
        BT_LOG("STAT: rx=%lu bytes, drop bt=%lu wired=%lu, heap_free=%u, stack_free=%lu words",
               (unsigned long)BT_Log_RxByteCount(), (unsigned long)BT_Log_DroppedCount(),
               (unsigned long)BT_Log_WiredDroppedCount(),
               (unsigned)xPortGetFreeHeapSize(),
               (unsigned long)uxTaskGetStackHighWaterMark(NULL));
    } else {
        BT_LOG("? unknown '%s' (type HELP)", line);
    }
}

void BtTest_Run(uint8_t dip)
{
    stop_Slow();
    BT_Log_SetMirrorUart1(true);   /* nothing else uses USART1 TX in this mode */

    BT_LOG("");
    BT_LOG("==== RatRocket Micromouse ====");
    BT_LOG("FW build: %s %s", __DATE__, __TIME__);
    print_dip(dip);
    BT_LOG("BAT: %lu mV", (unsigned long)Battery_ReadMv());
    BT_LOG("Bluetooth link OK. Type HELP for commands.");

    char line[48];
    uint32_t last_hb = HAL_GetTick();

    for (;;) {
        if (BT_Log_GetLine(line, sizeof(line))) {
            BT_LOG("> %s", line);
            handle_command(line);
        }

        uint32_t now = HAL_GetTick();
        if (now - last_hb >= HEARTBEAT_PERIOD_MS) {
            last_hb = now;
            HAL_GPIO_TogglePin(RGB_Green_GPIO_Port, RGB_Green_Pin);   /* alive blink */
            if (s_heartbeat) {
                BT_LOG("[HB] t=%lus bat=%lumV encL=%d encR=%d dip=0x%X rx=%lu drop=%lu",
                       (unsigned long)(now / 1000U), (unsigned long)Battery_ReadMv(),
                       enc_left(), enc_right(), DIP_Read(),
                       (unsigned long)BT_Log_RxByteCount(), (unsigned long)BT_Log_DroppedCount());
            }
        }

        osDelay(POLL_PERIOD_MS);
    }
}
