#ifndef SETTINGS_H
#define SETTINGS_H

/*
 * Maze-mode settings saved in the MCU's own flash (sector 7, 0x08060000,
 * reserved in the linker script). Survive power-off and restarts.
 *
 * Saving erases a 128 KB sector, which stalls the CPU for ~1-2 s: only save
 * while the robot is standing still.
 *
 * Layout version 2 (2026-11-11) adds GYROTURN and the gyro bias in use at the
 * time of SAVE. Version 1 data still loads (gyro fields keep their defaults).
 */

#include <stdbool.h>

/* Apply saved settings to g_maze_cfg and the motion controller.
 * Returns false (and changes nothing) if nothing valid is stored. */
bool Settings_Load(bool *button_escape);

bool Settings_Save(bool button_escape);

/* Forget saved settings (firmware defaults on next boot). */
bool Settings_Erase(void);

#endif /* SETTINGS_H */
