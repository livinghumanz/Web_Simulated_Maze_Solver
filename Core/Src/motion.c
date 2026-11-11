#include "motion.h"

#include <math.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "battery.h"
#include "encoder.h"
#include "imu.h"
#include "motor.h"

#define LOOP_HZ          1000.0f
#define DT               (1.0f / LOOP_HZ)
#define D_ALPHA          0.2f        /* low-pass on the D term (~5 ms)          */
#define VEL_WIN          20U         /* ms window for measured speed            */
#define SETTLE_MS        300U        /* hold position after the profile ends    */
#define FOLLOW_ERR_MAX   1000.0f     /* counts (~37 mm): blocked by a wall / stall.
                                        Was 3000 (~110 mm): the robot pushed a wall for >1 s. */
#define V_MIN_END        5.0f        /* mm/s creep so the profile always ends   */
#define STEER_FRACTION   0.4f        /* |steering| <= 40% of profile speed      */
#define SUPPLY_PERIOD_MS 100U        /* supply voltage sampling                 */
#define SUPPLY_MIN_MV    2500.0f     /* below this the reading is not trusted   */
#define SUPPLY_ALPHA     0.3f
#define COMP_MIN         0.35f
#define COMP_MAX         1.5f
#define PI_F             3.14159265f

typedef enum { CMD_FWD, CMD_TURN, CMD_PIVOT, CMD_SPEED, CMD_STOP } CmdType;

typedef struct {
    CmdType type;
    float p1, p2, p3;
    uint32_t ms;
} MotionCmd;

typedef enum { ST_IDLE, ST_FWD, ST_TURN, ST_SPEED, ST_SETTLE } State;

typedef struct {
    float cpm;          /* counts per mm                          */
    bool can_reverse;
    float ks_extra;     /* duty added to kstatic for this wheel   */
    float sgn;          /* direction of this wheel in FWD/TURN    */
    float start;        /* position at move start, counts         */
    float tgt;          /* target position, counts                */
    float v;            /* profile speed incl. steering, mm/s     */
    float v_cmd;        /* SPD mode set-point, mm/s               */
    float i, e_prev, d_f;
    float err;
    int16_t duty;
    int32_t hist[VEL_WIN];
} Wheel;

/* Tuned 2026-11-06, wheels lifted, USB power (re-tune on the floor):
 * KI 1 -> 6 cut cruise error at 150 mm/s from 20-80 to 2-5 counts;
 * KFF 0.16 -> 0.14 removed the wheels running ahead at 100 mm/s. */
static MotionGains s_gains = {
    .kp = 3.0f, .ki = 6.0f, .kd = 0.05f,
    /* From SWEEP @1 kHz on USB power: ~300 duty -> 1000 cps, 600 -> 3000 cps. */
    .kff = 0.14f, .kstatic = 130.0f,
};

static Wheel s_l, s_r;
static State s_state = ST_IDLE;
static float s_dist_total, s_dist_done, s_prof_v, s_vmax, s_accel;  /* FWD / TURN */
static volatile float s_new_total = -1.0f;                         /* FWD length request */
static volatile float s_steer;                                     /* mm/s, + = right */
static float s_steer_off;                                          /* mm integrated   */
static volatile float s_track_mm = MOTION_TRACK_MM_DEFAULT;
static float s_dist_scale = 1.0f;
static float s_trim_pct = 0.0f;
static volatile float s_supply_mv = MOTION_SUPPLY_REF_MV;
static float s_comp = 1.0f;
static uint32_t s_t, s_t_end, s_settle_t, s_supply_t;
static uint32_t s_hist_idx;
static volatile uint32_t s_tel_period = 100U;
static volatile bool s_busy;
static volatile uint8_t s_last_event = MOTION_EV_DONE;

static osMessageQueueId_t s_cmd_q;
static osMessageQueueId_t s_tel_q;
static osThreadId_t s_task;

static const osThreadAttr_t s_task_attr = {
    .name = "motion",
    .stack_size = 384 * 4,
    .priority = (osPriority_t)osPriorityHigh,
};

/* ---------------- helpers ---------------- */

static float clampf(float v, float lo, float hi)
{
    return (v < lo) ? lo : (v > hi) ? hi : v;
}

static void wheel_reset(Wheel *w, int32_t pos)
{
    w->start = w->tgt = (float)pos;
    w->v = w->v_cmd = 0.0f;
    w->i = w->e_prev = w->d_f = 0.0f;
    w->err = 0.0f;
    w->duty = 0;
}

static float wheel_speed_mm_s(const Wheel *w, int32_t pos)
{
    int32_t old = w->hist[s_hist_idx];
    return (float)(pos - old) * (1000.0f / (float)VEL_WIN) / w->cpm;
}

static int16_t wheel_pid(Wheel *w, int32_t pos)
{
    float e = w->tgt - (float)pos;
    float de = (e - w->e_prev) * LOOP_HZ;
    w->e_prev = e;
    w->d_f += D_ALPHA * (de - w->d_f);

    float v_cps = w->v * w->cpm;
    float u = s_gains.kff * v_cps + s_gains.kp * e + s_gains.kd * w->d_f + s_gains.ki * w->i;
    if (v_cps > 1.0f) {
        u += s_gains.kstatic + w->ks_extra;
    } else if (v_cps < -1.0f) {
        u -= s_gains.kstatic + w->ks_extra;
    }
    u *= s_comp;                   /* supply-voltage compensation */

    float u_max = (float)MOTOR_PWM_MAX;
    float u_min = w->can_reverse ? -u_max : 0.0f;
    if (u > u_max) {
        u = u_max;
    } else if (u < u_min) {
        u = u_min;
    } else {
        w->i += e * DT;            /* integrate only when not saturated */
    }
    w->err = e;
    w->duty = (int16_t)u;
    return w->duty;
}

static void push_sample(uint8_t event, int32_t pl, int32_t pr)
{
    MotionSample s = {
        .t_ms = s_t,
        .event = event,
        .vt_left = (int16_t)s_l.v,
        .vt_right = (int16_t)s_r.v,
        .v_left = (int16_t)wheel_speed_mm_s(&s_l, pl),
        .v_right = (int16_t)wheel_speed_mm_s(&s_r, pr),
        .err_left = (int16_t)s_l.err,
        .err_right = (int16_t)s_r.err,
        .duty_left = s_l.duty,
        .duty_right = s_r.duty,
        .dist_um = (int32_t)(s_dist_done * 1000.0f),
    };
    (void)osMessageQueuePut(s_tel_q, &s, 0, 0);   /* never wait */
}

/* ---------------- gyro-closed turns (2026-11-11) ----------------
 * TURN with GYROTURN 1 and a calibrated IMU: the encoder trapezoid still
 * drives the whole commanded angle (smooth, already tuned). Once the robot is
 * at rest the gyro-measured angle is compared with the command; if it is off
 * by more than GT_TOL_DEG a correction spin (again an encoder trapezoid,
 * continuing from the held wheel targets) is added, and so on:
 *     at rest -> measure -> |error| <= tol ? done : spin GAIN * error (* k) -> ...
 * k = encoder degrees per gyro degree in the main spin (wheel slip, track
 * width error); it scales the first correction only - the slower corrections
 * slip less than the main spin, and carrying k on over-corrected on the bench.
 * GAIN < 1 because on the bench (USB cable, light robot) a correction moved
 * the robot up to 2x the commanded angle: damped steps converge from one side
 * instead of alternating. Measuring only at rest makes
 * the gyro filter delay irrelevant; the phase is bounded by GT_MAX_CORR spins
 * and a time-out. If the gyro grossly disagrees with the encoders after the
 * main spin (wrong sign or axis, loose module) nothing is corrected. Pivots,
 * FWD and SPD never come here; with GYROTURN 0 or no calibrated IMU a turn
 * ends exactly as before (SETTLE_MS hold). */
#define GT_TOL_DEG          0.5f    /* done when |gyro error| <= this                */
#define GT_MAX_CORR         MOTION_GT_MAX_CORR   /* correction spins per turn (4) */
#define GT_GAIN             0.8f    /* fraction of the error corrected per spin      */
#define GT_PHASE_BASE_MS    2000U   /* correction phase time-out: base ...           */
#define GT_PHASE_MS_PER_DEG 5.0f    /*   ... + this per commanded degree             */
#define GT_SETTLE_MIN_MS    120U    /* after a spin hold at least this long, then    */
#define GT_STILL_MS         60U     /*   until the gyro read < GT_REST_DPS this long */
#define GT_SETTLE_MAX_MS    500U    /*   (or measure anyway after this)              */
#define GT_REST_DPS         2.0f
#define GT_RATIO_MIN        0.5f    /* main spin: gyro/command outside this range or */
#define GT_RATIO_MAX        1.5f    /*   the wrong sign: gyro not trusted (slip on   */
#define GT_SMALL_DEG        10.0f   /*   the bench reached 33 %); below 10 deg:      */
#define GT_SMALL_ERR_DEG    5.0f    /*   |error| > 5 deg instead                     */
#define GT_K_MIN            0.70f   /* k limits (bench: main-spin slip up to 35 %)  */
#define GT_K_MAX            1.30f

typedef struct {
    bool active;          /* the current move is a TURN: report it at the end  */
    bool gyro;            /* IMU present and calibrated at the start           */
    bool closing;         /* correcting on the gyro (GYROTURN on)              */
    bool measured;        /* main spin evaluated                               */
    float cmd, v, a;      /* command                                           */
    float h0;             /* gyro heading at the start                         */
    float k;              /* encoder deg per gyro deg                          */
    int32_t pl0, pr0;     /* wheel positions at the start                      */
    uint32_t t_phase;     /* s_t when the correction phase began               */
    uint16_t still_ms;
    uint8_t ncorr;
    uint8_t result;       /* MotionGyroResult                                  */
    float meas[GT_MAX_CORR];   /* gyro angle before each correction            */
} GyroTurn;

static GyroTurn s_gt;
/* GYROTURN setting. Default OFF (2026-11-11): gyro calibration and gyro-closed
 * turns are postponed until the gyro scale has been checked on the floor; off,
 * every turn is the unchanged encoder turn. */
static volatile bool s_gyro_turn_on = false;
static MotionTurnReport s_turn_rep;
static bool s_turn_rep_valid;

static float enc_turn_deg(int32_t pl, int32_t pr)
{
    float dl = (float)(pl - s_gt.pl0) / s_l.cpm;
    float dr = (float)(pr - s_gt.pr0) / s_r.cpm;
    return (dl - dr) / s_track_mm * (180.0f / PI_F);
}

static void gyro_turn_begin(const MotionCmd *c, int32_t pl, int32_t pr)
{
    memset(&s_gt, 0, sizeof(s_gt));
    s_gt.active = true;
    s_gt.cmd = c->p1;
    s_gt.v = c->p2;
    s_gt.a = c->p3;
    s_gt.k = 1.0f;
    s_gt.pl0 = pl;
    s_gt.pr0 = pr;
    s_gt.gyro = Imu_Present() && Imu_Calibrated();
    s_gt.closing = s_gt.gyro && s_gyro_turn_on;
    s_gt.h0 = s_gt.gyro ? Imu_HeadingDeg() : 0.0f;
    s_gt.result = s_gt.closing ? MOTION_GT_OK : MOTION_GT_ENCODER;
}

/* One more spin of deg (encoder degrees), continuing from the held targets. */
static void start_correction(float deg)
{
    float sgn = (deg >= 0.0f) ? 1.0f : -1.0f;
    s_l.start = s_l.tgt;
    s_r.start = s_r.tgt;
    s_l.sgn = sgn;
    s_r.sgn = -sgn;
    s_dist_total = PI_F * s_track_mm * fabsf(deg) / 360.0f;
    s_dist_done = 0.0f;
    s_prof_v = 0.0f;
    s_vmax = s_gt.v;            /* small corrections stay slow: triangle profile */
    s_accel = s_gt.a;
    s_steer_off = 0.0f;
    s_gt.still_ms = 0;
    s_gt.ncorr++;
    s_state = ST_TURN;
}

/* Called every tick in ST_SETTLE; true = the move is finished. */
static bool settle_done(int32_t pl, int32_t pr)
{
    uint32_t t = s_t - s_settle_t;
    if (!s_gt.active || !s_gt.closing) {
        return t >= SETTLE_MS;                       /* unchanged encoder behaviour */
    }
    if (!Imu_Present()) {
        s_gt.closing = false;
        s_gt.result = MOTION_GT_LOST;
        return t >= SETTLE_MS;
    }
    s_gt.still_ms = (fabsf(Imu_RateDps()) < GT_REST_DPS) ? (uint16_t)(s_gt.still_ms + 1U) : 0U;
    if (t < GT_SETTLE_MIN_MS || (s_gt.still_ms < GT_STILL_MS && t < GT_SETTLE_MAX_MS)) {
        return false;                                /* not at rest yet */
    }
    float turned = Imu_HeadingDeg() - s_gt.h0;
    float err = s_gt.cmd - turned;
    if (!s_gt.measured) {                            /* the main spin has ended */
        s_gt.measured = true;
        s_gt.t_phase = s_t;
        bool trusted;
        if (fabsf(s_gt.cmd) >= GT_SMALL_DEG) {
            float ratio = turned / s_gt.cmd;         /* negative: wrong sign */
            trusted = (ratio >= GT_RATIO_MIN && ratio <= GT_RATIO_MAX);
        } else {
            trusted = (fabsf(err) <= GT_SMALL_ERR_DEG);
        }
        if (!trusted) {
            s_gt.closing = false;
            s_gt.result = MOTION_GT_DISAGREE;
            return t >= SETTLE_MS;
        }
        if (fabsf(turned) >= GT_SMALL_DEG) {
            s_gt.k = clampf(enc_turn_deg(pl, pr) / turned, GT_K_MIN, GT_K_MAX);
        }
    }
    if (fabsf(err) <= GT_TOL_DEG) {
        s_gt.result = MOTION_GT_OK;
        return true;
    }
    uint32_t phase_ms = GT_PHASE_BASE_MS + (uint32_t)(GT_PHASE_MS_PER_DEG * fabsf(s_gt.cmd));
    if (s_gt.ncorr >= GT_MAX_CORR || s_t - s_gt.t_phase >= phase_ms ||
        !Motion_CanTurn(err > 0.0f)) {
        s_gt.result = MOTION_GT_LIMIT;
        return true;
    }
    s_gt.meas[s_gt.ncorr] = turned;
    start_correction(GT_GAIN * err * ((s_gt.ncorr == 0U) ? s_gt.k : 1.0f));
    return false;
}

static void gyro_turn_report(uint8_t event, int32_t pl, int32_t pr)
{
    MotionTurnReport r;
    memset(&r, 0, sizeof(r));
    r.cmd_deg = s_gt.cmd;
    r.enc_deg = enc_turn_deg(pl, pr);
    r.gyro_valid = s_gt.gyro && Imu_Present();
    if (r.gyro_valid) {
        r.heading_deg = Imu_HeadingDeg();
        r.gyro_deg = r.heading_deg - s_gt.h0;
    }
    r.ms = s_t;
    r.event = event;
    r.result = (event == MOTION_EV_DONE) ? s_gt.result : MOTION_GT_ABORTED;
    r.corrections = s_gt.ncorr;
    for (uint32_t i = 0; i < GT_MAX_CORR; i++) {
        r.meas[i] = s_gt.meas[i];
    }
    taskENTER_CRITICAL();
    s_turn_rep = r;
    s_turn_rep_valid = true;
    taskEXIT_CRITICAL();
    s_gt.active = false;
}

static void go_idle(uint8_t event, int32_t pl, int32_t pr)
{
    Motor_Coast();
    s_l.duty = s_r.duty = 0;
    push_sample(event, pl, pr);
    s_state = ST_IDLE;
    s_last_event = event;
    if (s_gt.active) {
        gyro_turn_report(event, pl, pr);   /* before s_busy: TURN reads it next */
    }
    s_busy = false;
}

static void start_move(State st, int32_t pl, int32_t pr)
{
    s_gt.active = false;                   /* set again by CMD_TURN only */
    wheel_reset(&s_l, pl);
    wheel_reset(&s_r, pr);
    s_steer = 0.0f;
    s_steer_off = 0.0f;
    s_t = 0;
    s_state = st;
    push_sample(MOTION_EV_START, pl, pr);
}

static void start_profile(State st, float dist, float sgn_l, float sgn_r,
                          float vmax, float accel, int32_t pl, int32_t pr)
{
    start_move(st, pl, pr);
    s_l.sgn = sgn_l;
    s_r.sgn = sgn_r;
    s_dist_total = dist;
    s_dist_done = 0.0f;
    s_new_total = -1.0f;
    s_prof_v = 0.0f;
    s_vmax = vmax;
    s_accel = accel;
}

static void handle_cmd(const MotionCmd *c, int32_t pl, int32_t pr)
{
    switch (c->type) {
    case CMD_STOP:
        if (s_state != ST_IDLE) {
            go_idle(MOTION_EV_STOPPED, pl, pr);
        }
        break;
    case CMD_FWD: {
        float sgn = (c->p1 >= 0.0f) ? 1.0f : -1.0f;
        start_profile(ST_FWD, fabsf(c->p1), sgn, sgn, c->p2, c->p3, pl, pr);
        break;
    }
    case CMD_TURN: {
        /* Clockwise: left wheel forward, right wheel backward. */
        float sgn = (c->p1 >= 0.0f) ? 1.0f : -1.0f;
        float arc = PI_F * s_track_mm * fabsf(c->p1) / 360.0f;
        start_profile(ST_TURN, arc, sgn, -sgn, c->p2, c->p3, pl, pr);
        gyro_turn_begin(c, pl, pr);        /* gyro-closed turns (2026-11-11) */
        break;
    }
    case CMD_PIVOT: {
        /* Pivot about the inner wheel, which stays still: only the outer
         * wheel drives forward, along an arc of radius = track width.
         * Clockwise (right): left wheel drives. Anticlockwise (left): right. */
        float arc = PI_F * s_track_mm * fabsf(c->p1) / 180.0f;
        bool cw = (c->p1 >= 0.0f);
        start_profile(ST_TURN, arc, cw ? 1.0f : 0.0f, cw ? 0.0f : 1.0f, c->p2, c->p3, pl, pr);
        break;
    }
    case CMD_SPEED:
        start_move(ST_SPEED, pl, pr);
        s_l.v_cmd = c->p1;
        s_r.v_cmd = c->p2;
        s_accel = c->p3;
        s_t_end = c->ms;
        break;
    }
}

static float approach(float v, float target, float step)
{
    if (v < target) {
        return (v + step > target) ? target : v + step;
    }
    return (v - step < target) ? target : v - step;
}

/* Trapezoid for FWD / TURN: a single speed magnitude s_prof_v shared by both
 * wheels, signed per wheel by sgn; steering is added on straight moves only. */
static bool profile_step_trapezoid(void)
{
    if (s_state == ST_FWD && s_new_total >= 0.0f) {
        s_dist_total = (s_new_total > s_dist_done) ? s_new_total : s_dist_done;
        s_new_total = -1.0f;
    }
    float rem = s_dist_total - s_dist_done;
    float v = s_prof_v + s_accel * DT;
    float v_stop = sqrtf(2.0f * s_accel * (rem > 0.0f ? rem : 0.0f));
    if (v > s_vmax) v = s_vmax;
    if (v > v_stop) v = v_stop;
    if (v < V_MIN_END) v = V_MIN_END;

    float step = v * DT;
    bool done = false;
    if (step >= rem) {
        step = rem;
        v = 0.0f;
        done = true;
    }
    s_dist_done += step;
    s_prof_v = v;

    float steer = 0.0f;
    if (s_state == ST_FWD && !done) {
        float lim = STEER_FRACTION * v;
        steer = clampf(s_steer, -lim, lim);
    }
    s_steer_off += steer * DT;

    s_l.v = s_l.sgn * v + steer;
    s_r.v = s_r.sgn * v - steer;
    s_l.tgt = s_l.start + (s_l.sgn * s_dist_done + s_steer_off) * s_l.cpm;
    s_r.tgt = s_r.start + (s_r.sgn * s_dist_done - s_steer_off) * s_r.cpm;
    return done;
}

static bool profile_step_speed(void)
{
    if (s_t >= s_t_end) {
        s_l.v_cmd = s_r.v_cmd = 0.0f;
    }
    s_l.v = approach(s_l.v, s_l.v_cmd, s_accel * DT);
    s_r.v = approach(s_r.v, s_r.v_cmd, s_accel * DT);
    s_l.tgt += s_l.v * s_l.cpm * DT;
    s_r.tgt += s_r.v * s_r.cpm * DT;
    return (s_t >= s_t_end) && s_l.v == 0.0f && s_r.v == 0.0f;
}

static void sample_supply(void)
{
    float mv = (float)Battery_ReadMv();
    if (mv < SUPPLY_MIN_MV) {
        return;
    }
    s_supply_mv += SUPPLY_ALPHA * (mv - s_supply_mv);
    s_comp = clampf(MOTION_SUPPLY_REF_MV / s_supply_mv, COMP_MIN, COMP_MAX);
}

/* ---------------- control task ---------------- */

static void motion_task(void *arg)
{
    (void)arg;
    Encoder_Update();
    int32_t pl = Encoder_Left();
    int32_t pr = Encoder_Right();
    for (uint32_t k = 0; k < VEL_WIN; k++) {
        s_l.hist[k] = pl;
        s_r.hist[k] = pr;
    }

    TickType_t wake = xTaskGetTickCount();
    for (;;) {
        vTaskDelayUntil(&wake, 1);

        Encoder_Update();
        pl = Encoder_Left();
        pr = Encoder_Right();

        if (++s_supply_t >= SUPPLY_PERIOD_MS) {
            s_supply_t = 0;
            sample_supply();
        }

        MotionCmd c;
        while (osMessageQueueGet(s_cmd_q, &c, NULL, 0) == osOK) {
            handle_cmd(&c, pl, pr);
        }

        if (s_state != ST_IDLE) {
            s_t++;
            bool ended = false;
            if (s_state == ST_FWD || s_state == ST_TURN) {
                ended = profile_step_trapezoid();
            } else if (s_state == ST_SPEED) {
                ended = profile_step_speed();
            }
            if (ended) {
                s_state = ST_SETTLE;
                s_settle_t = s_t;
            }

            int16_t dl = wheel_pid(&s_l, pl);
            int16_t dr = wheel_pid(&s_r, pr);
            Motor_SetPwm(dl, dr);

            if (fabsf(s_l.err) > FOLLOW_ERR_MAX || fabsf(s_r.err) > FOLLOW_ERR_MAX) {
                go_idle(MOTION_EV_FOLLOW_ERR, pl, pr);
            } else if (s_state == ST_SETTLE && settle_done(pl, pr)) {   /* SETTLE_MS, or gyro check */
                go_idle(MOTION_EV_DONE, pl, pr);
            } else if (s_tel_period != 0U && (s_t % s_tel_period) == 0U) {
                push_sample(MOTION_EV_SAMPLE, pl, pr);
            }
        }

        /* Speed-measurement history (ring buffer, one slot per ms). */
        s_l.hist[s_hist_idx] = pl;
        s_r.hist[s_hist_idx] = pr;
        s_hist_idx = (s_hist_idx + 1U) % VEL_WIN;
    }
}

/* ---------------- public API ---------------- */

static void update_cpm(void)
{
    float base_l = ENC_CPR_LEFT / (PI_F * WHEEL_DIAMETER_MM);
    float base_r = ENC_CPR_RIGHT / (PI_F * WHEEL_DIAMETER_MM);
    s_l.cpm = base_l * s_dist_scale * (1.0f + s_trim_pct / 200.0f);
    s_r.cpm = base_r * s_dist_scale * (1.0f - s_trim_pct / 200.0f);
}

bool Motion_SetDistanceScale(float scale)
{
    if (s_busy || scale < 0.5f || scale > 2.0f) {
        return false;
    }
    s_dist_scale = scale;
    update_cpm();
    return true;
}

float Motion_GetDistanceScale(void)
{
    return s_dist_scale;
}

bool Motion_SetTrim(float percent)
{
    if (s_busy || percent < -15.0f || percent > 15.0f) {
        return false;
    }
    s_trim_pct = percent;
    update_cpm();
    return true;
}

float Motion_GetTrim(void)
{
    return s_trim_pct;
}

void Motion_Start(void)
{
    if (s_task != NULL) {
        return;
    }
    Motor_Coast();
    Motor_SetPwmFrequency(MOTION_PWM_HZ);

    update_cpm();
    s_l.can_reverse = (MOTION_LEFT_CAN_REVERSE != 0);
    s_r.can_reverse = (MOTION_RIGHT_CAN_REVERSE != 0);
    s_l.ks_extra = MOTION_KSTATIC_LEFT_EXTRA;
    s_r.ks_extra = 0.0f;

    s_cmd_q = osMessageQueueNew(4, sizeof(MotionCmd), NULL);
    s_tel_q = osMessageQueueNew(16, sizeof(MotionSample), NULL);
    s_task = osThreadNew(motion_task, NULL, &s_task_attr);
}

static bool send_cmd(const MotionCmd *c)
{
    s_busy = true;
    if (osMessageQueuePut(s_cmd_q, c, 0, 0) != osOK) {
        s_busy = false;
        return false;
    }
    return true;
}

bool Motion_Forward(float mm, float v_max_mm_s, float accel_mm_s2)
{
    if (s_busy || mm == 0.0f || v_max_mm_s <= 0.0f || accel_mm_s2 <= 0.0f) {
        return false;
    }
    if (mm < 0.0f && (!s_l.can_reverse || !s_r.can_reverse)) {
        return false;
    }
    MotionCmd c = { .type = CMD_FWD, .p1 = mm, .p2 = v_max_mm_s, .p3 = accel_mm_s2 };
    return send_cmd(&c);
}

bool Motion_CanTurn(bool clockwise)
{
    /* Clockwise needs the right wheel backwards, anticlockwise the left. */
    return clockwise ? s_r.can_reverse : s_l.can_reverse;
}

bool Motion_Turn(float deg, float v_wheel_mm_s, float accel_mm_s2)
{
    if (s_busy || deg == 0.0f || v_wheel_mm_s <= 0.0f || accel_mm_s2 <= 0.0f) {
        return false;
    }
    if (!Motion_CanTurn(deg > 0.0f)) {
        return false;
    }
    MotionCmd c = { .type = CMD_TURN, .p1 = deg, .p2 = v_wheel_mm_s, .p3 = accel_mm_s2 };
    return send_cmd(&c);
}

void Motion_SetGyroTurn(bool on)
{
    s_gyro_turn_on = on;        /* read at the start of each turn */
}

bool Motion_GetGyroTurn(void)
{
    return s_gyro_turn_on;
}

bool Motion_GyroTurnActive(void)
{
    return s_gyro_turn_on && Imu_Present() && Imu_Calibrated();
}

bool Motion_GetTurnReport(MotionTurnReport *r)
{
    taskENTER_CRITICAL();
    bool valid = s_turn_rep_valid;
    if (valid) {
        *r = s_turn_rep;
    }
    taskEXIT_CRITICAL();
    return valid;
}

const char *Motion_GyroResultName(uint8_t result)
{
    switch (result) {
    case MOTION_GT_ENCODER:  return "encoder turn";
    case MOTION_GT_OK:       return "gyro ok";
    case MOTION_GT_LIMIT:    return "gyro limit";
    case MOTION_GT_DISAGREE: return "gyro disagrees, not corrected";
    case MOTION_GT_LOST:     return "gyro lost";
    case MOTION_GT_ABORTED:  return "aborted";
    default:                 return "?";
    }
}

bool Motion_Pivot(float deg, float v_wheel_mm_s, float accel_mm_s2)
{
    if (s_busy || deg == 0.0f || v_wheel_mm_s <= 0.0f || accel_mm_s2 <= 0.0f) {
        return false;
    }
    MotionCmd c = { .type = CMD_PIVOT, .p1 = deg, .p2 = v_wheel_mm_s, .p3 = accel_mm_s2 };
    return send_cmd(&c);
}

bool Motion_Speed(float v_left_mm_s, float v_right_mm_s, uint32_t ms, float accel_mm_s2)
{
    if (s_busy || ms == 0U || accel_mm_s2 <= 0.0f) {
        return false;
    }
    if ((v_left_mm_s < 0.0f && !s_l.can_reverse) || (v_right_mm_s < 0.0f && !s_r.can_reverse)) {
        return false;
    }
    MotionCmd c = { .type = CMD_SPEED, .p1 = v_left_mm_s, .p2 = v_right_mm_s,
                    .p3 = accel_mm_s2, .ms = ms };
    return send_cmd(&c);
}

void Motion_SetSteering(float mm_s)
{
    s_steer = mm_s;
}

float Motion_DistanceDone(void)
{
    return s_dist_done;
}

void Motion_SetForwardTotal(float mm)
{
    if (s_busy && mm >= 0.0f) {
        s_new_total = mm;
    }
}

void Motion_Stop(void)
{
    MotionCmd c = { .type = CMD_STOP };
    (void)osMessageQueuePut(s_cmd_q, &c, 0, 0);
}

bool Motion_IsBusy(void)
{
    return s_busy;
}

uint8_t Motion_LastEvent(void)
{
    return s_last_event;
}

void Motion_SetTrackWidth(float mm)
{
    if (mm > 20.0f && mm < 300.0f) {
        s_track_mm = mm;
    }
}

float Motion_GetTrackWidth(void)
{
    return s_track_mm;
}

uint32_t Motion_SupplyMv(void)
{
    return (uint32_t)s_supply_mv;
}

void Motion_GetGains(MotionGains *g)
{
    taskENTER_CRITICAL();
    *g = s_gains;
    taskEXIT_CRITICAL();
}

void Motion_SetGains(const MotionGains *g)
{
    taskENTER_CRITICAL();
    s_gains = *g;
    taskEXIT_CRITICAL();
}

void Motion_SetTelemetryPeriod(uint32_t ms)
{
    s_tel_period = ms;
}

bool Motion_GetSample(MotionSample *s, uint32_t timeout_ms)
{
    return osMessageQueueGet(s_tel_q, s, NULL, timeout_ms) == osOK;
}
