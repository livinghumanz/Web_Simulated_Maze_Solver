/**
 * @file maze.h
 * @brief Header file for maze-related structures and definitions.
 *
 * This file contains the definitions and structures used for representing
 * and manipulating a maze. The primary structure defined in this file is
 * the CELL structure, which represents a single cell in the maze with its
 * row and column coordinates.
 *
 * The CELL structure uses uint8_t for the coordinates, which allows for
 * efficient storage and manipulation of maze cells. The coordinates are
 * represented as follows:
 * - x: The row of the cell in the maze.
 * - y: The column of the cell in the maze.
 *
 * Additional Notes and developer Hint.
 * 
 * Position : 
 * The following is a representation of a 2x2 matrix with North, South, East, and West coordinates:
 *
 *      (0,1)   -- North -->   (1,1)
 *        |                      |
 *      West                    East
 *        |    ^ mouse_point(N)  |
 *      (0,0)   -- South -->   (0,1)
 *
 * Maze is considered as constant irrespective of mouse position.
 * Certain placement is suggested based on "L" rule.
 * Mouse always points North and maze initial coordinates are same.
 * 
 * REF: 
 * 
 *  
 * The following is a representation of a 4x4 matrix with North, South, East, and West coordinates:
 *
 *            3              2              1              0
 *            0              1              2              3
 *   0 - 3  (x,y)  ----->  (x,y)  ----->  (x,y)  ----->  (x,y)  3 - 0
 *            |    (>)N      |              |       (v)    |
 *            |              |              |        N     |
 *   1 - 2  (x,y)  ----->  (x,y)  ----->  (x,y)  ----->  (x,y)  2 - 1
 *            |              |              |              |
 *            |              |              |              |
 *   2 - 1  (x,y)  ----->  (x,y)  ----->  (x,y)  ----->  (x,y)  1 - 2
 *            |     N        |              |              |
 *            |    (^)       |              |      N(<)    |
 *   3 - 0  (x,y)  ----->  (x,y)  ----->  (x,y)  ----->  (x,y)  0 - 3
*             0              1              2              3
*             3              2              1              0
 *
 * ^ -- represents the head placement of the bot, the pointing head is always considered as (North)
 * 
 */

#ifndef MAZE_H
#define MAZE_H

#include<stdbool.h>
#include<stdint.h>

// Constants
#define MAZE_DIMENSIONS 5
#define MAZE_CELL_COUNT (MAZE_DIMENSIONS * MAZE_DIMENSIONS)
#define MAX_COST (MAZE_CELL_COUNT -1)

// Define Start and end (X, Y) coordinates.
#define START {0, 0}
#define END {3, 3}

typedef struct
{
    uint8_t x; // represents row.
    uint8_t y; // represents column
}CELL;


typedef struct
{
    uint8_t north;
    uint8_t south;
    uint8_t west;
    uint8_t east;
} SimWalls_t;


// constant to handle unreachable cells (cells beyond the range)
#define UNREACH_X 254
#define UNREACH_Y 254

// Absolute direction represents compass direction
typedef enum 
{ 
    NORTH,
    SOUTH,
    WEST,
    EAST,
    ABS_DIR_COUNT,
    BLOCKED = 99 
} ABSOLUTE_DIRECTION;

typedef enum {
    WALL_ABSENT = 0x00,  // a wall that has been seen and confirmed absent
    WALL_PRESENT = 0x01, // a wall that has been seen and confirmed present
    WALL_UNSEEN = 0x02,  // a wall that has not yet been seen
    WALL_VIRTUAL = 0x03, // a wall that does not exist in the physical maze, used for special cases
} WallState;

// by default wallInfo will be WALL_UNSEEN
typedef struct {
    WallState north : WALL_UNSEEN;
    WallState east  : WALL_UNSEEN;
    WallState south : WALL_UNSEEN;
    WallState west  : WALL_UNSEEN;
} WallInfo;

typedef enum {
    MASK_TREAT_AS_ABSENT = WALL_ABSENT,  // treat unseen walls as absent during search TODO: RAMESH SHARMA (This will make all walls absent. doesn't work.)
    MASK_TREAT_AS_PRESENT = WALL_PRESENT, // treat unseen walls as present during speed run
} MazeMask;


void initWalls();
CELL neighbourCell(CELL cell, ABSOLUTE_DIRECTION direction);
uint8_t isCellAccessible(CELL cell, ABSOLUTE_DIRECTION direction);
void updateWalls(WallState frontWall, WallState rightWall, WallState leftWall);

#endif // MAZE_H