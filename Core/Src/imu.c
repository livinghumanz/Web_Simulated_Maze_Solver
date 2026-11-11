#include "imu.h"

#include <stdbool.h>
#include <stdint.h>

#include "cmsis_os.h"
#include "main.h"
#include "bt_log.h"
#include "sw_i2c.h"
#include "mpu6050_sw.h"

/* H2: SCL = PC10, SDA = PC12. These pins are also SPI3 (unused); SWI2C_Init
 * re-configures them as GPIO. DelayTicks 40 is the vendor's value at 40 MHz. */
static SWI2C_Bus_t s_bus = {
    .SCL_Port = GPIOC, .SCL_Pin = GPIO_PIN_10,
    .SDA_Port = GPIOC, .SDA_Pin = GPIO_PIN_12,
    .DelayTicks = 40,
};
static bool s_bus_ready;

static int scan_bus(void)
{
    int found = 0;
    for (uint8_t a = 0x08; a < 0x78; a++) {
        SWI2C_Start(&s_bus);
        uint8_t ack = SWI2C_WriteByte(&s_bus, (uint8_t)(a << 1));   /* write address */
        SWI2C_Stop(&s_bus);
        if (ack) {
            BT_LOG("[IMU] device answers at 0x%02X", a);
            found++;
        }
    }
    return found;
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

void Imu_Probe(void)
{
    if (!s_bus_ready) {
        SWI2C_Init(&s_bus);
        s_bus_ready = true;
    }
    BT_LOG("[IMU] scanning H2 (SCL PC10, SDA PC12)...");
    if (scan_bus() == 0) {
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
    BT_LOG("[IMU] at rest: one axis of acc ~ +-16384 (1 g), gyro ~ 0 (drift of a few counts is normal).");
    BT_LOG("[IMU] turn the robot by hand while repeating IMU: gyro Z should swing by thousands.");
}
