#ifndef MOTOR_H
#define MOTOR_H

#include <stdint.h>

typedef enum {
    FORWARD = 0,
    REVERSE = 1,
    LEFT = 2,
    RIGHT = 3,
    UTURN = 4,
    NONE = 5
}MotionDirection;

void forward(uint16_t duty_L, uint16_t duty_R);
void reverse(uint16_t duty_L, uint16_t duty_R);
void left(uint16_t duty_L, uint16_t duty_R);
void right(uint16_t duty_L, uint16_t duty_R);

void spin_Left(uint16_t duty_L, uint8_t dir_l);

void stop_Slow(void);
void stop_Fast(void);

/* ---- Signed per-wheel PWM (used by the motor test / PID code) ----
 * duty: -MOTOR_PWM_MAX .. +MOTOR_PWM_MAX, positive = wheel forward.
 * Driver inputs (vendor mapping): right = TIM3 CH1 fwd / CH2 rev,
 *                                 left  = TIM3 CH3 fwd / CH4 rev. */
#define MOTOR_PWM_MAX 1010   /* = TIM3 ARR set in main.c (~9.9 kHz PWM) */

void Motor_SetLeft(int16_t duty);
void Motor_SetRight(int16_t duty);
void Motor_SetPwm(int16_t left, int16_t right);
void Motor_BrakeLeft(void);    /* both inputs high: short the motor */
void Motor_BrakeRight(void);
void Motor_Brake(void);
void Motor_Coast(void);        /* both inputs low: motor free-wheels */

/* Motor driver outputs on/off at build time.
 * 0 (2026-11-07): after the PB1 -> IN3 repair the board heats on USB-C power,
 * i.e. something at the driver is shorted. PA6/PA7/PB0/PB1 are put in analog
 * mode (high impedance) at boot, so the MCU cannot drive or sink current into
 * the driver inputs. The robot is pushed by hand (push game); encoders,
 * ultrasonics and Bluetooth still work. Set back to 1 once the driver is fixed. */
#define MOTOR_OUTPUTS_ENABLED 1

/* Put the four driver input pins in analog mode (high impedance). */
void Motor_PinsHighZ(void);

/* Change the PWM frequency (keeps the 0..MOTOR_PWM_MAX duty range).
 * Returns the frequency actually set, in Hz. Default after boot: ~9.9 kHz. */
uint32_t Motor_SetPwmFrequency(uint32_t hz);
uint32_t Motor_GetPwmFrequency(void);

void Print_Encoder_Left(int32_t * prev_count, uint8_t * prev_dir);
void Print_Encoder_Right( int32_t * prev_count, uint8_t * prev_dir);

#endif