#ifndef SIMULATOR_H
#define SIMULATOR_H

#include "maze.h"

/***
 * @brief 
 * irSensor here represents: 
 *  - Right = 82 (ASCII of 'R')
 *  - Left = 76 (ASCII of 'L')
 *  - Front = 70 (ASCII of 'F')
 */
void getSimulatedWall(CELL currentCell, ABSOLUTE_DIRECTION pointingDirection, WallState *frontWall, WallState *rightWall, WallState *leftWall);
void getWallsFrom_Web_Simulation(
    ABSOLUTE_DIRECTION dir,
    WallState north,
    WallState south,
    WallState west,
    WallState east,
    WallState *frontWall,
    WallState *rightWall,
    WallState *leftWall);
#endif // SIMULATOR_H