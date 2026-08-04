#ifndef COSTALGORITHM_H
#define COSTALGORITHM_H

#include "maze.h"

typedef struct
{
    CELL neighbour;
    uint16_t NC_cost;
    ABSOLUTE_DIRECTION direction; 
}neighbourCellWeights;


void propagateCost(const CELL goal);
CELL smallestNextNeighbourCell(const CELL currentCell, const ABSOLUTE_DIRECTION currentPointingDirection);
uint16_t getNeighborsAndCosts(neighbourCellWeights *neighbors, WallInfo currentCellWallInfo, const CELL currentCell);

#endif // COSTALGORITHM_H