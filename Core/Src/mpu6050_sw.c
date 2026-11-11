#include "mpu6050_sw.h"

uint8_t MPU6050_Init(MPU6050_t *dev, SWI2C_Bus_t *bus, uint8_t addr7)
{
    if (!dev || !bus) return 0;

    dev->bus  = bus;
    dev->addr7 = addr7;

    uint8_t who = 0;
    if (!SWI2C_ReadRegs(bus, addr7, MPU6050_WHO_AM_I, &who, 1)) return 0;
    if (who != 0x68 && who != 0x69) return 0;

    /* Wake up sensor */
    if (!SWI2C_WriteReg(bus, addr7, MPU6050_PWR_MGMT_1, 0x00)) return 0;

    return 1;
}

uint8_t MPU6050_ReadAll(MPU6050_t *dev, MPU6050_Data_t *data)
{
    if (!dev || !data) return 0;

    uint8_t raw[14] = {0};
    if (!SWI2C_ReadRegs(dev->bus, dev->addr7, MPU6050_ACCEL_XOUT_H, raw, 14)) return 0;

    data->Accel_X = (int16_t)((raw[0]  << 8) | raw[1]);
    data->Accel_Y = (int16_t)((raw[2]  << 8) | raw[3]);
    data->Accel_Z = (int16_t)((raw[4]  << 8) | raw[5]);

    data->Gyro_X  = (int16_t)((raw[8]  << 8) | raw[9]);
    data->Gyro_Y  = (int16_t)((raw[10] << 8) | raw[11]);
    data->Gyro_Z  = (int16_t)((raw[12] << 8) | raw[13]);

    return 1;
}
