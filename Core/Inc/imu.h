#ifndef IMU_H
#define IMU_H

/*
 * IMU on header H2 (MPU6050 module, software I2C: SCL PC10, SDA PC12).
 * Power comes through jumper JP3 (3.3 V or +5V_2) - without it the module
 * is unpowered and nothing answers.
 *
 * Imu_Start() creates the IMU task (maze mode). It owns the I2C bus: nothing
 * else may bit-bang PC10/PC12 while it runs, and the 1 kHz motion task never
 * touches the bus - it only calls the getters below.
 *
 *   - 200 Hz loop (vTaskDelayUntil, 5 ms): reads gyro Z (2 bytes), every 20th
 *     cycle the whole accel/temp/gyro block; integrates the yaw rate with the
 *     real elapsed time from the DWT cycle counter (trapezoid rule).
 *   - Gyro +-500 deg/s (65.5 LSB per deg/s), DLPF 42 Hz, PLL clock.
 *   - Heading and rate are CLOCKWISE-POSITIVE (seen from above), the same
 *     sign as TURN (+ = right). The module's Z axis points up (acc Z ~ +1 g),
 *     so clockwise is negative raw gyro Z: IMU_YAW_SIGN in imu.c.
 *   - Bias (zero-rate offset): measured at boot if the robot stands still,
 *     else the value saved with SAVE; GYROCAL measures it again. Precedence:
 *     a calibration from this session (boot or GYROCAL) > the saved value >
 *     none (then gyro turns stay off).
 *
 * All functions are safe to call from any task once the scheduler runs.
 */

#include <stdbool.h>
#include <stdint.h>

typedef enum {
    IMU_OFF = 0,         /* Imu_Start() not called (modes other than maze) */
    IMU_STARTING,        /* task started, sensor not configured yet         */
    IMU_READY,           /* configured and answering                        */
    IMU_ABSENT,          /* not answering; the task retries every 2 s       */
} ImuState;

typedef enum {
    IMU_BIAS_NONE = 0,   /* never calibrated, nothing saved              */
    IMU_BIAS_SAVED,      /* loaded from the settings sector (SAVE)        */
    IMU_BIAS_BOOT,       /* measured at boot (robot was standing still)   */
    IMU_BIAS_GYROCAL,    /* measured with the GYROCAL command             */
} ImuBiasSource;

typedef struct {
    bool ok;             /* bias accepted                                  */
    bool moving;         /* rejected: noise/offset says the robot moved     */
    uint16_t samples;
    float bias_dps[3];   /* mean X, Y, Z rate (raw axes), deg/s             */
    float noise_dps[3];  /* standard deviation per axis, deg/s              */
} ImuCalResult;

typedef struct {
    bool present;
    uint8_t who_am_i;
    int16_t acc[3];      /* latest raw accel (refreshed every 100 ms)      */
    int16_t gyro[3];     /* latest raw gyro X, Y (100 ms) and Z (5 ms)     */
    uint32_t samples;    /* gyro Z samples integrated                      */
    uint32_t errors;     /* failed reads                                   */
    uint32_t saturated;  /* samples at the end of the range               */
    uint32_t glitches;   /* single implausible samples replaced (bit errors) */
    uint32_t stack_free; /* IMU task stack never used, words              */
    uint16_t read_us;    /* duration of the last gyro Z read               */
    uint16_t read_max_us;
    uint32_t gap_max_us; /* longest time between two samples (since last IMU) */
    uint16_t full_read_us;
    uint8_t delay_ticks; /* sw I2C speed setting in use                     */
} ImuStatus;

void Imu_Start(void);
ImuState Imu_GetState(void);
const char *Imu_StateName(ImuState s);

bool  Imu_Present(void);          /* sensor configured and answering          */
bool  Imu_Calibrated(void);       /* a bias is in use (see precedence above)  */
float Imu_HeadingDeg(void);       /* integrated yaw since reset, + = clockwise */
float Imu_RateDps(void);          /* latest yaw rate, bias removed, + = clockwise */
void  Imu_ResetHeading(void);

/* GYROCAL: average ~1 s of samples (robot must stand still). Blocks the
 * caller up to ~2 s. On success the bias is used at once and the heading is
 * reset to 0. Returns false if there is no IMU or it timed out. */
bool  Imu_Calibrate(ImuCalResult *r);

/* Bias in use (Z, deg/s, raw axis) and where it came from. */
ImuBiasSource Imu_GetBias(float *bias_z_dps);
const char *Imu_BiasSourceName(ImuBiasSource s);

/* Saved bias from the settings sector (Settings_Load). Used only while no
 * calibration from this session exists. */
void  Imu_SetSavedBias(bool valid, float bias_z_dps);
bool  Imu_GetSavedBias(float *bias_z_dps);   /* false: nothing saved */

void  Imu_GetStatus(ImuStatus *s);

/* Console commands (maze mode). IMU: status and 5 raw samples (from the IMU
 * task; without the task: bus scan, WHO_AM_I and raw samples as in the first
 * probe). GYRO: heading/rate 10x over 2 s and the totals. GYROCAL: bias. */
void  Imu_Probe(void);
void  Imu_CmdGyro(void);
void  Imu_CmdGyroCal(void);

#endif /* IMU_H */
