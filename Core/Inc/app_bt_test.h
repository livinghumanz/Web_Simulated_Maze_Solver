#ifndef APP_BT_TEST_H
#define APP_BT_TEST_H

#include <stdint.h>

/* Bluetooth link test mode (DIP: SW1 only). Prints a 1 Hz heartbeat with
 * battery / encoder / DIP state and answers simple text commands over BT.
 * Motors stay off. Never returns. */
void BtTest_Run(uint8_t dip);

#endif /* APP_BT_TEST_H */
