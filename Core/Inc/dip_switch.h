#ifndef DIP_SWITCH_H
#define DIP_SWITCH_H

#include <stdint.h>

/*
 * 4-way DIP switch (100 k pull-downs on the board). ON = pin high.
 * Physical SW1..SW4 are wired to PC3..PC0
 * (reverse of the CubeMX labels, see dip_switch.c).
 *
 * The raw value is a bit mask: SW1 = bit0, SW2 = bit1, SW3 = bit2, SW4 = bit3.
 * Each mask value selects one firmware mode at boot.
 */

#define DIP_SW1 (1U << 0)
#define DIP_SW2 (1U << 1)
#define DIP_SW3 (1U << 2)
#define DIP_SW4 (1U << 3)

typedef enum {
    APP_MODE_WEB_SIM = 0x0,              /* all OFF: flood-fill fed by the web simulator over USART1 */
    APP_MODE_BT_TEST = DIP_SW1,          /* SW1: Bluetooth link test, telemetry only, motors off */
    APP_MODE_MOTOR_TEST = DIP_SW2,       /* SW2: motor/encoder characterisation over BT (wheels lifted) */
    APP_MODE_PID_TEST = DIP_SW1 | DIP_SW2, /* SW1+SW2: closed-loop wheel PID test & tuning over BT */
    APP_MODE_MAZE = DIP_SW3,             /* SW3: standalone maze (ultrasonic + PID + flood-fill) */
} AppMode;

uint8_t DIP_Read(void);
const char *DIP_ModeName(uint8_t dip);

#endif /* DIP_SWITCH_H */
