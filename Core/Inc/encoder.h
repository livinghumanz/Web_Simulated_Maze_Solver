#ifndef ENCODER_H
#define ENCODER_H

#include <stdint.h>

/*
 * Wheel encoders: TIM4 = left, TIM2 = right (quadrature, TI12 mode).
 *
 * The timers wrap at 16 bits, so Encoder_Update() accumulates 16-bit deltas
 * into 32-bit positions. Call it periodically (>= 10 Hz) from ONE task, so a
 * wheel never moves more than 32767 counts between calls. Reading the
 * positions from other tasks is safe (32-bit reads are atomic on Cortex-M4).
 *
 * Positive = wheel turning forward once the sign constants in encoder.c have
 * been calibrated.
 */

void Encoder_Init(void);      /* also resets positions to 0 */
void Encoder_Update(void);
int32_t Encoder_Left(void);
int32_t Encoder_Right(void);

#endif /* ENCODER_H */
