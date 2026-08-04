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

void Print_Encoder_Left(int32_t * prev_count, uint8_t * prev_dir);
void Print_Encoder_Right( int32_t * prev_count, uint8_t * prev_dir);

#endif