#include "dip_switch.h"

#include "main.h"

/*
 * Hardware notes (schematic + measured, see docs/hardware.md):
 *  - Each line: 3.3 V -> 10 k -> switch -> pin, with a 100 k pull-down on the
 *    board. ON = high. The CubeMX NOPULL setting is correct; an internal
 *    pull-down would drop the ON level to ~2.4 V, too close to VIH.
 *  - The switch the user calls "1" is wired to PC3, so the order is reversed
 *    relative to the CubeMX labels Select_Switch_1..4 (PC0..PC3).
 */
#define SW1_PORT Select_Switch_4_GPIO_Port   /* PC3 */
#define SW1_PIN  Select_Switch_4_Pin
#define SW2_PORT Select_Switch_3_GPIO_Port   /* PC2 */
#define SW2_PIN  Select_Switch_3_Pin
#define SW3_PORT Select_Switch_2_GPIO_Port   /* PC1 */
#define SW3_PIN  Select_Switch_2_Pin
#define SW4_PORT Select_Switch_1_GPIO_Port   /* PC0 */
#define SW4_PIN  Select_Switch_1_Pin

uint8_t DIP_Read(void)
{
    uint8_t v = 0;
    if (HAL_GPIO_ReadPin(SW1_PORT, SW1_PIN) == GPIO_PIN_SET) v |= DIP_SW1;
    if (HAL_GPIO_ReadPin(SW2_PORT, SW2_PIN) == GPIO_PIN_SET) v |= DIP_SW2;
    if (HAL_GPIO_ReadPin(SW3_PORT, SW3_PIN) == GPIO_PIN_SET) v |= DIP_SW3;
    if (HAL_GPIO_ReadPin(SW4_PORT, SW4_PIN) == GPIO_PIN_SET) v |= DIP_SW4;
    return v;
}

const char *DIP_ModeName(uint8_t dip)
{
    switch (dip) {
    case APP_MODE_WEB_SIM: return "WEB_SIM (flood-fill via USART1 simulator)";
    case APP_MODE_BT_TEST: return "BT_TEST (Bluetooth link test, motors off)";
    case APP_MODE_MOTOR_TEST: return "MOTOR_TEST (open-loop motor/encoder checks, wheels lifted)";
    case APP_MODE_PID_TEST:   return "PID_TEST (closed-loop wheel PID, tuning over BT)";
    case APP_MODE_MAZE:       return "MAZE (standalone: ultrasonic + PID + flood-fill)";
    default:               return "UNASSIGNED";
    }
}
