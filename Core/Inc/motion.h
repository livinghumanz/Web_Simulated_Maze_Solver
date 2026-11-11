#ifndef MOTION_H
#define MOTION_H

/*
 * Closed-loop wheel motion (PID) for the RatRocket micromouse.
 *
 * A dedicated high-priority task runs at 1 kHz. Each tick it:
 *   1. reads the encoders,
 *   2. advances a speed profile (trapezoid for FWD/TURN, ramped speed for SPD),
 *   3. integrates the profile speed into a target position per wheel,
 *   4. drives each wheel with  feed-forward + static-friction compensation
 *      + PID on (target position - measured position),
 *   5. scales the result by (tuning supply / present supply), so gains tuned
 *      on USB power still fit on battery.
 *
 * The control task never formats text. It pushes MotionSample records into a
 * telemetry queue (non-blocking, dropped if full); a low-priority task prints
 * them. Commands reach the control task through a command queue, so all API
 * calls below are safe from any task.
 */

#include <stdbool.h>
#include <stdint.h>

/* ---- Robot constants ----
 * Counts per wheel turn: eye-counted wheel turns first gave ~2510, but on the
 * floor FWD 300 travelled only 262 mm and TURN 360 only ~315 deg - the same
 * 0.873 factor - so the real value is 2510 * 300/262 ~ 2874 (2026-11-06).
 * Fine-tune at runtime with CALDIST / TRIM (maze mode). */
#define WHEEL_DIAMETER_MM        34.0f
#define ENC_CPR_LEFT             2874.0f   /* encoder counts per wheel turn */
#define ENC_CPR_RIGHT            2874.0f
/* Track width for in-place turns: user measured 95-96 mm. TURN 360 came up
 * short only because of the counts-per-turn error above (109 mm with the old
 * CPR gave 357-358 deg, i.e. ~96 mm with the corrected CPR). With the
 * powerbank on top it turned even less - re-check with the final load. */
#define MOTION_TRACK_MM_DEFAULT  96.0f
#define MOTION_PWM_HZ            1000U     /* low PWM freq = small dead-band */
#define MOTION_SUPPLY_REF_MV     4200.0f   /* Battery_ReadMv() value when the gains were tuned (USB) */
/* Left motor reverse input (PB1 -> IN3) repaired 2026-11-07 (DECEL L: reverse
 * stops the wheel in 24 counts / 17 ms). */
#define MOTION_LEFT_CAN_REVERSE  1
#define MOTION_RIGHT_CAN_REVERSE 1
/* Extra static-friction duty for the left wheel on top of kstatic. SWEEP
 * 2026-11-07 @1 kHz, lifted: the left needs ~110 more duty than the right at
 * 1300-2200 counts/s (duty 400: L 820 / R 1674 cps; equal near full duty). */
#define MOTION_KSTATIC_LEFT_EXTRA 110.0f

typedef struct {
    float kp;       /* duty per count of position error             */
    float ki;       /* duty per count*second of accumulated error   */
    float kd;       /* duty per count/second of error rate          */
    float kff;      /* duty per count/second of target speed        */
    float kstatic;  /* duty added in the direction of motion        */
} MotionGains;

typedef enum {
    MOTION_EV_SAMPLE = 0,   /* periodic telemetry                    */
    MOTION_EV_START,        /* a move has started                    */
    MOTION_EV_DONE,         /* move finished and settled             */
    MOTION_EV_STOPPED,      /* stopped on request                    */
    MOTION_EV_FOLLOW_ERR,   /* aborted: wheel too far behind target  */
} MotionEvent;

typedef struct {
    uint32_t t_ms;                   /* since the move started        */
    uint8_t  event;                  /* MotionEvent                   */
    int16_t  vt_left, vt_right;      /* profile speed, mm/s           */
    int16_t  v_left, v_right;        /* measured speed, mm/s          */
    int16_t  err_left, err_right;    /* position error, counts        */
    int16_t  duty_left, duty_right;  /* motor command                 */
    int32_t  dist_um;                /* distance done (FWD/TURN, per wheel), micrometres */
} MotionSample;

/* Create the control task and queues; sets the motor PWM frequency. */
void Motion_Start(void);

/* Straight move of mm (negative = backwards) with trapezoidal profile.
 * Returns false if busy, the arguments are invalid, or the move needs a
 * wheel to reverse that cannot. */
bool Motion_Forward(float mm, float v_max_mm_s, float accel_mm_s2);

/* In-place turn about the robot centre. deg > 0 = clockwise (right).
 * v/accel are wheel speeds along the arc. Rejected if a wheel would need to
 * reverse but cannot (see Motion_CanTurn).
 * Gyro-closed (2026-11-11, off by default): with GYROTURN 1 and a calibrated
 * IMU the encoder trapezoid still does the whole turn, then correction spins
 * make the gyro-measured angle match deg (see motion.c, "gyro-closed turns"). */
bool Motion_Turn(float deg, float v_wheel_mm_s, float accel_mm_s2);
bool Motion_CanTurn(bool clockwise);

/* GYROTURN setting, default OFF (postponed, see docs/firmware.md). Gyro turns
 * are used only while it is on AND the IMU is present and calibrated
 * (Motion_GyroTurnActive); otherwise Motion_Turn is the plain encoder turn. */
void Motion_SetGyroTurn(bool on);
bool Motion_GetGyroTurn(void);
bool Motion_GyroTurnActive(void);

typedef enum {
    MOTION_GT_ENCODER = 0,  /* encoder turn (GYROTURN 0 or no calibrated IMU)    */
    MOTION_GT_OK,           /* gyro-closed: ended within tolerance               */
    MOTION_GT_LIMIT,        /* gyro-closed: correction count / time limit hit    */
    MOTION_GT_DISAGREE,     /* gyro and encoders disagree grossly: no correction */
    MOTION_GT_LOST,         /* IMU stopped answering during the turn             */
    MOTION_GT_ABORTED,      /* STOP or following error                           */
} MotionGyroResult;

#define MOTION_GT_MAX_CORR 4U   /* correction spins per gyro-closed turn */

/* Result of the last Motion_Turn, complete once Motion_IsBusy() is false. */
typedef struct {
    float cmd_deg;          /* commanded, + = clockwise                       */
    float gyro_deg;         /* measured by the gyro (if gyro_valid)           */
    float enc_deg;          /* from the wheel encoders (incl. corrections)    */
    float heading_deg;      /* gyro heading at the end (since the last cal.)  */
    float meas[MOTION_GT_MAX_CORR];  /* gyro angle before each correction     */
    uint32_t ms;            /* duration including corrections                 */
    uint8_t event;          /* MotionEvent that ended it                      */
    uint8_t result;         /* MotionGyroResult                               */
    uint8_t corrections;    /* correction spins made                          */
    bool gyro_valid;
} MotionTurnReport;

bool Motion_GetTurnReport(MotionTurnReport *r);   /* false: no turn yet */
const char *Motion_GyroResultName(uint8_t result);

/* Pivot turn: the inner wheel stays still, the outer wheel drives forward
 * along an arc of radius = track width. deg > 0 = clockwise (right). Needs no
 * reverse, so it works with the left-motor fault. The robot centre moves by
 * half a track width forwards and sideways. v/accel = outer wheel. */
bool Motion_Pivot(float deg, float v_wheel_mm_s, float accel_mm_s2);

/* Run each wheel at a constant speed (ramped) for ms, then ramp down. */
bool Motion_Speed(float v_left_mm_s, float v_right_mm_s, uint32_t ms, float accel_mm_s2);

/* Differential speed added during Motion_Forward: left +s, right -s
 * (s > 0 steers right). Limited to 40% of the profile speed. Reset to 0 at
 * the start of every move. */
void Motion_SetSteering(float mm_s);

/* Distance covered so far by the current FWD/TURN move (per wheel), mm. */
float Motion_DistanceDone(void);

/* Change the length of the FWD move in progress (e.g. from a front-wall
 * reading). Never shorter than what is already done; ignored when idle. */
void Motion_SetForwardTotal(float mm);

void Motion_Stop(void);
bool Motion_IsBusy(void);
uint8_t Motion_LastEvent(void);   /* MotionEvent that ended the last move */

void Motion_SetTrackWidth(float mm);
float Motion_GetTrackWidth(void);

/* Distance calibration (only while idle; returns false when busy).
 * scale: multiplies counts-per-mm of both wheels (> 1 = drive further).
 * trim:  percent; > 0 makes the left wheel go further and the right less,
 *        which corrects a robot that curves to the LEFT when driving straight. */
bool Motion_SetDistanceScale(float scale);
float Motion_GetDistanceScale(void);
bool Motion_SetTrim(float percent);
float Motion_GetTrim(void);
uint32_t Motion_SupplyMv(void);   /* filtered supply reading used for compensation */

void Motion_GetGains(MotionGains *g);
void Motion_SetGains(const MotionGains *g);

/* Telemetry period during moves, ms (0 = events only). */
void Motion_SetTelemetryPeriod(uint32_t ms);

/* Fetch the next telemetry record (blocks up to timeout_ms). */
bool Motion_GetSample(MotionSample *s, uint32_t timeout_ms);

#endif /* MOTION_H */
