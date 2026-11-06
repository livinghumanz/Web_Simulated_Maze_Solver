#ifndef DFU_H
#define DFU_H

/*
 * Enter the STM32's built-in USB DFU bootloader from the running firmware,
 * so the board can be flashed over its USB-C port without pressing BOOT0:
 *
 *   send "DFU" over Bluetooth  ->  Windows shows "STM32 BOOTLOADER"
 *   STM32_Programmer_CLI -c port=USB1 -w firmware.elf -v -go
 *
 * A reset or power-cycle returns to the normal firmware, so nothing can be
 * bricked.
 */

/* Request the bootloader and reset the chip. Never returns. */
void Dfu_Enter(void);

/* Call first thing in main(): jumps to the bootloader if it was requested. */
void Dfu_CheckAtStartup(void);

#endif /* DFU_H */
