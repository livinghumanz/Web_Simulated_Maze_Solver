#include "costAlgorithm.h"
#include "maze_queue.h"

extern WallInfo WALLS[MAZE_DIMENSIONS][MAZE_DIMENSIONS];

// Cost matrix which contains cell weights. 
uint16_t COSTMARY[MAZE_DIMENSIONS][MAZE_DIMENSIONS]; 

/*
 * This file contains the implementation of an algorithm to determine the area connected to a given node in a multi-dimensional array.
 * 
 * The algorithm is used to fill bounded areas with a specific value.
 * 
 * The algorithm works by starting at a given node and recursively filling all neighboring nodes that have the same initial value.
 * It continues to "fill" until it reaches nodes that have a different value or the boundary of the array like "flood".
 * 
 * The implementation in this file will include:
 * - A function to perform the area filling operation.
 * - Helper functions to check boundaries and valid moves.
 * - Example usage of the area filling function.
 *
*/

void propagateCost(const CELL goal)
{
    // set all cells cost to unachievable value (max_cost + 20)
    for(uint8_t x =0; x < MAZE_DIMENSIONS; x++){
        for(uint8_t y =0; y < MAZE_DIMENSIONS; y++){
            COSTMARY[x][y] = (uint16_t)(MAX_COST + 20); // Added an additional 20 so this cost is never achieved.
        }
    }

    // set goal cell cost value to '0' and push to the Queue.
    QUEUE queue;
    queueInit(&queue);
    COSTMARY[goal.x][goal.y] = 0;
    queuePush(&queue, goal);

    /*
     * while Queue is !empty 
     * 1. take the first pushed cell (front cell) 
     * 2. calculate new cell cost based on current cell cost
     * 3. Set all "Blank" and "accessible (No Walls)" cell's cost to new cost
     * 4. add processed cells to the queue.
     */
    while (!queueIsEmpty(&queue))
    {
        // pop the first element.
        CELL goalCurrentCell = queuePOP(&queue);
        // calculate the new cost.
        uint16_t newCost = COSTMARY[goalCurrentCell.x][goalCurrentCell.y] + 1;

        // Set all "Blank" and "accessible (No Walls)" cell's cost to new cost
        for(ABSOLUTE_DIRECTION direction = NORTH; direction < ABS_DIR_COUNT; direction++ ){
            if((isCellAccessible(goalCurrentCell, direction)) == 1)
            {
                CELL nextCell = neighbourCell(goalCurrentCell, direction);
                if(nextCell.x != UNREACH_X && nextCell.y != UNREACH_Y){
                    if(COSTMARY[nextCell.x][nextCell.y] > newCost){
                        COSTMARY[nextCell.x][nextCell.y] = newCost;
                        // push the new cell to the queue.
                        queuePush(&queue, nextCell);
                    }
                }
            }
        }

    }
}

uint16_t getNeighborsAndCosts(neighbourCellWeights *neighbors, WallInfo currentCellWallInfo, const CELL currentCell)
{
    /**
     * @brief get neighbour cells if there is no wall present between current cell and neighbour
     * 
     * @details 
     *  - if multiple weights of same value/ cost
     *      - choose the one in current pointing direction
     *          - if none in current pointing Direction ?
     *              - Prio-1: Left cell / right cell
     *                  - How to choose LEFT/ RIGHT ?
     *                      - Choose any one (the first instance/ last instance) TODO: Need to think "Ramesh Sharma"
     *              - Prio-2: U-Turn
     * 
     */
    
    uint16_t smallest_cost = MAX_COST+20;

    WallState currentCellWallState[] = { 
        currentCellWallInfo.north, 
        currentCellWallInfo.south,
        currentCellWallInfo.west,
        currentCellWallInfo.east
    };

    for (uint8_t i = 0; i < ABS_DIR_COUNT; i++)
    {
        if (currentCellWallState[i] == WALL_ABSENT)
        {
            CELL N_Cell  = neighbourCell(currentCell, (ABSOLUTE_DIRECTION)i);

            // check north cell validity before proceeding.
            if(!(N_Cell.x == UNREACH_X || N_Cell.y == UNREACH_Y)){
                // update neighbour cells.
                neighbors[i].neighbour.x = N_Cell.x;
                neighbors[i].neighbour.y = N_Cell.y;
                neighbors[i].NC_cost = COSTMARY[N_Cell.x][N_Cell.y];
                if(smallest_cost > neighbors[i].NC_cost){
                    smallest_cost = neighbors[i].NC_cost;
                }
            }
        }
    }

    return smallest_cost;
}

CELL smallestNextNeighbourCell(const CELL currentCell, const ABSOLUTE_DIRECTION currentPointingDirection)
{
    CELL nextCell = currentCell;
    WallInfo currentCellWallInfo = WALLS[currentCell.x][currentCell.y];
    uint16_t currentCellCost = COSTMARY[currentCell.x][currentCell.y];
    neighbourCellWeights neighbors[] = {
        {{UNREACH_X,UNREACH_Y}, (MAX_COST+20), NORTH},
        {{UNREACH_X,UNREACH_Y}, (MAX_COST+20), SOUTH},
        {{UNREACH_X,UNREACH_Y}, (MAX_COST+20), WEST},
        {{UNREACH_X,UNREACH_Y}, (MAX_COST+20), EAST},
        };

    uint16_t smallest_cost = getNeighborsAndCosts(neighbors, currentCellWallInfo, currentCell);

    CELL tempNextCell = {UNREACH_X,UNREACH_Y};

    // check if neighbor of same currentPointingDirection has <= costs when compared to all.

    for(uint8_t iter = 0; iter < ABS_DIR_COUNT; iter++)
    {
        if((neighbors[iter].NC_cost < currentCellCost) && neighbors[iter].NC_cost == smallest_cost)
        {
            if (neighbors[iter].direction == currentPointingDirection)
            {
                nextCell.x = neighbors[iter].neighbour.x;
                nextCell.y = neighbors[iter].neighbour.y;
            }
            else
            {
                tempNextCell.x = neighbors[iter].neighbour.x;
                tempNextCell.y = neighbors[iter].neighbour.y;
            }
        }
    }

    if ((nextCell.x == currentCell.x ) && (nextCell.y == currentCell.y))
    {
        if ((tempNextCell.x != UNREACH_X) && (tempNextCell.y != UNREACH_Y))
        {
            return tempNextCell;
        }
        else
        {
            return nextCell;
            
        }
        
        
        
    } else{
        return nextCell;
    }
}