#include "app_maze.h"

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
#include "bt_log.h"
#include "dip_switch.h"
#include "encoder.h"
#include "maze_run.h"
#include "motion.h"
#include "motor.h"
#include "settings.h"
#include "dfu.h"
#include "imu.h"
#include "ultrasonic.h"

#define LOOP_MS          10U
#define BUTTON_DEBOUNCE  50U
#define BUTTON_GO_DELAY  1000U   /* time to take the hand away after pressing */

static uint32_t s_us_stream_ms;   /* 0 = off */
static bool s_button_escape = true;   /* PB2 button: true = ESCAPE, false = GO */

static const osThreadAttr_t s_ev_attr = {
    .name = "motion_ev",
    .stack_size = 320 * 4,
    .priority = (osPriority_t)osPriorityBelowNormal,
};

/* ---------------- helpers ---------------- */

typedef struct { char s[16]; } FloatStr;
static FloatStr f2(float v)
{
    FloatStr out;
    long c = (long)(v * 100.0f + (v >= 0.0f ? 0.5f : -0.5f));
    const char *sign = (c < 0) ? "-" : "";
    if (c < 0) c = -c;
    snprintf(out.s, sizeof(out.s), "%s%ld.%02ld", sign, c / 100, c % 100);
    return out;
}

static bool parse_f(const char *s, float *out)
{
    if (s == NULL) return false;
    char *end;
    float v = strtof(s, &end);
    if (end == s || *end != '\0') return false;
    *out = v;
    return true;
}

static bool parse_dir(const char *s, ABSOLUTE_DIRECTION *d)
{
    if (s == NULL || s[1] != '\0') return false;
    switch (s[0]) {
    case 'N': *d = NORTH; return true;
    case 'S': *d = SOUTH; return true;
    case 'W': *d = WEST;  return true;
    case 'E': *d = EAST;  return true;
    default: return false;
    }
}

static bool button_pressed(void)
{
    return HAL_GPIO_ReadPin(BOOT_2_GPIO_Port, BOOT_2_Pin) == GPIO_PIN_SET;
}

/* "MAZEDEF <n> <hex>" (already upper-cased, after the command word). */
static void cmd_mazedef(char *args)
{
    char *n_str = strtok(args, " ");
    char *hex = strtok(NULL, " ");
    float n;
    if (!parse_f(n_str, &n) || !Maze_LoadMap((uint8_t)n, hex)) {
        BT_LOG("usage: MAZEDEF <n> <n*n hex digits, x-major, N=1 E=2 S=4 W=8>");
    }
}

/* Abort check used by the maze runner while it drives. A new maze drawing
 * (MAZEDEF) is applied on the fly; the robot replans at the next cell. */
static bool abort_check(void)
{
    char line[48];
    if (BT_Log_GetLine(line, sizeof(line))) {
        for (char *p = line; *p; ++p) *p = (char)toupper((unsigned char)*p);
        if (strcmp(line, "STOP") == 0) {
            BT_LOG("> STOP");
            return true;
        }
        if (strncmp(line, "MAZEDEF ", 8) == 0) {
            cmd_mazedef(line + 8);
            return false;
        }
        BT_LOG("[BUSY] ignored '%s' (send STOP)", line);
    }
    return button_pressed();
}

/* Motion events (stall / following error) from the control task. */
static void motion_event_task(void *arg)
{
    (void)arg;
    MotionSample s;
    for (;;) {
        if (Motion_GetSample(&s, osWaitForever) && s.event == MOTION_EV_FOLLOW_ERR) {
            BT_LOG("[EV] ABORT following error L=%d R=%d counts (stall/blocked?)",
                   s.err_left, s.err_right);
        }
    }
}

static const char *ch_name(uint8_t ch)
{
    static const char *const names[] = { "US1", "US2", "US3" };
    return (ch < US_COUNT) ? names[ch] : "none";
}

static void print_us(void)
{
    const MazeConfig *c = &g_maze_cfg;
    uint16_t d[US_COUNT];
    for (uint8_t i = 0; i < US_COUNT; i++) d[i] = Ultrasonic_GetMm(i);
    BT_LOG("US: US1=%u US2=%u US3=%u mm | F=%u L=%u R=%u",
           d[0], d[1], d[2],
           (c->ch_front < US_COUNT) ? d[c->ch_front] : US_FAR_MM,
           (c->ch_left < US_COUNT) ? d[c->ch_left] : US_FAR_MM,
           (c->ch_right < US_COUNT) ? d[c->ch_right] : US_FAR_MM);
}

static void print_cfg(void)
{
    const MazeConfig *c = &g_maze_cfg;
    BT_LOG("CFG: size %u goal (%u,%u) home %u pitch %s track %s",
           c->size, c->goal.x, c->goal.y, c->return_home,
           f2(c->pitch_mm).s, f2(Motion_GetTrackWidth()).s);
    BT_LOG("     distance scale %s trim %s%%  escape entry %u",
           f2(Motion_GetDistanceScale() * 100.0f).s, f2(Motion_GetTrim()).s, c->entry_x);
    BT_LOG("     v_run %s a_run %s v_turn %s a_turn %s",
           f2(c->v_run).s, f2(c->a_run).s, f2(c->v_turn).s, f2(c->a_turn).s);
    BT_LOG("     sensors F=%s L=%s R=%s", ch_name(c->ch_front), ch_name(c->ch_left), ch_name(c->ch_right));
    BT_LOG("     centred F=%u L=%u R=%u  wall thr F<%u side<%u  align %u",
           c->front_center, c->center_l, c->center_r, c->thr_front, c->thr_side, c->align_front);
    BT_LOG("     centring KC p=%s d=%s max %s mm/s  sense %u  wallupd %u  pivots %u",
           f2(c->kc_p).s, f2(c->kc_d).s, f2(c->steer_max).s, c->sense, c->wall_update,
           c->pivot_turns);
}

static void print_help(void)
{
    BT_LOG("Maze mode commands:");
    BT_LOG(" Sensors : US | USW <ms> stream | USMAP <f> <l> <r> (1-3, 0=none) | WALLS");
    BT_LOG(" Calib.  : CALSPIN (walls L+R; spins 180 and back, learns side centres)");
    BT_LOG("           CAL (robot centred by hand) | CENTER (shift onto centre line) | THR <f> <s>");
    BT_LOG("           CALDIST <commanded mm> <actual mm> | TRIM <pct> (+ if it curves left)");
    BT_LOG(" Moves   : FWD <mm> [v] | TURN <deg> [v] (spin, + = right) | PIVOT <deg> [v] | CELL | STOP");
    BT_LOG(" Escape  : ESCAPE (start outside the entry, right-hand wall following) | BTN ESCAPE|GO");
    BT_LOG(" Push    : PUSH (motors off, push the robot by hand; tracked by the encoders) | STOP");
    BT_LOG(" IMU     : IMU (scan header H2, WHO_AM_I, raw accel/gyro samples)");
    BT_LOG("           ENTRY n (entry cell along its side, from the robot's left: 0 = corner)");
    BT_LOG(" Maze    : GO | GOTO <x> <y> | POSE <x> <y> <N|E|S|W> | RESETMAP | MAP | WHERE");
    BT_LOG("           MAZEDEF <n> <hex> (load drawn maze) | WALLSREP");
    BT_LOG(" Config  : SIZE n | GOAL x y | PITCH mm | TRACK mm | VRUN v | VTURN v");
    BT_LOG("           KC <p> <d> | HOME 0|1 | ALIGN 0|1 | SENSE 0|1 | WALLUPD 0|1 | PIVOTS 0|1 | CFG");
    BT_LOG(" Settings: SAVE (keep across power-off) | LOAD | DEFAULTS");
    BT_LOG(" Misc    : BAT ENC STAT PING | UPDATE or DFU (RATROCKET USB drive: copy a .uf2 to flash)");
    BT_LOG("           Button PB2 = %s.", s_button_escape ? "ESCAPE" : "GO");
}

static void wait_idle(void)
{
    while (Motion_IsBusy()) {
        if (abort_check()) {
            Motion_Stop();
        }
        osDelay(LOOP_MS);
    }
}

/* Robot placed by hand exactly in the middle of a cell with walls on both
 * sides. Learns each side's "centred" reading separately (sensors may be
 * aimed differently) and, if there is a wall ahead, the front stop distance. */
#define CAL_SIDE_MAX_MM  100U    /* a side wall farther than this is not "beside" */
#define CAL_FRONT_MAX_MM 120U
static void cmd_cal(void)
{
    MazeConfig *c = &g_maze_cfg;
    MazeWalls w;
    Maze_Sense(&w);
    BT_LOG("CAL readings: F=%u L=%u R=%u", w.df, w.dl, w.dr);
    if (w.dl > CAL_SIDE_MAX_MM || w.dr > CAL_SIDE_MAX_MM) {
        BT_LOG("CAL failed: need walls close on the left AND right (both < %u mm)",
               (unsigned)CAL_SIDE_MAX_MM);
        return;
    }
    c->center_l = w.dl;
    c->center_r = w.dr;
    uint16_t far_side = (w.dl > w.dr) ? w.dl : w.dr;
    /* A missing wall puts the next one about one pitch further away. */
    c->thr_side = (uint16_t)(far_side + c->pitch_mm / 2.0f);
    if (w.df <= CAL_FRONT_MAX_MM) {
        c->front_center = w.df;
        c->thr_front = (uint16_t)(c->front_center + c->pitch_mm / 2.0f);
        BT_LOG("CAL ok: centred L=%u R=%u F=%u -> wall if side<%u front<%u",
               c->center_l, c->center_r, c->front_center, c->thr_side, c->thr_front);
    } else {
        BT_LOG("CAL ok (sides only): centred L=%u R=%u -> wall if side<%u. "
               "Repeat in a cell with a wall ahead to learn the front stop distance.",
               c->center_l, c->center_r, c->thr_side);
    }
}

/* Self-calibration without hand-centring: read both sides, spin 180 deg on
 * the spot, read again (each sensor now faces the other wall), spin back.
 *   robot offset (right of centre) = (L_before - L_after) / 2
 *   centred reading per side       = average of its two readings
 * Mounting/aim differences between the sensors cancel out. */
static void cmd_calspin(void)
{
    MazeConfig *c = &g_maze_cfg;
    MazeWalls a, b;
    Maze_Sense(&a);
    BT_LOG("CALSPIN before: L=%u R=%u", a.dl, a.dr);
    if (a.dl > CAL_SIDE_MAX_MM || a.dr > CAL_SIDE_MAX_MM) {
        BT_LOG("CALSPIN failed: need walls close on both sides (< %u mm)", (unsigned)CAL_SIDE_MAX_MM);
        return;
    }
    Maze_SetAbortCheck(abort_check);
    if (!Maze_Spin(REL_BACK)) {
        BT_LOG("CALSPIN failed: turn aborted");
        return;
    }
    osDelay(300);
    Maze_Sense(&b);
    BT_LOG("CALSPIN after 180: L=%u R=%u", b.dl, b.dr);
    bool ok = (b.dl <= CAL_SIDE_MAX_MM && b.dr <= CAL_SIDE_MAX_MM);
    if (!Maze_Spin(REL_BACK)) {
        BT_LOG("CALSPIN: turn back aborted");
    }
    if (!ok) {
        BT_LOG("CALSPIN failed: lost a wall after the spin (robot moved or turn was off)");
        return;
    }
    c->center_l = (uint16_t)((a.dl + b.dl + 1U) / 2U);
    c->center_r = (uint16_t)((a.dr + b.dr + 1U) / 2U);
    uint16_t far_side = (c->center_l > c->center_r) ? c->center_l : c->center_r;
    c->thr_side = (uint16_t)(far_side + c->pitch_mm / 2.0f);
    float offset = ((float)a.dl - (float)b.dl) / 2.0f;    /* > 0: right of centre */
    BT_LOG("CALSPIN ok: centred L=%u R=%u (sensor difference %d mm), wall if side<%u",
           c->center_l, c->center_r, (int)c->center_r - (int)c->center_l, c->thr_side);
    BT_LOG("CALSPIN: robot is %d mm %s of centre", (int)fabsf(offset),
           offset > 0.0f ? "RIGHT" : "LEFT");
}

/* Shift sideways onto the centre line: turn 90 deg towards it, drive the
 * offset, turn back. Needs calibrated side centres (CAL or CALSPIN). */
#define CENTER_DEADBAND_MM 3.0f
#define CENTER_MAX_MM      40.0f
static void cmd_center(void)
{
    const MazeConfig *c = &g_maze_cfg;
    MazeWalls w;
    Maze_Sense(&w);
    float el = (float)w.dl - (float)c->center_l;
    float er = (float)w.dr - (float)c->center_r;
    float e;                                       /* > 0: right of centre */
    if (w.left && w.right && w.dl < US_FAR_MM && w.dr < US_FAR_MM) {
        e = (el - er) * 0.5f;
    } else if (w.left && w.dl < US_FAR_MM) {
        e = el;
    } else if (w.right && w.dr < US_FAR_MM) {
        e = -er;
    } else {
        BT_LOG("CENTER: no side wall to measure against");
        return;
    }
    BT_LOG("CENTER: L=%u R=%u -> %d mm %s of centre", w.dl, w.dr, (int)fabsf(e),
           e > 0.0f ? "right" : "left");
    if (fabsf(e) < CENTER_DEADBAND_MM) {
        BT_LOG("CENTER: already centred");
        return;
    }
    if (fabsf(e) > CENTER_MAX_MM) {
        BT_LOG("CENTER: offset too large - calibrate first (CALSPIN) or check the walls");
        return;
    }
    Maze_SetAbortCheck(abort_check);
    RelDir towards = (e > 0.0f) ? REL_LEFT : REL_RIGHT;
    RelDir back = (e > 0.0f) ? REL_RIGHT : REL_LEFT;
    if (!Maze_Spin(towards)) return;
    if (Motion_Forward(fabsf(e), 40.0f, 200.0f)) {
        wait_idle();
    }
    if (!Maze_Spin(back)) return;
    osDelay(200);
    Maze_Sense(&w);
    BT_LOG("CENTER done: L=%u R=%u", w.dl, w.dr);
}

static void handle_command(char *line)
{
    BT_LOG("> %s", line);
    for (char *p = line; *p; ++p) *p = (char)toupper((unsigned char)*p);
    if (strncmp(line, "MAZEDEF ", 8) == 0) {
        cmd_mazedef(line + 8);
        return;
    }
    char *cmd = strtok(line, " ");
    char *a1 = strtok(NULL, " ");
    char *a2 = strtok(NULL, " ");
    char *a3 = strtok(NULL, " ");
    MazeConfig *c = &g_maze_cfg;
    float v1, v2, v3;

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
        Motion_Stop();
        s_us_stream_ms = 0;
        BT_LOG("stopped");
    } else if (strcmp(cmd, "US") == 0) {
        print_us();
    } else if (strcmp(cmd, "USW") == 0) {
        s_us_stream_ms = (parse_f(a1, &v1) && v1 >= 100.0f) ? (uint32_t)v1 : 0U;
        BT_LOG("US stream %s", s_us_stream_ms ? "on" : "off");
    } else if (strcmp(cmd, "USMAP") == 0) {
        if (!parse_f(a1, &v1) || !parse_f(a2, &v2) || !parse_f(a3, &v3) ||
            v1 < 0 || v1 > 3 || v2 < 0 || v2 > 3 || v3 < 0 || v3 > 3) {
            BT_LOG("usage: USMAP <front> <left> <right>  (1-3 = US1-US3, 0 = none)");
        } else {
            c->ch_front = v1 ? (uint8_t)(v1 - 1) : MAZE_CH_NONE;
            c->ch_left = v2 ? (uint8_t)(v2 - 1) : MAZE_CH_NONE;
            c->ch_right = v3 ? (uint8_t)(v3 - 1) : MAZE_CH_NONE;
            print_cfg();
        }
    } else if (strcmp(cmd, "WALLS") == 0) {
        MazeWalls w;
        Maze_Sense(&w);
        BT_LOG("WALLS: F=%u%s L=%u%s R=%u%s", w.df, w.front ? "(wall)" : "",
               w.dl, w.left ? "(wall)" : "", w.dr, w.right ? "(wall)" : "");
    } else if (strcmp(cmd, "CAL") == 0) {
        cmd_cal();
    } else if (strcmp(cmd, "CALSPIN") == 0) {
        cmd_calspin();
    } else if (strcmp(cmd, "CENTER") == 0) {
        cmd_center();
    } else if (strcmp(cmd, "THR") == 0) {
        if (parse_f(a1, &v1) && parse_f(a2, &v2) && v1 > 0 && v2 > 0) {
            c->thr_front = (uint16_t)v1;
            c->thr_side = (uint16_t)v2;
        }
        print_cfg();
    } else if (strcmp(cmd, "FWD") == 0) {
        v2 = c->v_run;
        if (!parse_f(a1, &v1) || fabsf(v1) > 1000.0f || (a2 && !parse_f(a2, &v2))) {
            BT_LOG("usage: FWD <mm> [v]");
        } else if (!Motion_Forward(v1, v2, c->a_run)) {
            BT_LOG("FWD rejected");
        } else {
            wait_idle();
            BT_LOG("FWD done (event %u)", Motion_LastEvent());
        }
    } else if (strcmp(cmd, "TURN") == 0) {
        v2 = c->v_turn;
        if (!parse_f(a1, &v1) || fabsf(v1) > 1080.0f || (a2 && !parse_f(a2, &v2))) {
            BT_LOG("usage: TURN <deg> [v]  (+ = right/clockwise)");
        } else if (!Motion_Turn(v1, v2, c->a_turn)) {
            BT_LOG("TURN rejected (left turns need the left reverse fix: use TURN 270)");
        } else {
            wait_idle();
            BT_LOG("TURN done (event %u)", Motion_LastEvent());
        }
    } else if (strcmp(cmd, "PIVOT") == 0) {
        v2 = c->v_turn;
        if (!parse_f(a1, &v1) || fabsf(v1) > 360.0f || (a2 && !parse_f(a2, &v2))) {
            BT_LOG("usage: PIVOT <deg> [v]  (+ = right, about the right wheel)");
        } else if (!Motion_Pivot(v1, v2, c->a_turn)) {
            BT_LOG("PIVOT rejected");
        } else {
            wait_idle();
            BT_LOG("PIVOT done (event %u)", Motion_LastEvent());
        }
    } else if (strcmp(cmd, "PIVOTS") == 0) {
        if (parse_f(a1, &v1)) c->pivot_turns = (v1 != 0.0f);
        print_cfg();
    } else if (strcmp(cmd, "SAVE") == 0) {
        if (Motion_IsBusy()) {
            BT_LOG("SAVE: robot is moving - try again when it stands still");
        } else {
            BT_LOG("SAVE: writing flash (the robot freezes ~2 s)...");
            osDelay(50);                       /* let the line go out first */
            BT_LOG("SAVE %s", Settings_Save(s_button_escape) ? "ok - kept across power-off" : "FAILED");
        }
    } else if (strcmp(cmd, "LOAD") == 0) {
        BT_LOG("LOAD %s", Settings_Load(&s_button_escape) ? "ok" : "failed - nothing saved");
        print_cfg();
    } else if (strcmp(cmd, "DEFAULTS") == 0) {
        Maze_DefaultConfig(c);
        Motion_SetTrackWidth(MOTION_TRACK_MM_DEFAULT);
        (void)Motion_SetDistanceScale(1.0f);
        (void)Motion_SetTrim(0.0f);
        s_button_escape = true;
        BT_LOG("Defaults restored; saved settings %s", Settings_Erase() ? "erased" : "NOT erased");
        print_cfg();
    } else if (strcmp(cmd, "CELL") == 0) {
        Maze_SetAbortCheck(abort_check);
        BT_LOG("CELL %s", Maze_MoveCell() ? "done" : "failed");
    } else if (strcmp(cmd, "GO") == 0) {
        Maze_SetAbortCheck(abort_check);
        (void)Maze_Run();
    } else if (strcmp(cmd, "ESCAPE") == 0) {
        Maze_SetAbortCheck(abort_check);
        (void)Maze_Escape();
    } else if (strcmp(cmd, "IMU") == 0) {
        Imu_Probe();
    } else if (strcmp(cmd, "PUSH") == 0) {
        Maze_SetAbortCheck(abort_check);
        (void)Maze_Push();
    } else if (strcmp(cmd, "ENTRY") == 0) {
        if (parse_f(a1, &v1) && v1 >= 0 && v1 < c->size) {
            c->entry_x = (uint8_t)v1;
        } else {
            BT_LOG("usage: ENTRY <0..%u>  (0 = outer wall on the robot's left as it drives in)",
                   (unsigned)(c->size - 1U));
        }
        BT_LOG("Entry cell: %u of %u along the entry side (from the robot's left)",
               c->entry_x, c->size);
    } else if (strcmp(cmd, "BTN") == 0) {
        if (a1 != NULL && strcmp(a1, "GO") == 0) s_button_escape = false;
        else if (a1 != NULL && strcmp(a1, "ESCAPE") == 0) s_button_escape = true;
        BT_LOG("Button PB2 = %s", s_button_escape ? "ESCAPE" : "GO");
    } else if (strcmp(cmd, "GOTO") == 0) {
        if (!parse_f(a1, &v1) || !parse_f(a2, &v2) || v1 < 0 || v2 < 0) {
            BT_LOG("usage: GOTO <x> <y>");
        } else {
            Maze_SetAbortCheck(abort_check);
            (void)Maze_GoTo((CELL){(uint8_t)v1, (uint8_t)v2});
        }
    } else if (strcmp(cmd, "POSE") == 0) {
        ABSOLUTE_DIRECTION d;
        if (!parse_f(a1, &v1) || !parse_f(a2, &v2) || !parse_dir(a3, &d) ||
            v1 < 0 || v2 < 0 || !Maze_SetPose((uint8_t)v1, (uint8_t)v2, d)) {
            BT_LOG("usage: POSE <x> <y> <N|E|S|W>");
        }
    } else if (strcmp(cmd, "RESETMAP") == 0) {
        Maze_ResetMap();
    } else if (strcmp(cmd, "MAP") == 0) {
        Maze_PrintMap();
    } else if (strcmp(cmd, "WHERE") == 0) {
        CELL p;
        ABSOLUTE_DIRECTION d;
        Maze_GetPose(&p, &d);
        BT_LOG("[POS] %u %u %c", p.x, p.y, "NSWE"[d]);
    } else if (strcmp(cmd, "SIZE") == 0) {
        if (parse_f(a1, &v1) && v1 >= 2 && v1 <= MAZE_DIMENSIONS_MAX) {
            c->size = (uint8_t)v1;
            Maze_ResetMap();
        } else {
            BT_LOG("usage: SIZE <2..%u>", MAZE_DIMENSIONS_MAX);
        }
    } else if (strcmp(cmd, "GOAL") == 0) {
        if (parse_f(a1, &v1) && parse_f(a2, &v2) && v1 >= 0 && v2 >= 0 &&
            v1 < c->size && v2 < c->size) {
            c->goal = (CELL){(uint8_t)v1, (uint8_t)v2};
        }
        print_cfg();
    } else if (strcmp(cmd, "PITCH") == 0) {
        if (parse_f(a1, &v1) && v1 >= 50.0f && v1 <= 400.0f) c->pitch_mm = v1;
        print_cfg();
    } else if (strcmp(cmd, "TRACK") == 0) {
        if (parse_f(a1, &v1)) Motion_SetTrackWidth(v1);
        print_cfg();
    } else if (strcmp(cmd, "CALDIST") == 0) {
        /* Drove <commanded> but the ruler says <actual>: scale counts/mm. */
        if (!parse_f(a1, &v1) || !parse_f(a2, &v2) || v1 <= 0.0f || v2 <= 0.0f ||
            !Motion_SetDistanceScale(Motion_GetDistanceScale() * v1 / v2)) {
            BT_LOG("usage: CALDIST <commanded mm> <actual mm> (robot idle, ratio 0.5..2)");
        }
        print_cfg();
    } else if (strcmp(cmd, "TRIM") == 0) {
        if (!parse_f(a1, &v1) || !Motion_SetTrim(v1)) {
            BT_LOG("usage: TRIM <-15..15 %%>  (+ = robot curves left; robot idle)");
        }
        print_cfg();
    } else if (strcmp(cmd, "VRUN") == 0) {
        if (parse_f(a1, &v1) && v1 >= 20.0f && v1 <= 160.0f) c->v_run = v1;
        print_cfg();
    } else if (strcmp(cmd, "VTURN") == 0) {
        if (parse_f(a1, &v1) && v1 >= 20.0f && v1 <= 160.0f) c->v_turn = v1;
        print_cfg();
    } else if (strcmp(cmd, "KC") == 0) {
        if (parse_f(a1, &v1) && parse_f(a2, &v2) && v1 >= 0 && v2 >= 0) {
            c->kc_p = v1;
            c->kc_d = v2;
        }
        print_cfg();
    } else if (strcmp(cmd, "HOME") == 0) {
        if (parse_f(a1, &v1)) c->return_home = (v1 != 0.0f);
        print_cfg();
    } else if (strcmp(cmd, "ALIGN") == 0) {
        if (parse_f(a1, &v1)) c->align_front = (v1 != 0.0f);
        print_cfg();
    } else if (strcmp(cmd, "SENSE") == 0) {
        if (parse_f(a1, &v1)) c->sense = (v1 != 0.0f);
        print_cfg();
    } else if (strcmp(cmd, "WALLUPD") == 0) {
        if (parse_f(a1, &v1)) c->wall_update = (v1 != 0.0f);
        print_cfg();
    } else if (strcmp(cmd, "WALLSREP") == 0) {
        Maze_ReportWalls();
    } else if (strcmp(cmd, "CFG") == 0) {
        print_cfg();
    } else if (strcmp(cmd, "BAT") == 0) {
        BT_LOG("BAT: %lu mV", (unsigned long)Motion_SupplyMv());
    } else if (strcmp(cmd, "ENC") == 0) {
        BT_LOG("ENC: L=%ld R=%ld", (long)Encoder_Left(), (long)Encoder_Right());
    } else if (strcmp(cmd, "STAT") == 0) {
        BT_LOG("STAT: drop bt=%lu wired=%lu heap_free=%u stack_free=%lu words",
               (unsigned long)BT_Log_DroppedCount(), (unsigned long)BT_Log_WiredDroppedCount(),
               (unsigned)xPortGetFreeHeapSize(), (unsigned long)uxTaskGetStackHighWaterMark(NULL));
    } else {
        BT_LOG("? unknown '%s' (type HELP)", cmd);
    }
}

void MazeApp_Run(uint8_t dip)
{
    Motor_Coast();
    Encoder_Init();
    BT_Log_SetMirrorUart1(true);   /* nothing else uses USART1 TX in this mode */
    Maze_DefaultConfig(&g_maze_cfg);
    Motion_Start();
    bool loaded = Settings_Load(&s_button_escape);
    Motion_SetTelemetryPeriod(0);  /* events only */
    osThreadNew(motion_event_task, NULL, &s_ev_attr);
    Ultrasonic_Start();
    Maze_ResetMap();
    (void)Maze_SetPose(0, 0, NORTH);

    BT_LOG("");
    BT_LOG("==== RatRocket Micromouse ====");
    BT_LOG("FW build: %s %s", __DATE__, __TIME__);
    BT_LOG("Mode: %s (DIP 0x%X)", DIP_ModeName(dip), dip);
    BT_LOG("Settings: %s", loaded ? "loaded from flash" : "firmware defaults (nothing saved)");
    BT_LOG("Left reverse %s; turns are %s", MOTION_LEFT_CAN_REVERSE ? "enabled" : "DISABLED (hw fault)",
           g_maze_cfg.pivot_turns ? "pivots" : "spins");
    print_cfg();
    BT_LOG("Type HELP for commands.");

    char line[48];
    uint32_t last_stream = HAL_GetTick();
    uint32_t pressed_since = 0;
    for (;;) {
        if (BT_Log_GetLine(line, sizeof(line))) {
            handle_command(line);
        }

        uint32_t now = HAL_GetTick();
        if (s_us_stream_ms != 0U && now - last_stream >= s_us_stream_ms) {
            last_stream = now;
            print_us();
        }

        /* PB2 button: press and release to start the demo run. */
        if (button_pressed()) {
            if (pressed_since == 0U) pressed_since = now;
        } else if (pressed_since != 0U) {
            if (now - pressed_since >= BUTTON_DEBOUNCE) {
                BT_LOG("[BTN] %s in %u ms", s_button_escape ? "ESCAPE" : "GO",
                       (unsigned)BUTTON_GO_DELAY);
                osDelay(BUTTON_GO_DELAY);
                Maze_SetAbortCheck(abort_check);
                if (s_button_escape) {
                    (void)Maze_Escape();
                } else {
                    (void)Maze_Run();
                }
            }
            pressed_since = 0U;
        }
        osDelay(LOOP_MS);
    }
}
