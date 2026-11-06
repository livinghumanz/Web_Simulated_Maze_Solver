#include "dfu.h"

#include "FreeRTOS.h"
#include "task.h"
#include "cmsis_os.h"
#include "main.h"
#include "bt_log.h"
#include "motor.h"

#define SYSTEM_MEMORY_ADDR 0x1FFF0000UL   /* STM32F411 system (ROM) bootloader */
#define DFU_MAGIC          0xB007D0F0UL

/* Survives a software reset: the .noinit section is not cleared at startup. */
__attribute__((section(".noinit"))) static volatile uint32_t s_dfu_request;
/* Diagnostics (read over SWD): number of jumps into the bootloader. */
__attribute__((section(".noinit"))) volatile uint32_t g_dfu_jumps;

/* Step 1 (from the running firmware): remember the request and reset.
 *
 * Findings on this board (2026-11-06):
 * - Jumping into the ROM bootloader from the running RTOS, or from a clean
 *   reset state, both end in a software reset by the bootloader itself unless
 *   BOOT0 is held high (it re-checks the pin). With BOOT0 held it runs
 *   (PC = 0x1FFF281A).
 * - Its USB DFU then fails to enumerate ("Device Descriptor Request Failed"),
 *   the known STM32F411 + 25 MHz HSE bootloader problem. So flashing over
 *   USB-C does not work on this board yet; use the ST-Link. */
void Dfu_Enter(void)
{
    Motor_Coast();
    BT_LOG("[DFU] restarting into the USB bootloader. Keep BOOT0 held while this runs:");
    BT_LOG("[DFU] this chip's bootloader resets itself if BOOT0 is low.");
    BT_LOG("[DFU] Reset or power-cycle to return to the normal firmware.");
    osDelay(400);                               /* let the Bluetooth text go out */
    s_dfu_request = DFU_MAGIC;
    __DSB();
    NVIC_SystemReset();
}

/* Step 2 (first thing in main, before HAL_Init): the chip is in its reset
 * state - HSI clock, no peripherals, no interrupts - exactly what the ROM
 * bootloader expects. */
void Dfu_CheckAtStartup(void)
{
    if (s_dfu_request != DFU_MAGIC) {
        return;
    }
    s_dfu_request = 0;                          /* next reset boots normally */
    g_dfu_jumps++;

    __HAL_RCC_SYSCFG_CLK_ENABLE();
    __HAL_SYSCFG_REMAPMEMORY_SYSTEMFLASH();     /* as a BOOT0 start would */

    uint32_t boot_sp = *(volatile uint32_t *)SYSTEM_MEMORY_ADDR;
    void (*boot_entry)(void) = (void (*)(void))(*(volatile uint32_t *)(SYSTEM_MEMORY_ADDR + 4U));
    __set_MSP(boot_sp);
    __DSB();
    __ISB();
    boot_entry();

    for (;;) { }
}
