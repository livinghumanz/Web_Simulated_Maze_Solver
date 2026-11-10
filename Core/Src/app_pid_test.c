#include "app_pid_test.h"

#include <ctype.h>
#include <math.h>
#include <stdbool.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"
#include "battery.h"
#include "bt_log.h"
#include "dip_switch.h"
#include "encoder.h"
#include "motion.h"
#include "motor.h"
#include "dfu.h"

#define DEFAULT_VMAX     100.0f    /* mm/s  (USB power tops out near ~170)  */
#define DEFAULT_ACCEL    300.0f    /* mm/s^2                                */
#define DEFAULT_SPD_MS   3000U
#define MAX_VMAX         160.0f
#define MAX_DIST_MM      2000.0f

static const osThreadAttr_t s_tel_attr = {
    .name = "telemetry",
    .stack_size = 384 * 4,
    .priority = (osPriority_t)osPriorityBelowNormal,
};

/* newlib-nano printf has no %f: print floats as fixed-point with 3 decimals. */
typedef struct { char s[16]; } FloatStr;
static FloatStr f3(float v)
{
    FloatStr out;
    long milli = (long)(v * 1000.0f + (v >= 0.0f ? 0.5f : -0.5f));
    const char *sign = (milli < 0) ? "-" : "";
    if (milli < 0) milli = -milli;
    snprintf(out.s, sizeof(out.s), "%s%ld.%03ld", sign, milli / 1000, milli % 1000);
    return out;
}

static void print_gains(void)
{
    MotionGains g;
    Motion_GetGains(&g);
    BT_LOG("GAINS: KP=%s KI=%s KD=%s KFF=%s KS=%s",
           f3(g.kp).s, f3(g.ki).s, f3(g.kd).s, f3(g.kff).s, f3(g.kstatic).s);
}

/* ---------------- telemetry printer (low priority) ---------------- */

static void telemetry_task(void *arg)
{
    (void)arg;
    MotionSample s;
    for (;;) {
        if (!Motion_GetSample(&s, osWaitForever)) {
            continue;
        }
        switch (s.event) {
        case MOTION_EV_SAMPLE:
            BT_LOG("[P] t=%lu vt=%d,%d v=%d,%d e=%d,%d d=%d,%d",
                   (unsigned long)s.t_ms, s.vt_left, s.vt_right, s.v_left, s.v_right,
                   s.err_left, s.err_right, s.duty_left, s.duty_right);
            break;
        case MOTION_EV_START:
            BT_LOG("[EV] START");
            break;
        case MOTION_EV_DONE:
            BT_LOG("[EV] DONE t=%lums dist=%ld.%03ldmm final err L=%d R=%d counts",
                   (unsigned long)s.t_ms, (long)(s.dist_um / 1000), labs(s.dist_um % 1000),
                   s.err_left, s.err_right);
            break;
        case MOTION_EV_STOPPED:
            BT_LOG("[EV] STOPPED t=%lums", (unsigned long)s.t_ms);
            break;
        case MOTION_EV_FOLLOW_ERR:
            BT_LOG("[EV] ABORT following error L=%d R=%d counts (stall/encoder?)",
                   s.err_left, s.err_right);
            break;
        default:
            break;
        }
    }
}

/* ---------------- console ---------------- */

static bool parse_float(const char *s, float *out)
{
    if (s == NULL) return false;
    char *end;
    float v = strtof(s, &end);
    if (end == s || *end != '\0') return false;
    *out = v;
    return true;
}

static void print_help(void)
{
    BT_LOG("PID test commands (wheels OFF the ground for now):");
    BT_LOG("  FWD <mm> [v] [a]     straight move, v mm/s (%d), a mm/s^2 (%d)",
           (int)DEFAULT_VMAX, (int)DEFAULT_ACCEL);
    BT_LOG("  SPD <l> <r> [ms] [a] constant wheel speeds in mm/s (%ums)", (unsigned)DEFAULT_SPD_MS);
    BT_LOG("  STOP                 abort the move, motors coast");
    BT_LOG("  KP|KI|KD|KFF|KS <x>  set a gain   GAINS  show gains");
    BT_LOG("  TEL <ms>             telemetry period (0 = events only)");
    BT_LOG("  ENC  BAT  STAT  PING  UPDATE (USB firmware update)");
    BT_LOG("Telemetry: [P] t vt=target mm/s v=measured mm/s e=error counts d=duty (L,R)");
}

static bool set_gain(const char *name, const char *val)
{
    float v;
    if (!parse_float(val, &v) || v < 0.0f) {
        return false;
    }
    MotionGains g;
    Motion_GetGains(&g);
    if (strcmp(name, "KP") == 0) g.kp = v;
    else if (strcmp(name, "KI") == 0) g.ki = v;
    else if (strcmp(name, "KD") == 0) g.kd = v;
    else if (strcmp(name, "KFF") == 0) g.kff = v;
    else if (strcmp(name, "KS") == 0) g.kstatic = v;
    else return false;
    Motion_SetGains(&g);
    return true;
}

static void handle_command(char *line)
{
    BT_LOG("> %s", line);
    for (char *p = line; *p; ++p) {
        *p = (char)toupper((unsigned char)*p);
    }
    char *cmd = strtok(line, " ");
    char *a1 = strtok(NULL, " ");
    char *a2 = strtok(NULL, " ");
    char *a3 = strtok(NULL, " ");
    char *a4 = strtok(NULL, " ");
    if (cmd == NULL) {
        return;
    }

    if (strcmp(cmd, "STOP") == 0) {
        Motion_Stop();
    } else if (strcmp(cmd, "HELP") == 0 || strcmp(cmd, "?") == 0) {
        print_help();
    } else if (strcmp(cmd, "UPDATE") == 0 || strcmp(cmd, "DFU") == 0) {
        Dfu_Enter();
    } else if (strcmp(cmd, "PING") == 0) {
        BT_LOG("PONG");
    } else if (strcmp(cmd, "FWD") == 0) {
        float mm, v = DEFAULT_VMAX, a = DEFAULT_ACCEL;
        if (!parse_float(a1, &mm) || fabsf(mm) > MAX_DIST_MM ||
            (a2 && (!parse_float(a2, &v) || v <= 0.0f || v > MAX_VMAX)) ||
            (a3 && (!parse_float(a3, &a) || a <= 0.0f))) {
            BT_LOG("usage: FWD <mm |<=%d> [v 1..%d] [a>0]", (int)MAX_DIST_MM, (int)MAX_VMAX);
        } else if (!Motion_Forward(mm, v, a)) {
            BT_LOG("FWD rejected (busy, or backwards needs the left reverse fix)");
        }
    } else if (strcmp(cmd, "SPD") == 0) {
        float l, r, ms = (float)DEFAULT_SPD_MS, a = DEFAULT_ACCEL;
        if (!parse_float(a1, &l) || !parse_float(a2, &r) ||
            fabsf(l) > MAX_VMAX || fabsf(r) > MAX_VMAX ||
            (a3 && (!parse_float(a3, &ms) || ms < 1.0f || ms > 20000.0f)) ||
            (a4 && (!parse_float(a4, &a) || a <= 0.0f))) {
            BT_LOG("usage: SPD <l> <r> mm/s (|v|<=%d) [ms<=20000] [a]", (int)MAX_VMAX);
        } else if (!Motion_Speed(l, r, (uint32_t)ms, a)) {
            BT_LOG("SPD rejected (busy, or left wheel cannot reverse)");
        }
    } else if (strcmp(cmd, "GAINS") == 0) {
        print_gains();
    } else if (strcmp(cmd, "KP") == 0 || strcmp(cmd, "KI") == 0 || strcmp(cmd, "KD") == 0 ||
               strcmp(cmd, "KFF") == 0 || strcmp(cmd, "KS") == 0) {
        if (set_gain(cmd, a1)) {
            print_gains();
        } else {
            BT_LOG("usage: %s <value >= 0>", cmd);
        }
    } else if (strcmp(cmd, "TEL") == 0) {
        float ms;
        if (!parse_float(a1, &ms) || ms < 0.0f || ms > 10000.0f) {
            BT_LOG("usage: TEL <ms, 0 = off>");
        } else {
            Motion_SetTelemetryPeriod((uint32_t)ms);
            BT_LOG("telemetry every %lu ms", (unsigned long)ms);
        }
    } else if (strcmp(cmd, "ENC") == 0) {
        BT_LOG("ENC: L=%ld R=%ld", (long)Encoder_Left(), (long)Encoder_Right());
    } else if (strcmp(cmd, "BAT") == 0) {
        BT_LOG("BAT: %lu mV", (unsigned long)Battery_ReadMv());
    } else if (strcmp(cmd, "STAT") == 0) {
        BT_LOG("STAT: busy=%d drop bt=%lu wired=%lu heap_free=%u stack_free=%lu words",
               Motion_IsBusy(), (unsigned long)BT_Log_DroppedCount(),
               (unsigned long)BT_Log_WiredDroppedCount(), (unsigned)xPortGetFreeHeapSize(),
               (unsigned long)uxTaskGetStackHighWaterMark(NULL));
    } else {
        BT_LOG("? unknown '%s' (type HELP)", cmd);
    }
}

void PidTest_Run(uint8_t dip)
{
    Motor_Coast();
    Encoder_Init();
    BT_Log_SetMirrorUart1(true);   /* nothing else uses USART1 TX in this mode */
    Motion_Start();                /* control task now owns encoders + motors */
    osThreadNew(telemetry_task, NULL, &s_tel_attr);

    BT_LOG("");
    BT_LOG("==== RatRocket Micromouse ====");
    BT_LOG("FW build: %s %s", __DATE__, __TIME__);
    BT_LOG("Mode: %s (DIP 0x%X)", DIP_ModeName(dip), dip);
    BT_LOG("Supply: %lu mV, PWM %lu Hz, left reverse %s",
           (unsigned long)Battery_ReadMv(), (unsigned long)Motor_GetPwmFrequency(),
           MOTION_LEFT_CAN_REVERSE ? "enabled" : "DISABLED (hw fault)");
    print_gains();
    BT_LOG("Type HELP for commands.");

    char line[48];
    for (;;) {
        if (BT_Log_GetLine(line, sizeof(line))) {
            handle_command(line);
        }
        osDelay(10);
    }
}
