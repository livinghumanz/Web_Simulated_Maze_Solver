#ifndef LOCOMOTION_H
#define LOCOMOTION_H

#include<stdint.h>
#include "maze.h"

uint8_t API_leftWall();
uint8_t API_frontWall();
uint8_t API_rightWall();

void API_turnRight();
void API_turnLeft();
void API_goStraight();
void API_uTurn();

void moveToCurrentLocation(uint8_t present_row_x, uint8_t present_col_y, uint8_t current_row_x, uint8_t current_col_y, ABSOLUTE_DIRECTION *compass);

#endif // LOCOMOTION_H