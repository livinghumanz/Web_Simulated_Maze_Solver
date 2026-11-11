#ifndef IMU_H
#define IMU_H

/*
 * IMU on header H2 (MPU6050-class module, software I2C: SCL PC10, SDA PC12).
 * Power comes through jumper JP3 (3.3 V or +5V_2) - without it the module
 * is unpowered and the bus scan finds nothing.
 *
 * Probe only for now: scans the bus, reads WHO_AM_I, prints a few raw
 * accelerometer/gyro samples over the console. Gyro-assisted turns come later.
 */

void Imu_Probe(void);

#endif /* IMU_H */
