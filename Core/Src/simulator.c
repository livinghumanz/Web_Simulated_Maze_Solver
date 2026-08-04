#include <stdint.h>
#include "simulator.h"

#define CORD(N,S,W,E) {N, S, W, E}
#define GRID_ELEMENT(...) { __VA_ARGS__ },
#define GRID_DIMENSION 5

uint8_t simulatedGrid[GRID_DIMENSION][GRID_DIMENSION][4] = {
    #include "INCLUDE_WALLS.h"
};


/***
 * @brief 
 * irSensor here represents: 
 *  - Right = 82 (ASCII of 'R')
 *  - Left = 76 (ASCII of 'L')
 *  - Front = 70 (ASCII of 'F')
 * 
 * ****************
 * 0 - if no wall
 * 1- if wall present
 * 
 * ****************
 * North = 0 , south = 1, west = 2, east = 3
 * 
 */
void getSimulatedWall(CELL currentCell, ABSOLUTE_DIRECTION pointingDirection, WallState *frontWall, WallState *rightWall, WallState *leftWall)
{
    switch (pointingDirection)
    {
    case NORTH:
        *frontWall = simulatedGrid[currentCell.x][currentCell.y][0];
        *rightWall = simulatedGrid[currentCell.x][currentCell.y][3]; // east
        *leftWall = simulatedGrid[currentCell.x][currentCell.y][2]; // west
        break;
    case SOUTH:
        *frontWall = simulatedGrid[currentCell.x][currentCell.y][1];
        *rightWall = simulatedGrid[currentCell.x][currentCell.y][2]; // west
        *leftWall = simulatedGrid[currentCell.x][currentCell.y][3]; // east
        break;
    case WEST:
        *frontWall = simulatedGrid[currentCell.x][currentCell.y][2];
        *rightWall = simulatedGrid[currentCell.x][currentCell.y][0]; // north
        *leftWall = simulatedGrid[currentCell.x][currentCell.y][1]; // south
        break;
    case EAST:
        *frontWall = simulatedGrid[currentCell.x][currentCell.y][3];
        *rightWall = simulatedGrid[currentCell.x][currentCell.y][1]; // south
        *leftWall = simulatedGrid[currentCell.x][currentCell.y][0]; // north
        break;
    
    default:
        break;
    }
}


void getWallsFrom_Web_Simulation(
    ABSOLUTE_DIRECTION dir,
    WallState north,
    WallState south,
    WallState west,
    WallState east,
    WallState *frontWall,
    WallState *rightWall,
    WallState *leftWall)
{
    switch (dir)
    {
    case NORTH:

        *frontWall = north;
        *rightWall = east;
        *leftWall  = west;

        break;

    case SOUTH:

        *frontWall = south;
        *rightWall = west;
        *leftWall  = east;

        break;

    case WEST:

        *frontWall = west;
        *rightWall = north;
        *leftWall  = south;

        break;

    case EAST:

        *frontWall = east;
        *rightWall = south;
        *leftWall  = north;

        break;

    default:

        *frontWall = BLOCKED;
        *rightWall = BLOCKED;
        *leftWall  = BLOCKED;

        break;
    }
}
