#ifndef APP_PID_TEST_H
#define APP_PID_TEST_H

#include <stdint.h>

/* Closed-loop wheel PID test & tuning mode (DIP: SW1 + SW2). Moves and gain
 * changes over Bluetooth, telemetry printed from the motion queue by a
 * low-priority task. Never returns. */
void PidTest_Run(uint8_t dip);

#endif /* APP_PID_TEST_H */
