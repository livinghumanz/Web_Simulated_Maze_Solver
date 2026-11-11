#ifndef __MPU6050_SW_H__
#define __MPU6050_SW_H__

#include <stdint.h>
#include "sw_i2c.h"

#define MPU6050_ADDR_DEFAULT   0x68

#define MPU6050_WHO_AM_I       0x75
#define MPU6050_PWR_MGMT_1     0x6B
#define MPU6050_ACCEL_XOUT_H   0x3B

/* ---- RatRocket additions (2026-11-11): configuration for gyro turns ---- */
#define MPU6050_SMPLRT_DIV     0x19
#define MPU6050_CONFIG         0x1A   /* DLPF_CFG in bits 2:0             */
#define MPU6050_GYRO_CONFIG    0x1B   /* FS_SEL in bits 4:3                */
#define MPU6050_ACCEL_CONFIG   0x1C   /* AFS_SEL in bits 4:3               */
#define MPU6050_GYRO_ZOUT_H    0x47

#define MPU6050_PWR_RESET      0x80   /* PWR_MGMT_1: DEVICE_RESET          */
#define MPU6050_CLK_PLL_XGYRO  0x01   /* PWR_MGMT_1: CLKSEL = PLL, X gyro  */

/* DLPF_CFG: gyro bandwidth / delay (accel similar). Gyro output rate is
 * 1 kHz for DLPF_CFG 1..6 and 8 kHz for 0. */
#define MPU6050_DLPF_256HZ     0      /* 0.98 ms */
#define MPU6050_DLPF_188HZ     1      /* 1.9 ms  */
#define MPU6050_DLPF_98HZ      2      /* 2.8 ms  */
#define MPU6050_DLPF_42HZ      3      /* 4.8 ms  */
#define MPU6050_DLPF_20HZ      4      /* 8.3 ms  */

/* FS_SEL: full scale and sensitivity */
#define MPU6050_GYRO_FS_250    0      /* 131.0 LSB per deg/s */
#define MPU6050_GYRO_FS_500    1      /*  65.5 LSB per deg/s */
#define MPU6050_GYRO_FS_1000   2      /*  32.8 LSB per deg/s */
#define MPU6050_GYRO_FS_2000   3      /*  16.4 LSB per deg/s */

#define MPU6050_ACCEL_FS_2G    0      /* 16384 LSB per g */

typedef struct
{
    SWI2C_Bus_t *bus;
    uint8_t addr7;
} MPU6050_t;

typedef struct
{
    int16_t Accel_X, Accel_Y, Accel_Z;
    int16_t Gyro_X,  Gyro_Y,  Gyro_Z;
} MPU6050_Data_t;

uint8_t MPU6050_Init(MPU6050_t *dev, SWI2C_Bus_t *bus, uint8_t addr7);
uint8_t MPU6050_ReadAll(MPU6050_t *dev, MPU6050_Data_t *data);

/* RatRocket additions. Configure: clock source, DLPF, gyro/accel full scale
 * and sample-rate divider, then reads GYRO_CONFIG and CONFIG back.
 * Returns 1 if every write was acknowledged and the read-back matches. */
uint8_t MPU6050_Configure(MPU6050_t *dev, uint8_t clksel, uint8_t dlpf_cfg,
                          uint8_t gyro_fs, uint8_t accel_fs, uint8_t smplrt_div);
/* Only the gyro Z register pair (2 bytes instead of 14: ~4x shorter transfer). */
uint8_t MPU6050_ReadGyroZ(MPU6050_t *dev, int16_t *gyro_z);

#endif
