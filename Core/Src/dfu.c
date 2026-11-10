#include "dfu.h"

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"
#include "bt_log.h"
#include "motor.h"

/* The tinyuf2 bootloader (tinyuf2 repo: ports/stm32f4, board kavwv_ratrocket)
 * keeps its "double tap" flag in the last word of the first 64 KB of RAM: its
 * linker script sets _board_dfu_dbl_tap = 0x2000FFFC and starts its own stack
 * just below it. RAM keeps its contents across a software reset, so the
 * bootloader finds the value on its next start, clears it and stays in UF2
 * mode instead of starting this program. The magic is DBL_TAP_MAGIC from
 * tinyuf2 src/board_api.h. */
#define TINYUF2_DBL_TAP_ADDR   0x2000FFFCUL
#define TINYUF2_DBL_TAP_MAGIC  0xF01669EFUL

void Dfu_Enter(void)
{
    Motor_Coast();
    BT_LOG("[UPDATE] restarting into the USB bootloader: a drive named RATROCKET appears.");
    BT_LOG("[UPDATE] Copy ratrocket.uf2 onto it; the robot restarts by itself when done.");
    BT_LOG("[UPDATE] Press reset to leave without flashing.");
    osDelay(400);                               /* let the Bluetooth text go out */

    /* The word may belong to a task stack or the heap: nothing may run between
     * writing it and the reset. */
    __disable_irq();
    *(volatile uint32_t *)TINYUF2_DBL_TAP_ADDR = TINYUF2_DBL_TAP_MAGIC;
    __DSB();
    NVIC_SystemReset();
}
