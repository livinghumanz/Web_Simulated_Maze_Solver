#include<stdio.h>
#include "cmsis_os2.h"
#include "maze.h"
#include "Locomotion.h"
#include "debug_log.h"
#include "motor.h"

extern osMessageQueueId_t motorQueueHandle;

uint8_t API_leftWall()
{
    // return 0 if no wall else return 1
    uint8_t w = 0;
    LOG_INFO("\nEnter left wall ch: ");
    scanf("%hhu",&w);
    if(w == 1)
        return 1;
    else
        return 0;
}

uint8_t API_rightWall()
{
    // return 0 if no wall else return 1
    uint8_t w = 0;
    LOG_INFO("\nEnter right wall ch: ");
    scanf("%hhu",&w);
    if(w == 1)
        return 1;
    else
        return 0;
}

uint8_t API_frontWall()
{
    // return 0 if no wall else return 1
    uint8_t w = 0;
    LOG_INFO("\nEnter front wall ch: ");
    scanf("%hhu",&w);
    if(w == 1)
        return 1;
    else
        return 0;
}

void API_turnRight()
{
    // LOG_INFO("\n == Turn Right ==\n");
    // Put Turn right and forward to the queue
    MotionDirection nextMove = RIGHT;
    osMessageQueuePut(motorQueueHandle, &nextMove, 0, 10);
    // right(850, 850);
    // osDelay(200);
    // stop_Slow();
}

void API_turnLeft()
{
    // LOG_INFO("\n == Turn Left ==\n");
    // Put Turn right and forward to the queue
    MotionDirection nextMove = LEFT;
    osMessageQueuePut(motorQueueHandle, &nextMove, 0, 10);
    left(850, 850);
    osDelay(200);
    stop_Slow();
}

void API_goStraight()
{
    // LOG_INFO("\n == go Straight ==\n");
    // Put Turn right and forward to the queue
    MotionDirection nextMove = FORWARD;
    osMessageQueuePut(motorQueueHandle, &nextMove, 0, 10);
    // forward(850, 850);
    // osDelay(200);
    // stop_Slow();
}

void API_uTurn()
{
    // LOG_INFO("\n == U-Turn ==\n");
    // Put Turn right and forward to the queue
    MotionDirection nextMove = UTURN;
    osMessageQueuePut(motorQueueHandle, &nextMove, 0, 10);
    // right(850, 850);
    // osDelay(200);
    // stop_Slow();
    // right(850, 850);
    // osDelay(200);
    // stop_Slow();
}

void moveToCurrentLocation(uint8_t present_row_x, uint8_t present_col_y, uint8_t current_row_x, uint8_t current_col_y, ABSOLUTE_DIRECTION *compass)
{
    switch (*compass)
    {
    case NORTH:
        {
            LOG_INFO("\n--- Facing: NORTH ----\n");
            if((present_row_x +1) == current_row_x)
            {
                // (x+1)
                API_turnRight();
                API_goStraight();
                *compass = EAST;

            } 
            else if((present_row_x -1) == current_row_x)
            {
                // (x-1)
                API_turnLeft();
                API_goStraight();
                *compass = WEST;
            }
            else if((present_col_y +1) == current_col_y)
            {
                // (y+1)
                API_goStraight();
            }
            else if((present_col_y -1) == current_col_y)
            {
                // (y-1)
                API_uTurn();
                API_goStraight();
                *compass = SOUTH;
            }
        }
        break;
    
    case SOUTH:
        {
            LOG_INFO("\n--- Facing: SOUTH ----\n");
            if((present_row_x +1) == current_row_x)
            {
                // (x+1)
                API_turnLeft();
                API_goStraight();
                *compass = EAST;
            } 
            else if((present_row_x -1) == current_row_x)
            {
                // (x-1)
                API_turnRight();
                API_goStraight();
                *compass = WEST;
            }
            else if((present_col_y +1) == current_col_y)
            {
                // (y+1)
                API_uTurn();
                API_goStraight();
                *compass = NORTH;

            }
            else if((present_col_y -1) == current_col_y)
            {
                // (y-1)
                API_goStraight();
            }
        }
        break;
    
    case EAST:
        {
            LOG_INFO("\n--- Facing: EAST ----\n");
            if((present_row_x +1) == current_row_x)
            {
                // (x+1)
                API_goStraight();
            } 
            else if((present_row_x -1) == current_row_x)
            {
                // (x-1)
                API_uTurn();
                API_goStraight();
                *compass = WEST;
            }
            else if((present_col_y +1) == current_col_y)
            {
                // (y+1)
                API_turnLeft();
                API_goStraight();
                *compass = NORTH;
            }
            else if((present_col_y -1) == current_col_y)
            {
                // (y-1)
                API_turnRight();
                API_goStraight();
                *compass = SOUTH;
            }
        }
        break;
    
    case WEST:
        {
            LOG_INFO("\n--- Facing: WEST ----\n");
            if((present_row_x +1) == current_row_x)
            {
                // (x+1)
                API_uTurn();
                API_goStraight();
                *compass = EAST;
            } 
            else if((present_row_x -1) == current_row_x)
            {
                // (x-1)
                API_goStraight();
            }
            else if((present_col_y +1) == current_col_y)
            {
                // (y+1)
                API_turnRight();
                API_goStraight();
                *compass = NORTH;
            }
            else if((present_col_y -1) == current_col_y)
            {
                // (y-1)
                API_turnLeft();
                API_goStraight();
                *compass = SOUTH;
            }
        }
        break;
    
    default:
        break;
    }
}