#include "imu.h"

#include <math.h>
#include <stdbool.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"
#include "bt_log.h"
#include "motion.h"
#include "sw_i2c.h"
#include "mpu6050_sw.h"

/* ---------------- configuration ----------------
 * Full scale +-500 deg/s: the fastest spin the firmware allows (VTURN 160 mm/s
 * on a 96 mm track) is ~190 deg/s, so +-250 would leave almost no headroom for
 * bumps; +-500 keeps 2.6x headroom at 0.015 deg/s per LSB, still well below
 * the sensor noise (~0.05 deg/s). +-1000 would only halve the resolution.
 * DLPF 42 Hz: anti-alias filter for the 200 Hz polling (motor vibration sits
 * above 100 Hz), 4.8 ms delay - irrelevant because turns are measured at rest. */
#define IMU_PERIOD_MS     5U              /* 200 Hz loop                              */
#define IMU_FULL_EVERY    20U             /* whole accel/temp/gyro block every 100 ms */
#define IMU_GYRO_FS       MPU6050_GYRO_FS_500
#define IMU_LSB_PER_DPS   65.5f
#define IMU_DLPF          MPU6050_DLPF_42HZ
#define IMU_DLPF_HZ       42U
/* Raw Z is counter-clockwise-positive (Z axis up, acc Z ~ +1 g); the firmware
 * uses clockwise-positive like TURN. Verified with TURN 90 on 2026-11-11. */
#define IMU_YAW_SIGN      (-1.0f)
#define IMU_SAT_RAW       32700
#define IMU_FAST_TICKS    4U              /* sw I2C delay loop; vendor value 40       */
#define IMU_SLOW_TICKS    40U
#define IMU_FAIL_LIMIT    20U             /* consecutive failed reads -> absent       */
#define IMU_RETRY_MS      2000U
#define IMU_RESET_MS      100U            /* after DEVICE_RESET                       */
#define IMU_STARTUP_MS    60U             /* gyro start-up (datasheet 30 ms typical)  */
#define IMU_CHECK_READS   20U             /* read-back test of the faster bus setting */
/* A real yaw rate cannot jump this much in 5 ms (behind the 42 Hz filter a
 * turn changes by < 2 deg/s per sample): 3000 LSB = 46 deg/s. One such sample
 * is treated as an I2C bit error and replaced by the previous one; a second in
 * a row is accepted (a genuine step, e.g. a bump). */
#define IMU_SPIKE_RAW     3000

#define CAL_SAMPLES       200U            /* 1 s at 200 Hz                            */
#define CAL_STILL_Z_DPS   0.30f           /* "still": standard deviation limits       */
#define CAL_STILL_XY_DPS  0.50f
#define CAL_MAX_BIAS_DPS  20.0f           /* datasheet zero-rate tolerance            */
#define CAL_WAIT_MS       3000U           /* GYROCAL: give up waiting after this      */

/* H2: SCL = PC10, SDA = PC12. These pins are also SPI3 (unused); SWI2C_Init
 * re-configures them as GPIO. */
static SWI2C_Bus_t s_bus = {
    .SCL_Port = GPIOC, .SCL_Pin = GPIO_PIN_10,
    .SDA_Port = GPIOC, .SDA_Pin = GPIO_PIN_12,
    .DelayTicks = IMU_SLOW_TICKS,
};
static MPU6050_t s_dev;

static osThreadId_t s_task;
static const osThreadAttr_t s_task_attr = {
    .name = "imu",
    .stack_size = 512 * 4,              /* prints (vsnprintf) at start-up; see IMU "stack free" */
    .priority = (osPriority_t)osPriorityAboveNormal,
};

/* Shared with other tasks; written by the IMU task inside critical sections. */
static volatile ImuState s_state = IMU_OFF;
static float s_heading;                   /* deg, + = clockwise            */
static float s_rate;                      /* deg/s, + = clockwise          */
static volatile float s_bias_z;           /* deg/s, raw Z axis             */
static volatile ImuBiasSource s_bias_src = IMU_BIAS_NONE;
static volatile float s_saved_bias;
static volatile bool s_saved_valid;
static ImuStatus s_stat;
static uint8_t s_scan[4];                 /* addresses found when the init failed */
static uint8_t s_scan_n;

/* GYROCAL handshake: the console bumps s_cal_req, the IMU task answers. */
static volatile uint32_t s_cal_req;
static volatile uint32_t s_cal_served;
static ImuCalResult s_cal_res;

/* ---------------- helpers ---------------- */

typedef struct { char s[16]; } Fs;
static Fs fs(float v, int dec)
{
    Fs o;
    long scale = (dec <= 1) ? 10L : (dec == 2) ? 100L : 1000L;
    long c = (long)(v * (float)scale + (v >= 0.0f ? 0.5f : -0.5f));
    const char *sign = (c < 0) ? "-" : "";
    if (c < 0) c = -c;
    if (dec <= 1)      snprintf(o.s, sizeof(o.s), "%s%ld.%01ld", sign, c / scale, c % scale);
    else if (dec == 2) snprintf(o.s, sizeof(o.s), "%s%ld.%02ld", sign, c / scale, c % scale);
    else               snprintf(o.s, sizeof(o.s), "%s%ld.%03ld", sign, c / scale, c % scale);
    return o;
}

static void dwt_enable(void)
{
    /* Cycle counter (also used by ultrasonic.c); never reset it here. */
    CoreDebug->DEMCR |= CoreDebug_DEMCR_TRCENA_Msk;
    DWT->CTRL |= DWT_CTRL_CYCCNTENA_Msk;
}

static uint16_t cycles_to_us(uint32_t cycles)
{
    uint32_t us = cycles / (SystemCoreClock / 1000000U);
    return (uint16_t)((us > 65535U) ? 65535U : us);
}

static void delay_us(uint32_t us)
{
    uint32_t start = DWT->CYCCNT;
    uint32_t ticks = us * (SystemCoreClock / 1000000U);
    while ((DWT->CYCCNT - start) < ticks) { }
}

static const char *chip_name(uint8_t who)
{
    switch (who) {
    case 0x68: return "MPU6050";
    case 0x70: return "MPU6500";
    case 0x71: return "MPU9250";
    case 0x98: return "ICM20689";
    default:   return "unknown chip";
    }
}

static int scan_bus(bool print)
{
    int found = 0;
    s_scan_n = 0;
    for (uint8_t a = 0x08; a < 0x78; a++) {
        SWI2C_Start(&s_bus);
        uint8_t ack = SWI2C_WriteByte(&s_bus, (uint8_t)(a << 1));   /* write address */
        SWI2C_Stop(&s_bus);
        if (ack) {
            if (print) BT_LOG("[IMU] device answers at 0x%02X", a);
            if (s_scan_n < sizeof(s_scan)) s_scan[s_scan_n++] = a;
            found++;
        }
    }
    return found;
}

/* A reset in the middle of a read (UPDATE, reset button) can leave the
 * MPU6050 holding SDA low. Clock SCL until it lets go (at most 9 bits), then
 * START + STOP to reset its interface. */
static void bus_recover(void)
{
    for (int i = 0; i < 9 && HAL_GPIO_ReadPin(s_bus.SDA_Port, s_bus.SDA_Pin) == GPIO_PIN_RESET; i++) {
        HAL_GPIO_WritePin(s_bus.SCL_Port, s_bus.SCL_Pin, GPIO_PIN_RESET);
        delay_us(10);
        HAL_GPIO_WritePin(s_bus.SCL_Port, s_bus.SCL_Pin, GPIO_PIN_SET);
        delay_us(10);
    }
    SWI2C_Stop(&s_bus);
}

/* Read back known registers many times: any bit error -> bus too fast. */
static bool bus_check(void)
{
    for (uint32_t i = 0; i < IMU_CHECK_READS; i++) {
        uint8_t who = 0;
        uint8_t cfg[3] = {0};
        if (!SWI2C_ReadRegs(&s_bus, MPU6050_ADDR_DEFAULT, MPU6050_WHO_AM_I, &who, 1) ||
            who != s_stat.who_am_i) {
            return false;
        }
        if (!SWI2C_ReadRegs(&s_bus, MPU6050_ADDR_DEFAULT, MPU6050_CONFIG, cfg, 3) ||
            (cfg[0] & 7U) != IMU_DLPF || (cfg[1] & 0x18U) != (IMU_GYRO_FS << 3) ||
            (cfg[2] & 0x18U) != (MPU6050_ACCEL_FS_2G << 3)) {
            return false;
        }
    }
    return true;
}

static bool sensor_init(void)
{
    s_bus.DelayTicks = IMU_SLOW_TICKS;
    SWI2C_Init(&s_bus);
    bus_recover();

    uint8_t who = 0;
    if (!SWI2C_ReadRegs(&s_bus, MPU6050_ADDR_DEFAULT, MPU6050_WHO_AM_I, &who, 1)) {
        return false;
    }
    s_stat.who_am_i = who;
    /* Start from the power-on defaults: the chip keeps its registers across
     * an MCU reset (UPDATE, reset button). */
    (void)SWI2C_WriteReg(&s_bus, MPU6050_ADDR_DEFAULT, MPU6050_PWR_MGMT_1, MPU6050_PWR_RESET);
    osDelay(IMU_RESET_MS);
    if (!MPU6050_Init(&s_dev, &s_bus, MPU6050_ADDR_DEFAULT)) {        /* WHO_AM_I + wake */
        return false;
    }
    if (!MPU6050_Configure(&s_dev, MPU6050_CLK_PLL_XGYRO, IMU_DLPF, IMU_GYRO_FS,
                           MPU6050_ACCEL_FS_2G, 0U)) {                 /* 1 kHz sampling */
        return false;
    }
    /* ~10x faster bus if it reads back cleanly at that speed. */
    s_bus.DelayTicks = IMU_FAST_TICKS;
    if (!bus_check()) {
        s_bus.DelayTicks = IMU_SLOW_TICKS;
        if (!bus_check()) {
            return false;
        }
    }
    s_stat.delay_ticks = (uint8_t)s_bus.DelayTicks;
    osDelay(IMU_STARTUP_MS);
    return true;
}

/* ---------------- bias calibration ---------------- */

typedef struct {
    uint16_t n;
    int16_t ref[3];
    int32_t sum[3];
    int64_t sumsq[3];
    bool busy_seen;
} CalAcc;

static void cal_add(CalAcc *c, const int16_t g[3])
{
    if (c->n == 0U) {
        for (int i = 0; i < 3; i++) c->ref[i] = g[i];
    }
    for (int i = 0; i < 3; i++) {
        int32_t d = (int32_t)g[i] - (int32_t)c->ref[i];
        c->sum[i] += d;
        c->sumsq[i] += (int64_t)d * d;
    }
    c->n++;
}

static void cal_finish(const CalAcc *c, ImuCalResult *r)
{
    memset(r, 0, sizeof(*r));
    r->samples = c->n;
    if (c->n == 0U) {
        return;
    }
    for (int i = 0; i < 3; i++) {
        float m = (float)c->sum[i] / (float)c->n;
        float var = (float)c->sumsq[i] / (float)c->n - m * m;
        r->bias_dps[i] = ((float)c->ref[i] + m) / IMU_LSB_PER_DPS;
        r->noise_dps[i] = sqrtf(var > 0.0f ? var : 0.0f) / IMU_LSB_PER_DPS;
    }
    r->moving = c->busy_seen ||
                r->noise_dps[2] > CAL_STILL_Z_DPS ||
                r->noise_dps[0] > CAL_STILL_XY_DPS || r->noise_dps[1] > CAL_STILL_XY_DPS ||
                fabsf(r->bias_dps[2]) > CAL_MAX_BIAS_DPS;
    r->ok = !r->moving && c->n >= (CAL_SAMPLES * 9U) / 10U;
}

static void apply_bias(float bias_z, ImuBiasSource src)
{
    taskENTER_CRITICAL();
    s_bias_z = bias_z;
    s_bias_src = src;
    s_heading = 0.0f;         /* new zero reference */
    taskEXIT_CRITICAL();
}

static void report_boot_cal(const ImuCalResult *r)
{
    if (r->ok) {
        BT_LOG("[IMU] boot calibration: bias %s deg/s, noise %s deg/s rms (robot still); heading 0",
               fs(r->bias_dps[2], 2).s, fs(r->noise_dps[2], 3).s);
        return;
    }
    if (s_saved_valid) {
        BT_LOG("[IMU] boot calibration skipped: robot not still (noise Z %s deg/s) - using the saved bias %s deg/s",
               fs(r->noise_dps[2], 2).s, fs(s_saved_bias, 2).s);
    } else {
        BT_LOG("[IMU] boot calibration skipped: robot not still (noise Z %s deg/s) and no saved bias - "
               "gyro turns off until GYROCAL", fs(r->noise_dps[2], 2).s);
    }
}

/* ---------------- IMU task ---------------- */

/* Sample, integrate, calibrate. Returns only when the sensor stops answering. */
static void run(bool auto_cal)
{
    const TickType_t period = pdMS_TO_TICKS(IMU_PERIOD_MS);
    TickType_t wake = xTaskGetTickCount();
    uint32_t t_prev = 0;
    bool first = true;
    uint32_t fails = 0;
    uint32_t k = 0;
    int16_t gz_prev = 0;
    bool held = false;                   /* last sample was replaced (glitch) */
    CalAcc cal;
    bool cal_active = auto_cal;          /* boot (or re-connect) calibration */
    bool cal_is_boot = auto_cal;
    uint32_t cal_for = 0;                /* GYROCAL request being served */
    memset(&cal, 0, sizeof(cal));

    for (;;) {
        /* Overrun (slow bus, flash erase during SAVE): re-sync instead of
         * catching up back to back, so lower tasks are never starved. The
         * integration uses the measured time, so irregular periods are fine. */
        if ((TickType_t)(xTaskGetTickCount() - wake) > period) {
            wake = xTaskGetTickCount();
        }
        vTaskDelayUntil(&wake, period);

        if (!cal_active && s_cal_req != s_cal_served) {
            memset(&cal, 0, sizeof(cal));
            cal_active = true;
            cal_is_boot = false;
            cal_for = s_cal_req;
        }

        bool full = cal_active || (k++ % IMU_FULL_EVERY) == 0U;
        MPU6050_Data_t d = {0};
        int16_t gz = 0;
        uint32_t t0 = DWT->CYCCNT;       /* registers latch at the start of the read */
        bool ok = full ? (MPU6050_ReadAll(&s_dev, &d) != 0U) : (MPU6050_ReadGyroZ(&s_dev, &gz) != 0U);
        uint16_t us = cycles_to_us(DWT->CYCCNT - t0);
        if (!ok) {
            s_stat.errors++;
            if (++fails >= IMU_FAIL_LIMIT) {
                return;
            }
            continue;
        }
        fails = 0;
        if (full) {
            gz = d.Gyro_Z;
        }
        bool glitch = !first && !held && (gz - gz_prev > IMU_SPIKE_RAW || gz_prev - gz > IMU_SPIKE_RAW);
        if (glitch) {
            gz = gz_prev;                /* hold the last good value for this interval */
        }
        held = glitch;
        gz_prev = gz;

        float rate = IMU_YAW_SIGN * ((float)gz / IMU_LSB_PER_DPS - s_bias_z);
        float dt = (float)(t0 - t_prev) / (float)SystemCoreClock;   /* real elapsed time */
        t_prev = t0;

        taskENTER_CRITICAL();
        if (!first) {
            s_heading += 0.5f * (rate + s_rate) * dt;                 /* trapezoid rule */
            uint32_t gap_us = (uint32_t)(dt * 1e6f);
            if (gap_us > s_stat.gap_max_us) s_stat.gap_max_us = gap_us;
        }
        s_rate = rate;
        s_stat.samples++;
        s_stat.gyro[2] = gz;
        if (full) {
            s_stat.acc[0] = d.Accel_X;
            s_stat.acc[1] = d.Accel_Y;
            s_stat.acc[2] = d.Accel_Z;
            s_stat.gyro[0] = d.Gyro_X;
            s_stat.gyro[1] = d.Gyro_Y;
            s_stat.full_read_us = us;
        } else {
            s_stat.read_us = us;
            if (us > s_stat.read_max_us) s_stat.read_max_us = us;
        }
        if (gz >= IMU_SAT_RAW || gz <= -IMU_SAT_RAW) {
            s_stat.saturated++;
        }
        if (glitch) {
            s_stat.glitches++;
        }
        taskEXIT_CRITICAL();
        first = false;

        if (cal_active) {
            const int16_t g[3] = { d.Gyro_X, d.Gyro_Y, d.Gyro_Z };
            if (Motion_IsBusy()) {
                cal.busy_seen = true;
            }
            cal_add(&cal, g);
            if (cal.n >= CAL_SAMPLES) {
                ImuCalResult r;
                cal_finish(&cal, &r);
                if (r.ok) {
                    apply_bias(r.bias_dps[2], cal_is_boot ? IMU_BIAS_BOOT : IMU_BIAS_GYROCAL);
                }
                if (cal_is_boot) {
                    report_boot_cal(&r);
                } else {
                    taskENTER_CRITICAL();
                    s_cal_res = r;
                    s_cal_served = cal_for;
                    taskEXIT_CRITICAL();
                }
                cal_active = false;
            }
        }
    }
}

static void imu_task(void *arg)
{
    (void)arg;
    dwt_enable();
    bool reported_absent = false;
    for (;;) {
        if (!sensor_init()) {
            s_state = IMU_ABSENT;
            if (!reported_absent) {
                reported_absent = true;
                s_bus.DelayTicks = IMU_SLOW_TICKS;
                int n = scan_bus(false);
                BT_LOG("[IMU] no MPU6050 on H2 (bus scan: %d device%s) - turns use the encoders only. IMU for details.",
                       n, n == 1 ? "" : "s");
            }
            osDelay(IMU_RETRY_MS);
            continue;
        }
        reported_absent = false;
        s_state = IMU_READY;
        BT_LOG("[IMU] %s ready on H2: gyro +-500 deg/s, DLPF %u Hz, %u Hz loop, I2C delay %u",
               chip_name(s_stat.who_am_i), (unsigned)IMU_DLPF_HZ, (unsigned)(1000U / IMU_PERIOD_MS),
               (unsigned)s_bus.DelayTicks);
        run(true);
        s_state = IMU_ABSENT;
        BT_LOG("[IMU] sensor stopped answering - turns use the encoders only; retrying");
    }
}

/* ---------------- API ---------------- */

void Imu_Start(void)
{
    if (s_task != NULL) {
        return;
    }
    s_state = IMU_STARTING;
    s_task = osThreadNew(imu_task, NULL, &s_task_attr);
    if (s_task == NULL) {
        s_state = IMU_OFF;
    }
}

ImuState Imu_GetState(void)
{
    return s_state;
}

const char *Imu_StateName(ImuState s)
{
    switch (s) {
    case IMU_STARTING: return "starting";
    case IMU_READY:    return "present";
    case IMU_ABSENT:   return "absent";
    case IMU_OFF:
    default:           return "off";
    }
}

bool Imu_Present(void)
{
    return s_state == IMU_READY;
}

bool Imu_Calibrated(void)
{
    return s_bias_src != IMU_BIAS_NONE;
}

float Imu_HeadingDeg(void)
{
    taskENTER_CRITICAL();
    float h = s_heading;
    taskEXIT_CRITICAL();
    return h;
}

float Imu_RateDps(void)
{
    taskENTER_CRITICAL();
    float r = s_rate;
    taskEXIT_CRITICAL();
    return r;
}

void Imu_ResetHeading(void)
{
    taskENTER_CRITICAL();
    s_heading = 0.0f;
    taskEXIT_CRITICAL();
}

bool Imu_Calibrate(ImuCalResult *r)
{
    if (s_task == NULL || !Imu_Present()) {
        return false;
    }
    taskENTER_CRITICAL();
    uint32_t mine = ++s_cal_req;
    taskEXIT_CRITICAL();
    for (uint32_t waited = 0; waited < CAL_WAIT_MS; waited += 20U) {
        osDelay(20);
        taskENTER_CRITICAL();
        bool done = (s_cal_served == mine);
        if (done && r != NULL) {
            *r = s_cal_res;
        }
        taskEXIT_CRITICAL();
        if (done) {
            return true;
        }
        if (!Imu_Present()) {
            break;
        }
    }
    taskENTER_CRITICAL();
    s_cal_served = s_cal_req;            /* drop the request */
    taskEXIT_CRITICAL();
    return false;
}

ImuBiasSource Imu_GetBias(float *bias_z_dps)
{
    taskENTER_CRITICAL();
    ImuBiasSource src = s_bias_src;
    float b = s_bias_z;
    taskEXIT_CRITICAL();
    if (bias_z_dps != NULL) {
        *bias_z_dps = b;
    }
    return src;
}

bool Imu_GetSavedBias(float *bias_z_dps)
{
    if (bias_z_dps != NULL) {
        *bias_z_dps = s_saved_bias;
    }
    return s_saved_valid;
}

const char *Imu_BiasSourceName(ImuBiasSource s)
{
    switch (s) {
    case IMU_BIAS_SAVED:   return "saved";
    case IMU_BIAS_BOOT:    return "boot cal";
    case IMU_BIAS_GYROCAL: return "GYROCAL";
    case IMU_BIAS_NONE:
    default:               return "none";
    }
}

void Imu_SetSavedBias(bool valid, float bias_z_dps)
{
    if (valid && !(fabsf(bias_z_dps) < CAL_MAX_BIAS_DPS)) {
        valid = false;                       /* also rejects NaN */
    }
    taskENTER_CRITICAL();
    s_saved_valid = valid;
    s_saved_bias = valid ? bias_z_dps : 0.0f;
    /* A calibration from this session always wins over the saved value. */
    if (valid && (s_bias_src == IMU_BIAS_NONE || s_bias_src == IMU_BIAS_SAVED)) {
        s_bias_z = bias_z_dps;
        s_bias_src = IMU_BIAS_SAVED;
    }
    taskEXIT_CRITICAL();
}

void Imu_GetStatus(ImuStatus *s)
{
    taskENTER_CRITICAL();
    *s = s_stat;
    taskEXIT_CRITICAL();
    s->present = Imu_Present();
    s->stack_free = (s_task != NULL) ? (uint32_t)uxTaskGetStackHighWaterMark((TaskHandle_t)s_task) : 0U;
}

/* ---------------- console commands ---------------- */

/* First bring-up probe, kept for use without the IMU task (it would collide
 * with the task on the bus). */
static void probe_direct(void)
{
    SWI2C_Init(&s_bus);
    BT_LOG("[IMU] scanning H2 (SCL PC10, SDA PC12)...");
    if (scan_bus(true) == 0) {
        BT_LOG("[IMU] nothing answers. Check: module seated in H2, jumper JP3 set (3.3V or 5V), SDA/SCL not swapped.");
        return;
    }
    uint8_t who = 0;
    if (!SWI2C_ReadRegs(&s_bus, MPU6050_ADDR_DEFAULT, MPU6050_WHO_AM_I, &who, 1)) {
        BT_LOG("[IMU] a device answers, but not at 0x68 (AD0 pin high -> 0x69?)");
        return;
    }
    BT_LOG("[IMU] WHO_AM_I = 0x%02X (%s)", who, chip_name(who));
    MPU6050_t dev;
    if (!MPU6050_Init(&dev, &s_bus, MPU6050_ADDR_DEFAULT)) {
        BT_LOG("[IMU] init failed");
        return;
    }
    for (int i = 0; i < 5; i++) {
        MPU6050_Data_t d;
        if (MPU6050_ReadAll(&dev, &d)) {
            BT_LOG("[IMU] acc %6d %6d %6d   gyro %6d %6d %6d",
                   d.Accel_X, d.Accel_Y, d.Accel_Z, d.Gyro_X, d.Gyro_Y, d.Gyro_Z);
        } else {
            BT_LOG("[IMU] read failed");
        }
        osDelay(200);
    }
}

void Imu_Probe(void)
{
    if (s_task == NULL) {
        probe_direct();
        return;
    }
    ImuStatus st;
    Imu_GetStatus(&st);
    if (!st.present) {
        BT_LOG("[IMU] %s: no MPU6050 answering on H2 (SCL PC10, SDA PC12); the IMU task retries every %u s.",
               Imu_StateName(Imu_GetState()), (unsigned)(IMU_RETRY_MS / 1000U));
        if (s_scan_n == 0U) {
            BT_LOG("[IMU] bus scan at start-up: nothing answers. Check: module seated in H2, "
                   "jumper JP3 set (3.3V or 5V), SDA/SCL not swapped.");
        } else {
            BT_LOG("[IMU] bus scan at start-up found 0x%02X%s (an MPU6050 answers at 0x68; AD0 high -> 0x69)",
                   s_scan[0], s_scan_n > 1U ? " and more" : "");
        }
        return;
    }
    BT_LOG("[IMU] %s (WHO_AM_I 0x%02X) on H2: gyro +-500 deg/s (65.5 LSB per deg/s), DLPF %u Hz, %u Hz loop",
           chip_name(st.who_am_i), st.who_am_i, (unsigned)IMU_DLPF_HZ, (unsigned)(1000U / IMU_PERIOD_MS));
    BT_LOG("[IMU] I2C delay %u: gyro Z read %u us (max %u), full read %u us; stack free %lu words",
           st.delay_ticks, st.read_us, st.read_max_us, st.full_read_us, (unsigned long)st.stack_free);
    BT_LOG("[IMU] %lu samples, %lu read errors, %lu glitches replaced, %lu saturated; longest gap %lu us",
           (unsigned long)st.samples, (unsigned long)st.errors, (unsigned long)st.glitches,
           (unsigned long)st.saturated, (unsigned long)st.gap_max_us);
    taskENTER_CRITICAL();
    s_stat.gap_max_us = 0U;                  /* next IMU shows the gap since now */
    taskEXIT_CRITICAL();
    for (int i = 0; i < 5; i++) {
        Imu_GetStatus(&st);
        BT_LOG("[IMU] acc %6d %6d %6d   gyro %6d %6d %6d (raw)",
               st.acc[0], st.acc[1], st.acc[2], st.gyro[0], st.gyro[1], st.gyro[2]);
        osDelay(200);
    }
    float b;
    ImuBiasSource src = Imu_GetBias(&b);
    BT_LOG("[IMU] heading %s deg, rate %s deg/s (+ = clockwise), bias Z %s deg/s (%s)",
           fs(Imu_HeadingDeg(), 2).s, fs(Imu_RateDps(), 2).s, fs(b, 2).s, Imu_BiasSourceName(src));
}

/* GYRO: heading and rate 10x over 2 s, then the totals. */
void Imu_CmdGyro(void)
{
    if (!Imu_Present()) {
        BT_LOG("GYRO: no IMU (%s) - see IMU", Imu_StateName(Imu_GetState()));
        return;
    }
    if (!Imu_Calibrated()) {
        BT_LOG("GYRO: not calibrated - the numbers include the zero-rate offset; run GYROCAL");
    }
    float h0 = Imu_HeadingDeg();
    float rmin = 1e9f, rmax = -1e9f;
    uint32_t t0 = HAL_GetTick();
    for (int i = 1; i <= 10; i++) {
        osDelay(200);
        float h = Imu_HeadingDeg() - h0;
        float r = Imu_RateDps();
        if (r < rmin) rmin = r;
        if (r > rmax) rmax = r;
        BT_LOG("GYRO t %s s  heading %s deg  rate %s deg/s", fs((float)i * 0.2f, 1).s, fs(h, 2).s, fs(r, 2).s);
    }
    float secs = (float)(HAL_GetTick() - t0) / 1000.0f;
    float dh = Imu_HeadingDeg() - h0;
    float b;
    ImuBiasSource src = Imu_GetBias(&b);
    BT_LOG("GYRO total: %s deg in %s s (mean %s deg/s), rate min %s max %s deg/s",
           fs(dh, 2).s, fs(secs, 2).s, fs(secs > 0.0f ? dh / secs : 0.0f, 3).s, fs(rmin, 2).s, fs(rmax, 2).s);
    BT_LOG("GYRO heading %s deg since the last calibration; bias Z %s deg/s (%s)",
           fs(Imu_HeadingDeg(), 2).s, fs(b, 3).s, Imu_BiasSourceName(src));
}

/* GYROCAL: measure the zero-rate offset (robot standing still). */
void Imu_CmdGyroCal(void)
{
    if (!Imu_Present()) {
        BT_LOG("GYROCAL: no IMU (%s) - see IMU", Imu_StateName(Imu_GetState()));
        return;
    }
    if (Motion_IsBusy()) {
        BT_LOG("GYROCAL: robot is moving - try again when it stands still");
        return;
    }
    BT_LOG("GYROCAL: keep the robot still for 1 s...");
    ImuCalResult r;
    if (!Imu_Calibrate(&r)) {
        BT_LOG("GYROCAL failed: no answer from the IMU task");
        return;
    }
    if (r.ok) {
        BT_LOG("GYROCAL ok: bias Z %s deg/s (X %s, Y %s), noise Z %s deg/s rms (X %s, Y %s), %u samples",
               fs(r.bias_dps[2], 3).s, fs(r.bias_dps[0], 2).s, fs(r.bias_dps[1], 2).s,
               fs(r.noise_dps[2], 3).s, fs(r.noise_dps[0], 3).s, fs(r.noise_dps[1], 3).s, r.samples);
        BT_LOG("GYROCAL: heading reset to 0. SAVE keeps the bias across power-off.");
        return;
    }
    float b;
    ImuBiasSource src = Imu_GetBias(&b);
    BT_LOG("GYROCAL rejected: the robot moved (noise Z %s deg/s, limit %s; X %s Y %s, limit %s)%s",
           fs(r.noise_dps[2], 3).s, fs(CAL_STILL_Z_DPS, 2).s, fs(r.noise_dps[0], 2).s,
           fs(r.noise_dps[1], 2).s, fs(CAL_STILL_XY_DPS, 2).s,
           (fabsf(r.bias_dps[2]) > CAL_MAX_BIAS_DPS) ? " or turns steadily" : "");
    BT_LOG("GYROCAL: keep it still and repeat. Bias unchanged: %s deg/s (%s).",
           fs(b, 3).s, Imu_BiasSourceName(src));
}
