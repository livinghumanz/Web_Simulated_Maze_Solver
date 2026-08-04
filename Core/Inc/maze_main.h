/*
Files As part of this Algorithm 
maze_main.c
maze_main.h

queue.c 
queue.h

maze.c
maze.h

Locomotion.c
Locomotion.h

costAlgorithm.c
costAlgorithm.h

Simulation:
simulator.c
INCLUDE_WALLS.h
simulator.h

*/

#include <stdio.h>
#include "Locomotion.h"
#include "costAlgorithm.h"
#include "debug_log.h"

// enable this to perform run via simulation.
#define ENABLE_SIMULATION 1
#if ENABLE_SIMULATION
    #include "simulator.h"
#endif

#define ENABLE_WEB_SIMULATION 1

extern CELL CURRENT_CELL;
extern ABSOLUTE_DIRECTION CURRENT_ABSOLUTE_DIRECTION;

// Path Finding from Home to goal and goal to home. Vice versa
void gotoGoal(CELL goal);