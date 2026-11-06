#ifndef ULTRASONIC_H
#define ULTRASONIC_H

/*
 * 3x HC-SR04 on the ultrasonic interface board (schematic module 3-4, p.1),
 * plugged into header H3:
 *
 *   channel  sensor  TRIG            ECHO
 *   0        US1     G1 = PB10       A0 = PA1 (EXTI1)
 *   1        US2     A3 = PA4        A1 = PA2 (EXTI2)
 *   2        US3     A4 = PA5        A2 = PA3 (EXTI3)
 *
 * A background task fires the sensors one after another (so they never hear
 * each other's echo). The echo pulse is timed with EXTI interrupts and the
 * DWT cycle counter, so no task ever busy-waits on an echo.
 */

#include <stdbool.h>
#include <stdint.h>

#define US_COUNT   3
#define US_FAR_MM  9999U     /* no echo / out of range */

/* Reconfigure the pins and start the measuring task. */
void Ultrasonic_Start(void);

/* Latest distance for a channel in mm (US_FAR_MM if no echo). */
uint16_t Ultrasonic_GetMm(uint8_t ch);

/* Number of completed measurements on a channel (to detect fresh data). */
uint32_t Ultrasonic_GetCount(uint8_t ch);

/* Median of the next n fresh readings of every channel (blocks ~n cycles).
 * out[] must hold US_COUNT entries. */
void Ultrasonic_ReadMedian(uint16_t out[US_COUNT], uint8_t n);

#endif /* ULTRASONIC_H */
