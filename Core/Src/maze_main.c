#include "maze_main.h"
#include "FreeRTOS.h"
#include "debug_log.h"
#include "cmsis_os.h"
#include "maze.h"
#include <stdint.h>

extern osMessageQueueId_t mazeQueueHandle;

void gotoGoal(CELL goal)
{
    uint8_t mazeVar[20] = {'\0'};
    // Check for the Maze data pushed into the queue
    while (osMessageQueueGet(mazeQueueHandle, mazeVar, NULL, osWaitForever) == osOK )
    {
        // Read the values from the UART
        CELL start;
        CELL end;
        ABSOLUTE_DIRECTION currentDir;
        CELL cposition;
        SimWalls_t walls;

        start.x = mazeVar[0]-48; start.y= mazeVar[1]-48; end.x = mazeVar[2]-48; end.y = mazeVar[3]-48;
        currentDir = mazeVar[4]-48; cposition.x = mazeVar[5]-48; cposition.y = mazeVar[6]-48;
        walls.north = (mazeVar[7]== 49) ? WALL_PRESENT : WALL_ABSENT;
        walls.south = (mazeVar[8]== 49) ? WALL_PRESENT : WALL_ABSENT;
        walls.west = (mazeVar[9]== 49) ? WALL_PRESENT : WALL_ABSENT;
        walls.east = (mazeVar[10]== 49) ? WALL_PRESENT : WALL_ABSENT;

        CURRENT_CELL.x = cposition.x; CURRENT_CELL.y = cposition.y;
        CURRENT_ABSOLUTE_DIRECTION = currentDir;
        goal.x = end.x; goal.y = end.y;



        // uint8_t 
        if((CURRENT_CELL.x != goal.x) || (CURRENT_CELL.y != goal.y)){
        #if !ENABLE_SIMULATION && !ENABLE_WEB_SIMULATION
        // read the values from 3 sensors for mapping walls.
        WallState frontWall = (API_frontWall() == 1) ? WALL_PRESENT : WALL_ABSENT;
        WallState rightWall = (API_rightWall() == 1) ? WALL_PRESENT : WALL_ABSENT;
        WallState leftWall  = (API_leftWall() == 1) ? WALL_PRESENT : WALL_ABSENT;

        #elif ENABLE_SIMULATION && !ENABLE_WEB_SIMULATION
        // read the values from 3 sensors for mapping walls via simulation.
        WallState frontWall = 0;
        WallState rightWall = 0;
        WallState leftWall = 0;
        getSimulatedWall(CURRENT_CELL, CURRENT_ABSOLUTE_DIRECTION, &frontWall, &rightWall, &leftWall);

        #elif ENABLE_WEB_SIMULATION
        // read the values from 3 sensors for mapping walls via simulation.
        WallState frontWall = 0;
        WallState rightWall = 0;
        WallState leftWall = 0;
        getWallsFrom_Web_Simulation(CURRENT_ABSOLUTE_DIRECTION,walls.north, walls.south, walls.west, walls.east, &frontWall, &rightWall, &leftWall);
        #endif

        updateWalls(frontWall, rightWall, leftWall);
        
        propagateCost(goal);

        CELL nextCellToMove = smallestNextNeighbourCell(CURRENT_CELL, CURRENT_ABSOLUTE_DIRECTION);

        moveToCurrentLocation(CURRENT_CELL.x, CURRENT_CELL.y, nextCellToMove.x, nextCellToMove.y, &CURRENT_ABSOLUTE_DIRECTION);

        // Update current cell after movement.
        CURRENT_CELL.x = nextCellToMove.x; CURRENT_CELL.y = nextCellToMove.y;
        // break;

        }else {
        break;
        }
    }
    SEND_TMSG("G");
}

// this will be initialized as part of freeRTOS TASK. 

#if 0
int maze_main() {
    LOG_INFO("Main Maze begins");
    /*
    * Initialise the Walls based on out "L" finger rule.
    * All boundaries are marked as wall present and rest all as unseen
    */
    initWalls();

    // assign the goal.
    CELL goal = END;

    // set current cell to 0,0
    CURRENT_CELL.x = 0;
    CURRENT_CELL.y = 0;
    
    // Set current pointing Direction
    CURRENT_ABSOLUTE_DIRECTION = NORTH;

    // do update walls and propagate Cost till current cell != goal
    gotoGoal(goal);

    // give home as new goal and make the bot come back. 
    gotoGoal((CELL){0,0});
    

    return 0;
}
#endif