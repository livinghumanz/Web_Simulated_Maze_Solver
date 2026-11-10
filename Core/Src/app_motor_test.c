#include "app_motor_test.h"

#include <ctype.h>
#include <stdbool.h>
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
#include "motor.h"
#include "dfu.h"

#define LOOP_MS           10U
#define HEARTBEAT_MS      1000U
#define TELEMETRY_MS      200U     /* 5 Hz: keeps the 9600-baud BT link below ~60% */
#define RAMP_MS           300U     /* soft start, limits inrush on USB power */
#define BRAKE_MS          300U
#define PWM_DEFAULT_MS    2000U
#define PWM_MAX_MS        10000U
#define JOG_TIMEOUT_MS    20000U
#define JOG_MAX_COUNTS    200000L
#define SWEEP_SETTLE_MS   600U
#define SWEEP_MEASURE_MS  500U

/* PWM at ~1 kHz: dead-band drops from ~700 (10 kHz) to ~250 duty and the
 * speed/duty curve becomes smooth (SWEEP results 2026-11-06, USB power). */
#define MOTOR_TEST_PWM_HZ 1000U
#define CAL_DUTY          800      /* kick duty to break static friction */
#define CAL_PAUSE_MS      2000U
#define WIGGLE_DUTY       MOTOR_PWM_MAX
#define WIGGLE_ON_MS      60U
#define WIGGLE_OFF_MS     350U
#define STILL_MS          200U     /* "stopped" = no count change for this long */
#define STILL_TIMEOUT_MS  3000U
#define DECEL_DUTY        900
#define DECEL_RUN_MS      700U
#define DECEL_REV_MAX_MS  150U

static int16_t s_jog_pwm = 800;

/* ---------------- helpers ---------------- */

static void to_upper(char *s)
{
    for (; *s; ++s) {
        *s = (char)toupper((unsigned char)*s);
    }
}

static bool parse_long(const char *s, long *out)
{
    if (s == NULL) {
        return false;
    }
    char *end;
    long v = strtol(s, &end, 10);
    if (end == s || *end != '\0') {
        return false;
    }
    *out = v;
    return true;
}

/* While motors run only STOP is accepted. */
static bool stop_requested(void)
{
    char line[48];
    if (!BT_Log_GetLine(line, sizeof(line))) {
        return false;
    }
    to_upper(line);
    if (strcmp(line, "STOP") == 0) {
        BT_LOG("> STOP");
        return true;
    }
    BT_LOG("busy - ignored '%s' (send STOP to abort)", line);
    return false;
}

static int16_t ramp(int16_t target, uint32_t elapsed_ms)
{
    if (elapsed_ms >= RAMP_MS) {
        return target;
    }
    return (int16_t)((int32_t)target * (int32_t)elapsed_ms / (int32_t)RAMP_MS);
}

static void stop_motors(void)
{
    Motor_Brake();
    osDelay(BRAKE_MS);
    Motor_Coast();
    Encoder_Update();
}

/* Open-loop drive for ms. Returns false if STOP was received. */
static bool drive_for(int16_t l, int16_t r, uint32_t ms, bool soft_start, bool telemetry)
{
    TickType_t wake = xTaskGetTickCount();
    uint32_t t0 = HAL_GetTick();
    uint32_t t_tel = t0;
    int32_t pl = Encoder_Left();
    int32_t pr = Encoder_Right();

    for (;;) {
        uint32_t el = HAL_GetTick() - t0;
        if (el >= ms) {
            return true;
        }
        int16_t dl = soft_start ? ramp(l, el) : l;
        int16_t dr = soft_start ? ramp(r, el) : r;
        Motor_SetPwm(dl, dr);

        vTaskDelayUntil(&wake, pdMS_TO_TICKS(LOOP_MS));
        Encoder_Update();
        if (stop_requested()) {
            return false;
        }

        if (telemetry) {
            uint32_t now = HAL_GetTick();
            uint32_t dt = now - t_tel;
            if (dt >= TELEMETRY_MS) {
                int32_t cl = Encoder_Left();
                int32_t cr = Encoder_Right();
                BT_LOG("[T] t=%lu pwm=%d,%d pos=%ld,%ld cps=%ld,%ld",
                       (unsigned long)(now - t0), dl, dr, (long)cl, (long)cr,
                       (long)((cl - pl) * 1000 / (int32_t)dt),
                       (long)((cr - pr) * 1000 / (int32_t)dt));
                pl = cl;
                pr = cr;
                t_tel = now;
            }
        }
    }
}

/* ---------------- single-wheel helpers ---------------- */

static void wheel_set(char w, int16_t duty)
{
    if (w == 'L') Motor_SetLeft(duty); else Motor_SetRight(duty);
}

static void wheel_brake(char w)
{
    if (w == 'L') Motor_BrakeLeft(); else Motor_BrakeRight();
}

static int32_t wheel_pos(char w)
{
    return (w == 'L') ? Encoder_Left() : Encoder_Right();
}

/* Wait until the wheel has not moved for STILL_MS (or timeout).
 * Returns the time from the call until the last observed movement. */
static uint32_t wait_still(char w, uint32_t timeout_ms)
{
    uint32_t t0 = HAL_GetTick();
    uint32_t t_last_move = t0;
    int32_t last = wheel_pos(w);
    while (HAL_GetTick() - t0 < timeout_ms) {
        osDelay(1);
        Encoder_Update();
        int32_t p = wheel_pos(w);
        if (p != last) {
            last = p;
            t_last_move = HAL_GetTick();
        } else if (HAL_GetTick() - t_last_move >= STILL_MS) {
            break;
        }
    }
    return t_last_move - t0;
}

/* ---------------- commands ---------------- */

static void print_help(void)
{
    BT_LOG("Motor test commands (wheels OFF the ground):");
    BT_LOG("  SWEEP            both wheels fwd at rising duty, prints counts/s");
    BT_LOG("  PWM <l> <r> [ms] open-loop duty -%d..%d (default %ums)",
           MOTOR_PWM_MAX, MOTOR_PWM_MAX, (unsigned)PWM_DEFAULT_MS);
    BT_LOG("  JOG <L|R|B> <n>  turn wheel(s) forward by n encoder counts");
    BT_LOG("  JOGPWM <d>       duty used by JOG (now %d)", s_jog_pwm);
    BT_LOG("  CAL <L|R> [n] [d] twitch x3, pause, spin n counts (6000) at duty d (%d)", CAL_DUTY);
    BT_LOG("  PWMFREQ [hz]     show / set motor PWM frequency");
    BT_LOG("  DECEL <L|R>      compare coast / brake / reverse stopping");
    BT_LOG("  STOP             brake + coast (works while running)");
    BT_LOG("  ENC / ENC0       encoder positions / reset them");
    BT_LOG("  BAT  FAULT  STAT PING  UPDATE (USB firmware update)");
}

static void cmd_sweep(void)
{
    /* Forward only: the left motor cannot reverse (PB1 -> driver link is open). */
    static const int16_t duties[] = {200, 300, 400, 500, 600, 700, 800, 900, MOTOR_PWM_MAX};
    BT_LOG("SWEEP @ %lu Hz: both wheels forward at rising duty. STOP aborts.",
           (unsigned long)Motor_GetPwmFrequency());
    BT_LOG(" duty    L cps    R cps");

    int16_t prev = 0;
    for (size_t i = 0; i < sizeof(duties) / sizeof(duties[0]); i++) {
        int16_t d = duties[i];
        bool soft = (prev == 0);
        if (!drive_for(d, d, SWEEP_SETTLE_MS, soft, false)) {
            stop_motors();
            BT_LOG("SWEEP aborted");
            return;
        }
        int32_t l0 = Encoder_Left();
        int32_t r0 = Encoder_Right();
        uint32_t t0 = HAL_GetTick();
        if (!drive_for(d, d, SWEEP_MEASURE_MS, false, false)) {
            stop_motors();
            BT_LOG("SWEEP aborted");
            return;
        }
        int32_t dt = (int32_t)(HAL_GetTick() - t0);
        BT_LOG("%5d  %7ld  %7ld", d,
               (long)((Encoder_Left() - l0) * 1000 / dt),
               (long)((Encoder_Right() - r0) * 1000 / dt));
        prev = d;
    }
    stop_motors();
    BT_LOG("SWEEP done (positive duty should give positive cps on both wheels).");
}

static void cmd_pwm(long l, long r, long ms)
{
    BT_LOG("PWM L=%ld R=%ld for %ldms", l, r, ms);
    int32_t l0 = Encoder_Left();
    int32_t r0 = Encoder_Right();
    bool ok = drive_for((int16_t)l, (int16_t)r, (uint32_t)ms, true, true);
    stop_motors();
    BT_LOG("PWM %s: moved L=%ld R=%ld counts", ok ? "done" : "aborted",
           (long)(Encoder_Left() - l0), (long)(Encoder_Right() - r0));
}

static void cmd_jog(char which, long counts)
{
    bool do_l = (which == 'L' || which == 'B');
    bool do_r = (which == 'R' || which == 'B');
    bool done_l = !do_l;
    bool done_r = !do_r;
    int32_t l0 = Encoder_Left();
    int32_t r0 = Encoder_Right();

    BT_LOG("JOG %c by %ld counts at duty %d", which, counts, s_jog_pwm);
    TickType_t wake = xTaskGetTickCount();
    uint32_t t0 = HAL_GetTick();

    while (!(done_l && done_r)) {
        uint32_t el = HAL_GetTick() - t0;
        if (el > JOG_TIMEOUT_MS) {
            BT_LOG("JOG timeout (wheel stalled or duty too low?)");
            break;
        }
        int16_t d = ramp(s_jog_pwm, el);
        if (!done_l) Motor_SetLeft(d);
        if (!done_r) Motor_SetRight(d);

        vTaskDelayUntil(&wake, pdMS_TO_TICKS(1));   /* 1 ms: stop close to target */
        Encoder_Update();
        if (!done_l && labs((long)(Encoder_Left() - l0)) >= counts) {
            Motor_BrakeLeft();
            done_l = true;
        }
        if (!done_r && labs((long)(Encoder_Right() - r0)) >= counts) {
            Motor_BrakeRight();
            done_r = true;
        }
        if (stop_requested()) {
            BT_LOG("JOG aborted");
            break;
        }
    }
    stop_motors();
    BT_LOG("JOG result: L moved %ld, R moved %ld counts (target %ld, incl. overshoot)",
           (long)(Encoder_Left() - l0), (long)(Encoder_Right() - r0), counts);
}

/* Guided counts-per-turn measurement: the wheel twitches 3 times so the user
 * knows which one to watch, pauses, then spins `counts` and coasts to a stop.
 * The total includes the coast, so it matches what the user sees. */
static void cmd_cal(char w, long counts, int16_t duty)
{
    const char *name = (w == 'L') ? "LEFT" : "RIGHT";
    BT_LOG("CAL %s: 3 twitches, %us pause, then ~%ld counts at duty %d (%lu Hz)",
           name, (unsigned)(CAL_PAUSE_MS / 1000U), counts, duty,
           (unsigned long)Motor_GetPwmFrequency());

    for (int i = 0; i < 3; i++) {
        wheel_set(w, WIGGLE_DUTY);
        osDelay(WIGGLE_ON_MS);
        wheel_set(w, 0);
        osDelay(WIGGLE_OFF_MS);
    }
    wait_still(w, STILL_TIMEOUT_MS);
    osDelay(CAL_PAUSE_MS);
    Encoder_Update();

    int32_t p0 = wheel_pos(w);
    TickType_t wake = xTaskGetTickCount();
    uint32_t t0 = HAL_GetTick();
    bool aborted = false;
    while (labs((long)(wheel_pos(w) - p0)) < counts) {
        uint32_t el = HAL_GetTick() - t0;
        if (el > JOG_TIMEOUT_MS) {
            BT_LOG("CAL timeout (wheel stalled?)");
            aborted = true;
            break;
        }
        /* Kick at CAL_DUTY to break static friction, then hold the requested duty. */
        wheel_set(w, (el < RAMP_MS) ? ramp(CAL_DUTY, el) : duty);
        vTaskDelayUntil(&wake, pdMS_TO_TICKS(1));
        Encoder_Update();
        if (stop_requested()) {
            aborted = true;
            break;
        }
    }
    wheel_set(w, 0);                       /* coast */
    wait_still(w, STILL_TIMEOUT_MS);
    long moved = (long)(wheel_pos(w) - p0);
    BT_LOG("CAL %s %s: moved %ld counts in total (incl. coast-down)",
           name, aborted ? "ABORTED" : "done", moved);
    BT_LOG("  counts per wheel turn = %ld / (turns you counted)", labs(moved));
}

/* Compare stopping methods from the same speed: coast, brake (both inputs
 * high), and a full reverse pulse until the wheel stops moving forward. */
static void cmd_decel(char w)
{
    static const char *const names[] = {"COAST", "BRAKE", "REVERSE"};
    BT_LOG("DECEL %c: spin at duty %d, then stop 3 ways", w, DECEL_DUTY);
    BT_LOG(" method   from_cps  stop_counts  stop_ms");

    for (int m = 0; m < 3; m++) {
        TickType_t wake = xTaskGetTickCount();
        uint32_t t0 = HAL_GetTick();
        while (HAL_GetTick() - t0 < DECEL_RUN_MS) {
            wheel_set(w, ramp(DECEL_DUTY, HAL_GetTick() - t0));
            vTaskDelayUntil(&wake, pdMS_TO_TICKS(LOOP_MS));
            Encoder_Update();
            if (stop_requested()) {
                stop_motors();
                BT_LOG("DECEL aborted");
                return;
            }
        }
        int32_t pa = wheel_pos(w);
        osDelay(100);
        Encoder_Update();
        int32_t ps = wheel_pos(w);
        long from_cps = (long)(ps - pa) * 10L;

        uint32_t ts = HAL_GetTick();
        if (m == 0) {
            wheel_set(w, 0);
        } else if (m == 1) {
            wheel_brake(w);
        } else {
            /* Counter-drive until the wheel stops advancing for 3 ms. */
            wheel_set(w, -MOTOR_PWM_MAX);
            int32_t prev = wheel_pos(w);
            uint32_t t_adv = HAL_GetTick();
            while (HAL_GetTick() - ts < DECEL_REV_MAX_MS) {
                osDelay(1);
                Encoder_Update();
                int32_t p = wheel_pos(w);
                if (p > prev) {
                    prev = p;
                    t_adv = HAL_GetTick();
                } else if (HAL_GetTick() - t_adv >= 3U) {
                    break;
                }
            }
            wheel_set(w, 0);
        }
        uint32_t t_wait = HAL_GetTick();
        uint32_t still = wait_still(w, STILL_TIMEOUT_MS);
        long stop_ms = (long)((t_wait - ts) + still);
        BT_LOG(" %-8s %8ld  %11ld  %7ld", names[m], from_cps,
               (long)(wheel_pos(w) - ps), stop_ms);
        Motor_Coast();
        osDelay(300);
    }
    BT_LOG("DECEL done");
}

static void handle_command(char *line)
{
    BT_LOG("> %s", line);
    to_upper(line);
    char *cmd = strtok(line, " ");
    char *a1 = strtok(NULL, " ");
    char *a2 = strtok(NULL, " ");
    char *a3 = strtok(NULL, " ");
    long v1, v2, v3;

    if (cmd == NULL) {
        return;
    }
    if (strcmp(cmd, "HELP") == 0 || strcmp(cmd, "?") == 0) {
        print_help();
    } else if (strcmp(cmd, "UPDATE") == 0 || strcmp(cmd, "DFU") == 0) {
        Dfu_Enter();
    } else if (strcmp(cmd, "PING") == 0) {
        BT_LOG("PONG");
    } else if (strcmp(cmd, "STOP") == 0) {
        stop_motors();
        BT_LOG("stopped");
    } else if (strcmp(cmd, "ENC") == 0) {
        BT_LOG("ENC: L=%ld R=%ld", (long)Encoder_Left(), (long)Encoder_Right());
    } else if (strcmp(cmd, "ENC0") == 0) {
        Encoder_Init();
        BT_LOG("ENC: reset");
    } else if (strcmp(cmd, "BAT") == 0) {
        BT_LOG("BAT: %lu mV", (unsigned long)Battery_ReadMv());
    } else if (strcmp(cmd, "FAULT") == 0) {
        BT_LOG("FAULT pin PC13 = %d",
               (int)HAL_GPIO_ReadPin(Motor_Error_Pin_GPIO_Port, Motor_Error_Pin_Pin));
    } else if (strcmp(cmd, "STAT") == 0) {
        BT_LOG("STAT: rx=%lu drop bt=%lu wired=%lu heap_free=%u stack_free=%lu words",
               (unsigned long)BT_Log_RxByteCount(), (unsigned long)BT_Log_DroppedCount(),
               (unsigned long)BT_Log_WiredDroppedCount(), (unsigned)xPortGetFreeHeapSize(),
               (unsigned long)uxTaskGetStackHighWaterMark(NULL));
    } else if (strcmp(cmd, "SWEEP") == 0) {
        cmd_sweep();
    } else if (strcmp(cmd, "PWM") == 0) {
        if (!parse_long(a1, &v1) || !parse_long(a2, &v2) ||
            labs(v1) > MOTOR_PWM_MAX || labs(v2) > MOTOR_PWM_MAX) {
            BT_LOG("usage: PWM <l> <r> [ms], duty -%d..%d", MOTOR_PWM_MAX, MOTOR_PWM_MAX);
            return;
        }
        v3 = PWM_DEFAULT_MS;
        if (a3 != NULL && (!parse_long(a3, &v3) || v3 <= 0 || v3 > (long)PWM_MAX_MS)) {
            BT_LOG("ms must be 1..%u", (unsigned)PWM_MAX_MS);
            return;
        }
        cmd_pwm(v1, v2, v3);
    } else if (strcmp(cmd, "JOG") == 0) {
        if (a1 == NULL || strlen(a1) != 1 || strchr("LRB", a1[0]) == NULL ||
            !parse_long(a2, &v2) || v2 <= 0 || v2 > JOG_MAX_COUNTS) {
            BT_LOG("usage: JOG <L|R|B> <counts 1..%ld>", JOG_MAX_COUNTS);
            return;
        }
        cmd_jog(a1[0], v2);
    } else if (strcmp(cmd, "CAL") == 0 || strcmp(cmd, "DECEL") == 0) {
        if (a1 == NULL || strlen(a1) != 1 || (a1[0] != 'L' && a1[0] != 'R')) {
            BT_LOG("usage: %s <L|R>%s", cmd, cmd[0] == 'C' ? " [counts]" : "");
            return;
        }
        if (cmd[0] == 'D') {
            cmd_decel(a1[0]);
            return;
        }
        v2 = 6000;
        if (a2 != NULL && (!parse_long(a2, &v2) || v2 <= 0 || v2 > JOG_MAX_COUNTS)) {
            BT_LOG("counts must be 1..%ld", JOG_MAX_COUNTS);
            return;
        }
        v3 = CAL_DUTY;
        if (a3 != NULL && (!parse_long(a3, &v3) || v3 < 50 || v3 > MOTOR_PWM_MAX)) {
            BT_LOG("duty must be 50..%d", MOTOR_PWM_MAX);
            return;
        }
        cmd_cal(a1[0], v2, (int16_t)v3);
    } else if (strcmp(cmd, "PWMFREQ") == 0) {
        if (a1 == NULL) {
            BT_LOG("PWM frequency: %lu Hz", (unsigned long)Motor_GetPwmFrequency());
            return;
        }
        if (!parse_long(a1, &v1) || v1 < 200 || v1 > 40000) {
            BT_LOG("usage: PWMFREQ <200..40000 Hz>");
            return;
        }
        Motor_Coast();
        BT_LOG("PWM frequency set to %lu Hz", (unsigned long)Motor_SetPwmFrequency((uint32_t)v1));
    } else if (strcmp(cmd, "JOGPWM") == 0) {
        if (!parse_long(a1, &v1) || v1 < 50 || v1 > MOTOR_PWM_MAX) {
            BT_LOG("usage: JOGPWM <50..%d>", MOTOR_PWM_MAX);
            return;
        }
        s_jog_pwm = (int16_t)v1;
        BT_LOG("JOG duty = %d", s_jog_pwm);
    } else {
        BT_LOG("? unknown '%s' (type HELP)", cmd);
    }
}

void MotorTest_Run(uint8_t dip)
{
    Motor_Coast();
    Motor_SetPwmFrequency(MOTOR_TEST_PWM_HZ);
    Encoder_Init();
    BT_Log_SetMirrorUart1(true);   /* nothing else uses USART1 TX in this mode */

    BT_LOG("");
    BT_LOG("==== RatRocket Micromouse ====");
    BT_LOG("FW build: %s %s", __DATE__, __TIME__);
    BT_LOG("Mode: %s (DIP 0x%X)", DIP_ModeName(dip), dip);
    BT_LOG("Supply: %lu mV, PWM %lu Hz", (unsigned long)Battery_ReadMv(),
           (unsigned long)Motor_GetPwmFrequency());
    BT_LOG("Keep the wheels OFF the ground. Type HELP for commands.");

    char line[48];
    uint32_t last_hb = HAL_GetTick();
    for (;;) {
        Encoder_Update();
        if (BT_Log_GetLine(line, sizeof(line))) {
            handle_command(line);
            last_hb = HAL_GetTick();
        }
        uint32_t now = HAL_GetTick();
        if (now - last_hb >= HEARTBEAT_MS) {
            last_hb = now;
            HAL_GPIO_TogglePin(RGB_Green_GPIO_Port, RGB_Green_Pin);
            BT_LOG("[HB] t=%lus sup=%lumV pos=%ld,%ld",
                   (unsigned long)(now / 1000U), (unsigned long)Battery_ReadMv(),
                   (long)Encoder_Left(), (long)Encoder_Right());
        }
        osDelay(LOOP_MS);
    }
}
