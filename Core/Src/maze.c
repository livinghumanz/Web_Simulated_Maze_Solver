#include "maze.h"

WallInfo WALLS[MAZE_DIMENSIONS][MAZE_DIMENSIONS];
MazeMask MASKED_WALL = MASK_TREAT_AS_PRESENT;
CELL CURRENT_CELL = {0, 0};
ABSOLUTE_DIRECTION CURRENT_ABSOLUTE_DIRECTION = NORTH;

void initWalls()
{
    for(uint8_t x =0; x < MAZE_DIMENSIONS; x++ )
    {
        for(uint8_t y =0; y < MAZE_DIMENSIONS; y++)
        {
            if(x == 0)
            {
                if(y == 0)
                {
                    WALLS[x][y].north = WALL_UNSEEN;
                    WALLS[x][y].south = WALL_PRESENT;
                    WALLS[x][y].west = WALL_PRESENT;
                    WALLS[x][y].east = WALL_UNSEEN;
                }
                else if( y == (MAZE_DIMENSIONS -1)){
                    WALLS[x][y].north = WALL_PRESENT;
                    WALLS[x][y].south = WALL_UNSEEN;
                    WALLS[x][y].west = WALL_PRESENT;
                    WALLS[x][y].east = WALL_UNSEEN;

                }else{
                    WALLS[x][y].north = WALL_UNSEEN;
                    WALLS[x][y].south = WALL_UNSEEN;
                    WALLS[x][y].west = WALL_PRESENT;
                    WALLS[x][y].east = WALL_UNSEEN;

                }
            }
            else if( y == 0 && x!= 0 ){
                if(x == (MAZE_DIMENSIONS -1)){
                    WALLS[x][y].north = WALL_UNSEEN;
                    WALLS[x][y].south = WALL_PRESENT;
                    WALLS[x][y].west = WALL_UNSEEN;
                    WALLS[x][y].east = WALL_PRESENT;
                }
                else{
                    WALLS[x][y].north = WALL_UNSEEN;
                    WALLS[x][y].south = WALL_PRESENT;
                    WALLS[x][y].west = WALL_UNSEEN;
                    WALLS[x][y].east = WALL_UNSEEN;
                }
            }
            else if( y == (MAZE_DIMENSIONS -1) && x!=0 ){
                if(x == (MAZE_DIMENSIONS-1)){
                    WALLS[x][y].north = WALL_PRESENT;
                    WALLS[x][y].south = WALL_UNSEEN;
                    WALLS[x][y].west = WALL_UNSEEN;
                    WALLS[x][y].east = WALL_PRESENT;
                }
                else{
                    WALLS[x][y].north = WALL_PRESENT;
                    WALLS[x][y].south = WALL_UNSEEN;
                    WALLS[x][y].west = WALL_UNSEEN;
                    WALLS[x][y].east = WALL_UNSEEN;
                }
                
            }else if(x == (MAZE_DIMENSIONS-1) && (y !=0 && y!= (MAZE_DIMENSIONS-1))){
                WALLS[x][y].north = WALL_UNSEEN;
                WALLS[x][y].south = WALL_UNSEEN;
                WALLS[x][y].west = WALL_UNSEEN;
                WALLS[x][y].east = WALL_PRESENT;
            }else{
                WALLS[x][y].north = WALL_UNSEEN;
                WALLS[x][y].south = WALL_UNSEEN;
                WALLS[x][y].west = WALL_UNSEEN;
                WALLS[x][y].east = WALL_UNSEEN;
            }
        }
    }
}

CELL neighbourCell(CELL cell, ABSOLUTE_DIRECTION direction)
{
    switch (direction)
    {
    case NORTH:{
        uint8_t new_y = cell.y+1;
        if(new_y >= MAZE_DIMENSIONS){
            CELL neighbourCell = {UNREACH_X, UNREACH_Y};
            return neighbourCell;
        }
        CELL neighbourCell = {cell.x, new_y};
        return neighbourCell;
    }
    case SOUTH:{
        uint8_t new_y = cell.y-1;
        if(new_y >= MAZE_DIMENSIONS){
            CELL neighbourCell = {UNREACH_X, UNREACH_Y};
            return neighbourCell;
        }
        CELL neighbourCell = {cell.x, new_y};
        return neighbourCell;
    }
    case WEST:{
        uint8_t new_x = cell.x-1;
        if(new_x >= MAZE_DIMENSIONS){
            CELL neighbourCell = {UNREACH_X, UNREACH_Y};
            return neighbourCell;
        }
        CELL neighbourCell = {new_x, cell.y};
        return neighbourCell;
    }
    case EAST:{
        uint8_t new_x = cell.x+1;
        if(new_x >= MAZE_DIMENSIONS){
            CELL neighbourCell = {UNREACH_X, UNREACH_Y};
            return neighbourCell;
        }
        CELL neighbourCell = {new_x, cell.y};
        return neighbourCell;
    } 
    default:
        // Invalid direction, return current cell
        return cell;
    }
}

WallState neighbourCellWallState(WallState currentState, WallState newState)
{
    if((currentState & WALL_UNSEEN) == WALL_UNSEEN){ // Check if the wall is unseen before updating
        return newState;
    }
    return currentState;
}

void updateWalls(WallState frontWall, WallState rightWall, WallState leftWall)
{
    // TODO: "Ramesh Sharma" we should not assign current cell as neighbour cell if it's the border cell. need to do additional work or checks
    CELL northCell = neighbourCell(CURRENT_CELL, NORTH);
    CELL southCell = neighbourCell(CURRENT_CELL, SOUTH);
    CELL westCell  = neighbourCell(CURRENT_CELL, WEST);
    CELL eastCell  = neighbourCell(CURRENT_CELL, EAST);

    // TODO: "Ramesh Sharma" below conditions works for all cells other that border cells. need to tweak this part alone
    switch(CURRENT_ABSOLUTE_DIRECTION){
        case NORTH:{
            // check north cell validity before proceeding.
            if(!(northCell.x == UNREACH_X || northCell.y == UNREACH_Y)){
                WallState northState = neighbourCellWallState(WALLS[northCell.x][northCell.y].south, 
                                                                frontWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].north = northState;
                WALLS[northCell.x][northCell.y].south = northState;
            }

            // check west cell validity before proceeding.
            if(!(westCell.x == UNREACH_X || westCell.y == UNREACH_Y)){
                WallState westState = neighbourCellWallState(WALLS[westCell.x][westCell.y].east, 
                                                                leftWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].west = westState;
                WALLS[westCell.x][westCell.y].east = westState;
            }
            
            // check east cell validity before proceeding.
            if(!(eastCell.x == UNREACH_X || eastCell.y == UNREACH_Y)){
                WallState eastState = neighbourCellWallState(WALLS[eastCell.x][eastCell.y].west, 
                                                                rightWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].east = eastState;
                WALLS[eastCell.x][eastCell.y].west = eastState;
            }

            break;
        }
        case SOUTH:{
            // check south cell validity before proceeding.
            if(!(southCell.x == UNREACH_X || southCell.y == UNREACH_Y)){
                WallState southState = neighbourCellWallState(WALLS[southCell.x][southCell.y].north, 
                                                                frontWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].south = southState;
                WALLS[southCell.x][southCell.y].north = southState;
            }

            // check west cell validity before proceeding.
            if(!(westCell.x == UNREACH_X || westCell.y == UNREACH_Y)){
                WallState westState = neighbourCellWallState(WALLS[westCell.x][westCell.y].east, 
                                                                rightWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].west = westState;
                WALLS[westCell.x][westCell.y].east = westState;
            }
            
            // check east cell validity before proceeding.
            if(!(eastCell.x == UNREACH_X || eastCell.y == UNREACH_Y)){
                WallState eastState = neighbourCellWallState(WALLS[eastCell.x][eastCell.y].west, 
                                                                leftWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].east = eastState;
                WALLS[eastCell.x][eastCell.y].west = eastState;
            }

            break;
        }
        case WEST:{
            // check north cell validity before proceeding.
            if(!(northCell.x == UNREACH_X || northCell.y == UNREACH_Y)){
                WallState northState = neighbourCellWallState(WALLS[northCell.x][northCell.y].south, 
                                                                rightWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].north = northState;
                WALLS[northCell.x][northCell.y].south = northState;
            }

            // check south cell validity before proceeding.
            if(!(southCell.x == UNREACH_X || southCell.y == UNREACH_Y)){
                WallState southState = neighbourCellWallState(WALLS[southCell.x][southCell.y].north, 
                                                                leftWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].south = southState;
                WALLS[southCell.x][southCell.y].north = southState;
            }

            // check west cell validity before proceeding.
            if(!(westCell.x == UNREACH_X || westCell.y == UNREACH_Y)){
                WallState westState = neighbourCellWallState(WALLS[westCell.x][westCell.y].east, 
                                                                frontWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].west = westState;
                WALLS[westCell.x][westCell.y].east = westState;
            }

            break;
        }
        case EAST:{
            // check north cell validity before proceeding.
            if(!(northCell.x == UNREACH_X || northCell.y == UNREACH_Y)){
                WallState northState = neighbourCellWallState(WALLS[northCell.x][northCell.y].south, 
                                                                leftWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].north = northState;
                WALLS[northCell.x][northCell.y].south = northState;
            }

            // check south cell validity before proceeding.
            if(!(southCell.x == UNREACH_X || southCell.y == UNREACH_Y)){    
                WallState southState = neighbourCellWallState(WALLS[southCell.x][southCell.y].north, 
                                                                rightWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].south = southState;
                WALLS[southCell.x][southCell.y].north = southState;
            }
            
            // check east cell validity before proceeding.
            if(!(eastCell.x == UNREACH_X || eastCell.y == UNREACH_Y)){
                WallState eastState = neighbourCellWallState(WALLS[eastCell.x][eastCell.y].west, 
                                                                frontWall);
                WALLS[CURRENT_CELL.x][CURRENT_CELL.y].east = eastState;
                WALLS[eastCell.x][eastCell.y].west = eastState;
            }

            break;
        }
        default:
        // Ignore others.
            break;
    }
}

uint8_t isCellAccessible(CELL cell, ABSOLUTE_DIRECTION direction)
{
    uint8_t accessible = 0;
    WallInfo walls = WALLS[cell.x][cell.y];
    switch (direction)
    {
    case NORTH:
        accessible = ((walls.north & MASKED_WALL) == WALL_ABSENT)? 1: 0;
        break;
    case SOUTH:
        accessible = ((walls.south & MASKED_WALL) == WALL_ABSENT)? 1: 0;
        break;
    case WEST:
        accessible = ((walls.west & MASKED_WALL) == WALL_ABSENT)? 1: 0;
        break;
    case EAST:
        accessible = ((walls.east & MASKED_WALL) == WALL_ABSENT)? 1: 0;
        break;
    default:
        accessible = 0;
        break;
    }

    return accessible;
}
