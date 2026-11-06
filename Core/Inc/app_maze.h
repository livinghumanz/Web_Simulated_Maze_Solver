#ifndef APP_MAZE_H
#define APP_MAZE_H

#include <stdint.h>

/* Standalone maze mode (DIP: SW3). Ultrasonic wall sensing + PID motion +
 * flood-fill, controlled over Bluetooth (or the PB2 button = GO).
 * Never returns. */
void MazeApp_Run(uint8_t dip);

#endif /* APP_MAZE_H */
