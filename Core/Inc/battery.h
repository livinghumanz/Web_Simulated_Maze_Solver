#ifndef BATTERY_H
#define BATTERY_H

#include <stdint.h>

/* Supply voltage on PA0 through the 47k/22k divider, in mV.
 * On USB-C power this reads the USB rail after the input diode (~4.2 V). */
uint32_t Battery_ReadMv(void);

#endif /* BATTERY_H */
