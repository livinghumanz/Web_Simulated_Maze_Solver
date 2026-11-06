#ifndef APP_MOTOR_TEST_H
#define APP_MOTOR_TEST_H

#include <stdint.h>

/* Motor / encoder characterisation mode (DIP: SW2 only). Open-loop PWM,
 * speed sweep and encoder jog commands over Bluetooth, to find wheel/encoder
 * directions, the PWM dead-band and the encoder counts per wheel turn before
 * closing the PID loop. Wheels must be off the ground. Never returns. */
void MotorTest_Run(uint8_t dip);

#endif /* APP_MOTOR_TEST_H */
