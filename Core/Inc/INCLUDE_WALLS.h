/**
 * @brief this contains wall Info. every cell contains 4 values (N,S,W,E)
 * 
 * Make sure you give equal number or rows and columns else the system breaks. 
 * this example contains for 5X5 matrix.
 * 0 - if no wall
 * 1- if wall present
 * 
 * Format :
 * -----------
 * 
 * ---------- Repeat this for number of Rows and columns -------
 * 
 * GRID_ELEMENT(CORD(North, south, west, east), "element2", ... )
 *  :::
 *  :::
 * 
 * */

/* 5X5 Matrix --- (1) */ 
GRID_ELEMENT (CORD(0,1,1,1), CORD(0,0,1,1), CORD(1,0,1,0), CORD(0,1,1,0), CORD(1,0,1,0))
GRID_ELEMENT (CORD(0,1,1,0), CORD(0,0,1,1), CORD(0,0,0,1), CORD(1,0,0,0), CORD(1,1,0,0))
GRID_ELEMENT (CORD(1,1,0,0), CORD(0,1,1,0), CORD(1,0,1,1), CORD(1,1,0,1), CORD(1,1,0,0))
GRID_ELEMENT (CORD(1,1,0,0), CORD(1,1,0,0), CORD(0,1,1,1), CORD(0,0,1,1), CORD(1,0,0,0))
GRID_ELEMENT (CORD(0,1,0,1), CORD(0,0,0,1), CORD(0,0,1,1), CORD(0,0,1,1), CORD(1,0,0,1))

/****************
 * @brief 
 * Comment the previous grid and enter new grid as per above format here. 
 * use multi line comments only
 * 
 ******************/



// don't add any code beyond this
