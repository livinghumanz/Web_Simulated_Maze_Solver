#ifndef MAZE_RUN_H
#define MAZE_RUN_H

/*
 * Standalone maze run: flood-fill (maze.c / costAlgorithm.c) driven by the
 * ultrasonic wall sensors and the closed-loop motion controller.
 *
 * Per cell: sense walls at the cell centre -> updateWalls -> propagateCost ->
 * smallestNextNeighbourCell -> turn -> drive one cell (side-wall centring)
 * -> square up on a front wall if there is one.
 *
 * Coordinates as in maze.h: start (0,0) facing NORTH, x grows to the EAST,
 * y grows to the NORTH.
 */

#include <stdbool.h>
#include <stdint.h>

#include "maze.h"

#define MAZE_CH_NONE 0xFFU

typedef struct {
    uint8_t size;             /* cells per side                             */
    CELL goal;
    bool return_home;         /* drive back to (0,0) after the goal         */
    float pitch_mm;           /* cell length, wall centre to wall centre    */
    float v_run, a_run;       /* straight moves, mm/s and mm/s^2            */
    float v_turn, a_turn;     /* in-place turns (wheel speed)               */
    uint8_t ch_front, ch_left, ch_right;   /* ultrasonic channel 0..2       */
    uint16_t front_center;    /* front reading with a wall ahead, robot centred */
    uint16_t center_l;        /* left reading with a wall beside, robot centred  */
    uint16_t center_r;        /* right reading (learned separately: sensors may be
                                 mounted/aimed differently)                       */
    uint16_t thr_front;       /* wall if reading < thr                      */
    uint16_t thr_side;
    float kc_p, kc_d;         /* centring: steer mm/s per mm, per mm/s      */
    float steer_max;          /* mm/s                                       */
    bool align_front;         /* creep up to the front wall after a move    */
    bool sense;               /* use the ultrasonics (walls, centring, align);
                                 off = trust the loaded map completely      */
    bool pivot_turns;         /* turn by pivoting about one wheel (needs no
                                 reverse, less room than spinning); the robot
                                 then stops half a track width short of each
                                 cell centre. U-turns are always spins.      */
    uint8_t entry_x;          /* escape game: entry cell position along the
                                 side the robot drives in through, counted
                                 from its left (0 = corner, outer wall on
                                 its left; size-1 = outer wall on its right) */
    bool wall_update;         /* sensors may change known walls (needs 2
                                 contradicting readings); off = the drawn
                                 walls are the truth, sensors only assist   */
} MazeConfig;

typedef struct {
    uint16_t df, dl, dr;      /* mm, US_FAR_MM if no echo                   */
    bool front, left, right;  /* wall present                               */
} MazeWalls;

typedef enum { REL_FWD, REL_RIGHT, REL_BACK, REL_LEFT } RelDir;

extern MazeConfig g_maze_cfg;

void Maze_DefaultConfig(MazeConfig *c);

/* Called often during moves; return true to abort (STOP command, button). */
void Maze_SetAbortCheck(bool (*fn)(void));

void Maze_Sense(MazeWalls *w);
bool Maze_Turn(RelDir r);     /* navigation turn: pivot (or spin) as configured */
bool Maze_Spin(RelDir r);     /* always an in-place spin (calibration, centring) */
bool Maze_MoveCell(void);     /* to the next cell's stop point                    */

/* Forget all walls (keeps the robot pose). Uses g_maze_cfg.size. */
void Maze_ResetMap(void);

/* Load a complete maze (website MAZEDEF): n x n cells, one hex digit per
 * cell in x-major order, bits N=1 E=2 S=4 W=8. Border forced closed. */
bool Maze_LoadMap(uint8_t n, const char *hex);

/* Print "[WALLS] n <hex>" - 2 hex digits per cell (x-major),
 * byte = N | E<<2 | S<<4 | W<<6 with 0 open, 1 wall, 2 unseen. */
void Maze_ReportWalls(void);

/* Tell the robot where it stands (cell and heading). */
bool Maze_SetPose(uint8_t x, uint8_t y, ABSOLUTE_DIRECTION d);
void Maze_GetPose(CELL *c, ABSOLUTE_DIRECTION *d);

/* Drive from the current pose to target, exploring as it goes. Walls seen
 * on the way overwrite older ones, so changed mazes are handled. */
bool Maze_GoTo(CELL target);

/* Demo run: clear map, pose (0,0)/NORTH, go to goal (and home if enabled). */
bool Maze_Run(void);

/* Escape game: start OUTSIDE in front of the entry (entry cell = (entry_x,0),
 * facing NORTH into the maze); right-hand wall following until it leaves the maze.
 * No map needed, so uneven cells are fine. Logs [MAZE] ESCAPED on success. */
bool Maze_Escape(void);

void Maze_PrintMap(void);
const char *Maze_RelName(RelDir r);

#endif /* MAZE_RUN_H */
