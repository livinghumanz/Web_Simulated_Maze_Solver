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

/* ---- RatRocket additions (2026-11-11) ----
 * The vendor init above only wakes the chip, which leaves the power-on
 * defaults: internal 8 MHz oscillator, no low-pass filter (gyro bandwidth
 * 256 Hz, output rate 8 kHz) and +-250 deg/s. For gyro-closed turns we need
 * the PLL clock (more stable), a DLPF as anti-alias filter for the 200 Hz
 * polling and more full-scale headroom. */
uint8_t MPU6050_Configure(MPU6050_t *dev, uint8_t clksel, uint8_t dlpf_cfg,
                          uint8_t gyro_fs, uint8_t accel_fs, uint8_t smplrt_div)
{
    if (!dev || !dev->bus) return 0;

    const uint8_t gyro_cfg  = (uint8_t)((gyro_fs & 3U) << 3);
    const uint8_t accel_cfg = (uint8_t)((accel_fs & 3U) << 3);
    const uint8_t cfg       = (uint8_t)(dlpf_cfg & 7U);

    if (!SWI2C_WriteReg(dev->bus, dev->addr7, MPU6050_PWR_MGMT_1, (uint8_t)(clksel & 7U))) return 0;
    if (!SWI2C_WriteReg(dev->bus, dev->addr7, MPU6050_SMPLRT_DIV, smplrt_div)) return 0;
    if (!SWI2C_WriteReg(dev->bus, dev->addr7, MPU6050_CONFIG, cfg)) return 0;
    if (!SWI2C_WriteReg(dev->bus, dev->addr7, MPU6050_GYRO_CONFIG, gyro_cfg)) return 0;
    if (!SWI2C_WriteReg(dev->bus, dev->addr7, MPU6050_ACCEL_CONFIG, accel_cfg)) return 0;

    uint8_t back[3] = {0};   /* CONFIG, GYRO_CONFIG, ACCEL_CONFIG are consecutive */
    if (!SWI2C_ReadRegs(dev->bus, dev->addr7, MPU6050_CONFIG, back, 3)) return 0;
    return ((back[0] & 7U) == cfg && (back[1] & 0x18U) == gyro_cfg && (back[2] & 0x18U) == accel_cfg) ? 1 : 0;
}

uint8_t MPU6050_ReadGyroZ(MPU6050_t *dev, int16_t *gyro_z)
{
    if (!dev || !gyro_z) return 0;

    uint8_t raw[2] = {0};
    if (!SWI2C_ReadRegs(dev->bus, dev->addr7, MPU6050_GYRO_ZOUT_H, raw, 2)) return 0;
    *gyro_z = (int16_t)((raw[0] << 8) | raw[1]);
    return 1;
}
