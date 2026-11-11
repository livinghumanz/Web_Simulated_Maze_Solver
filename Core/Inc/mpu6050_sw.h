#ifndef __MPU6050_SW_H__
#define __MPU6050_SW_H__

#include <stdint.h>
#include "sw_i2c.h"

#define MPU6050_ADDR_DEFAULT   0x68

#define MPU6050_WHO_AM_I       0x75
#define MPU6050_PWR_MGMT_1     0x6B
#define MPU6050_ACCEL_XOUT_H   0x3B

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

#endif
