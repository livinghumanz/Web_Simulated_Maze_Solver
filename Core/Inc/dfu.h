#ifndef DFU_H
#define DFU_H

/*
 * Firmware update over USB-C with the tinyuf2 bootloader, which lives in the
 * first 64 KB of flash and starts this program at 0x08010000:
 *
 *   send "UPDATE" (or "DFU") over Bluetooth or USB serial,
 *   or double-press the reset button
 *     -> Windows shows a USB drive named RATROCKET
 *   copy build/Debug/ratrocket.uf2 onto the drive
 *     -> the bootloader flashes it and restarts the robot
 *
 * Saved settings (flash sector 7) are not touched. Pressing reset while the
 * drive is shown returns to the current firmware, so nothing can be bricked.
 */

/* Ask the bootloader to stay in UF2 mode and reset the chip. Never returns. */
void Dfu_Enter(void);

#endif /* DFU_H */
