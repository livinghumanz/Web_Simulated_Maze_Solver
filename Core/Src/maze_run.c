#include "maze_run.h"

#include <math.h>
#include <string.h>

#include "FreeRTOS.h"
#include "cmsis_os.h"
#include "main.h"
#include "bt_log.h"
#include "costAlgorithm.h"
#include "motion.h"
#include "motor.h"
#include "encoder.h"
#include "ultrasonic.h"

#define MAX_STEPS          100U
#define MOVE_TIMEOUT_MS    10000U
#define TURN_TIMEOUT_MS    8000U
#define ALIGN_MIN_MM       4.0f
#define ALIGN_MAX_MM       50.0f
#define ALIGN_SPEED        50.0f
#define SENSE_SAMPLES      3U
#define FRONT_TRACK_WINDOW 50.0f   /* accept a front wall within +-50 mm of the nominal cell end */
#define FRONT_TRACK_MIN    15.0f   /* stop re-targeting this close to the end */
#define SIDE_MIN_MM        25U     /* closer to a side wall: steer away at full strength */

extern WallInfo WALLS[MAZE_DIMENSIONS_MAX][MAZE_DIMENSIONS_MAX];
extern uint16_t COSTMARY[MAZE_DIMENSIONS_MAX][MAZE_DIMENSIONS_MAX];
extern CELL CURRENT_CELL;
extern ABSOLUTE_DIRECTION CURRENT_ABSOLUTE_DIRECTION;

MazeConfig g_maze_cfg;
static bool (*s_abort_check)(void);

static const ABSOLUTE_DIRECTION RIGHT_OF[4] = { [NORTH] = EAST, [EAST] = SOUTH, [SOUTH] = WEST, [WEST] = NORTH };
static const ABSOLUTE_DIRECTION LEFT_OF[4]  = { [NORTH] = WEST, [WEST] = SOUTH, [SOUTH] = EAST, [EAST] = NORTH };
static const ABSOLUTE_DIRECTION BACK_OF[4]  = { [NORTH] = SOUTH, [SOUTH] = NORTH, [WEST] = EAST, [EAST] = WEST };
static const char DIR_CHAR[4] = { [NORTH] = 'N', [SOUTH] = 'S', [WEST] = 'W', [EAST] = 'E' };

void Maze_DefaultConfig(MazeConfig *c)
{
    memset(c, 0, sizeof(*c));
    c->size = 3;
    c->goal = (CELL){1, 1};
    c->return_home = true;
    /* Maker Faire maze rebuilt with ~16 cm cells (14.5 cm was too small to
     * spin a 10x10 cm robot). Values measured in the first full run. */
    c->pitch_mm = 160.0f;
    c->v_run = 80.0f;
    c->a_run = 300.0f;
    c->v_turn = 50.0f;
    c->a_turn = 300.0f;
    c->ch_front = 0;                 /* placeholder until identified with USMAP */
    c->ch_left = 1;
    c->ch_right = 2;
    c->front_center = 33;            /* front reading 29-39 mm with a wall ahead */
    c->center_l = 48;                /* side readings 37-55 mm; CALSPIN refines */
    c->center_r = 48;
    c->thr_front = 113;              /* centre + pitch/2 */
    c->thr_side = 128;
    c->kc_p = 1.5f;
    c->kc_d = 0.5f;
    c->steer_max = 25.0f;
    c->align_front = true;
    c->sense = true;
    c->wall_update = true;
    c->entry_x = 0;
    c->pivot_turns = false;   /* spins since the left-reverse repair (2026-11-07) */
}

void Maze_SetAbortCheck(bool (*fn)(void))
{
    s_abort_check = fn;
}

static bool aborted(void)
{
    return (s_abort_check != NULL) && s_abort_check();
}

/* Pivot mode: the robot stops half a track width short of each cell centre,
 * so that a pivot about one wheel ends exactly on the new corridor's centre
 * line. front_center / thr_front are calibrated at the cell centre; these
 * give the values for the actual stop point. */
static float stop_offset(void)
{
    return g_maze_cfg.pivot_turns ? Motion_GetTrackWidth() * 0.5f : 0.0f;
}

static float front_stop_mm(void)
{
    return (float)g_maze_cfg.front_center + stop_offset();
}

static float front_thr_mm(void)
{
    return (float)g_maze_cfg.thr_front + stop_offset();
}

/* Set by a navigation turn: after a pivot or U-turn the robot is already
 * half a track width into the new direction, so the next move is shorter. */
static bool s_after_turn;

const char *Maze_RelName(RelDir r)
{
    switch (r) {
    case REL_FWD:   return "FORWARD";
    case REL_RIGHT: return "RIGHT";
    case REL_BACK:  return "UTURN";
    case REL_LEFT:  return "LEFT";
    }
    return "?";
}

/* ---------------- sensing ---------------- */

static uint16_t channel_mm(const uint16_t d[US_COUNT], uint8_t ch)
{
    return (ch < US_COUNT) ? d[ch] : US_FAR_MM;
}

void Maze_Sense(MazeWalls *w)
{
    uint16_t d[US_COUNT];
    Ultrasonic_ReadMedian(d, SENSE_SAMPLES);
    w->df = channel_mm(d, g_maze_cfg.ch_front);
    w->dl = channel_mm(d, g_maze_cfg.ch_left);
    w->dr = channel_mm(d, g_maze_cfg.ch_right);
    w->front = (float)w->df < front_thr_mm();
    w->left = w->dl < g_maze_cfg.thr_side;
    w->right = w->dr < g_maze_cfg.thr_side;
}

/* ---------------- centring during straight moves ---------------- */

typedef struct {
    uint32_t cnt_l, cnt_r;    /* last ultrasonic sample counters used */
    uint8_t mode;             /* 0 none, 1 both walls, 2 left only, 3 right only */
    float e_prev, de_f;
    uint32_t t_prev;
} Centring;

static void centring_step(Centring *s)
{
    const MazeConfig *c = &g_maze_cfg;
    if (c->ch_left >= US_COUNT || c->ch_right >= US_COUNT) {
        return;
    }
    uint32_t cl = Ultrasonic_GetCount(c->ch_left);
    uint32_t cr = Ultrasonic_GetCount(c->ch_right);
    if (cl == s->cnt_l && cr == s->cnt_r) {
        return;                                  /* no new data */
    }
    s->cnt_l = cl;
    s->cnt_r = cr;

    uint16_t dl = Ultrasonic_GetMm(c->ch_left);
    uint16_t dr = Ultrasonic_GetMm(c->ch_right);
    bool wl = dl < c->thr_side;
    bool wr = dr < c->thr_side;

    /* e > 0: robot is right of the centre line. Each side is compared with
     * its own calibrated "centred" reading. */
    float el = (float)dl - (float)c->center_l;      /* > 0: too far from the left wall  */
    float er = (float)dr - (float)c->center_r;      /* > 0: too far from the right wall */
    float e;
    uint8_t mode;
    if (wl && wr) {
        e = (el - er) * 0.5f;
        mode = 1;
    } else if (wl) {
        e = el;
        mode = 2;
    } else if (wr) {
        e = -er;
        mode = 3;
    } else {
        s->mode = 0;
        Motion_SetSteering(0.0f);
        return;
    }

    uint32_t now = HAL_GetTick();
    if (mode != s->mode) {                        /* new wall layout: restart D term */
        s->mode = mode;
        s->e_prev = e;
        s->de_f = 0.0f;
        s->t_prev = now;
    }
    float dt = (float)(now - s->t_prev) / 1000.0f;
    if (dt > 0.005f) {
        float de = (e - s->e_prev) / dt;
        s->de_f += 0.5f * (de - s->de_f);
        s->e_prev = e;
        s->t_prev = now;
    }

    /* Positive steer turns right, so steer against the offset. */
    float steer = -(c->kc_p * e + c->kc_d * s->de_f);
    if (steer > c->steer_max) steer = c->steer_max;
    if (steer < -c->steer_max) steer = -c->steer_max;

    /* Hard minimum distance: too close to a wall overrides everything. */
    if (dl < SIDE_MIN_MM) {
        steer = c->steer_max;            /* away from the left wall  -> right */
    } else if (dr < SIDE_MIN_MM) {
        steer = -c->steer_max;           /* away from the right wall -> left  */
    }
    Motion_SetSteering(steer);
}

/* Cells are not all the same size, so when the front sensor sees the wall
 * that closes the target cell, move the stop point to "wall - front_center"
 * instead of trusting the nominal pitch. A wall one cell further away reads
 * about a pitch more and falls outside the window, so it is ignored. */
typedef struct {
    uint32_t cnt;
    uint8_t hits;
    bool stopped;
    float nominal;            /* planned length of this move, mm */
} FrontTrack;

#define FRONT_STOP_MM 18U         /* closer than this: end the move now */

static void front_step(FrontTrack *f)
{
    const MazeConfig *c = &g_maze_cfg;
    if (c->ch_front >= US_COUNT) {
        return;
    }
    uint32_t cnt = Ultrasonic_GetCount(c->ch_front);
    if (cnt == f->cnt) {
        return;
    }
    f->cnt = cnt;
    uint16_t d = Ultrasonic_GetMm(c->ch_front);
    if (d >= US_FAR_MM) {
        return;
    }
    float done = Motion_DistanceDone();
    if (d < FRONT_STOP_MM) {
        /* A bad turn can point the robot at a wall: stop braking, don't hit it. */
        if (!f->stopped) {
            Motion_SetForwardTotal(done);
            BT_LOG("[MAZE] wall %u mm ahead - stopping early", d);
            f->stopped = true;
        }
        return;
    }
    float to_go = (float)d - front_stop_mm();           /* still to drive to the stop point */
    if (to_go < FRONT_TRACK_MIN || fabsf(to_go - (f->nominal - done)) > FRONT_TRACK_WINDOW) {
        return;
    }
    if (++f->hits >= 2) {                               /* two consistent readings */
        Motion_SetForwardTotal(done + to_go);
    }
}

/* Side readings collected during the last part of a cell move. Gaps between
 * wall blocks are only a few cm wide and show up for an instant; a real
 * opening reads open over the whole approach to the cell centre. */
#define APPROACH_WINDOW_MM 60.0f
typedef struct {
    uint32_t cnt_l, cnt_r;
    uint8_t open_l, wall_l, open_r, wall_r;
    float window_start;       /* distance done from which readings count */
} SideTrack;

static SideTrack s_approach;  /* of the most recent cell move */

static void side_track_start(SideTrack *t, float move_len)
{
    memset(t, 0, sizeof(*t));
    t->window_start = move_len - APPROACH_WINDOW_MM;
    if (g_maze_cfg.ch_left < US_COUNT) t->cnt_l = Ultrasonic_GetCount(g_maze_cfg.ch_left);
    if (g_maze_cfg.ch_right < US_COUNT) t->cnt_r = Ultrasonic_GetCount(g_maze_cfg.ch_right);
}

static void side_step(SideTrack *t)
{
    const MazeConfig *c = &g_maze_cfg;
    if (Motion_DistanceDone() < t->window_start ||
        c->ch_left >= US_COUNT || c->ch_right >= US_COUNT) {
        return;
    }
    uint32_t cl = Ultrasonic_GetCount(c->ch_left);
    uint32_t cr = Ultrasonic_GetCount(c->ch_right);
    if (cl != t->cnt_l) {
        t->cnt_l = cl;
        if (Ultrasonic_GetMm(c->ch_left) < c->thr_side) { if (t->wall_l < 255U) t->wall_l++; }
        else if (t->open_l < 255U) t->open_l++;
    }
    if (cr != t->cnt_r) {
        t->cnt_r = cr;
        if (Ultrasonic_GetMm(c->ch_right) < c->thr_side) { if (t->wall_r < 255U) t->wall_r++; }
        else if (t->open_r < 255U) t->open_r++;
    }
}

/* Open only if open at the stop AND mostly open while approaching. */
static bool side_open_confirmed(bool open_at_stop, uint8_t open_cnt, uint8_t wall_cnt)
{
    if (!open_at_stop) {
        return false;
    }
    if (open_cnt + wall_cnt == 0U) {
        return true;                       /* no approach data: trust the stop reading */
    }
    return open_cnt > wall_cnt;
}

/* Wait for the current move; returns true if it finished normally.
 * centring: steer with the side sensors; track_len > 0: re-target the end of
 * a straight move of that length on the front wall; side: collect approach
 * readings (NULL = off). */
static bool wait_motion_ex(uint32_t timeout_ms, bool centring, float track_len, SideTrack *side)
{
    Centring cs = {0};
    FrontTrack ft = { .nominal = track_len };
    uint32_t t0 = HAL_GetTick();
    while (Motion_IsBusy()) {
        if (aborted() || HAL_GetTick() - t0 > timeout_ms) {
            Motion_Stop();
            for (int i = 0; i < 50 && Motion_IsBusy(); i++) {
                osDelay(2);
            }
            BT_LOG("[MAZE] move %s", aborted() ? "aborted" : "timed out");
            return false;
        }
        if (centring) {
            centring_step(&cs);
        }
        if (track_len > 0.0f) {
            front_step(&ft);
        }
        if (side != NULL) {
            side_step(side);
        }
        osDelay(10);
    }
    Motion_SetSteering(0.0f);
    if (Motion_LastEvent() != MOTION_EV_DONE) {
        BT_LOG("[MAZE] move ended with event %u", Motion_LastEvent());
        return false;
    }
    return true;
}

static bool wait_motion(uint32_t timeout_ms, bool centring)
{
    return wait_motion_ex(timeout_ms, centring, 0.0f, NULL);
}

/* ---------------- moves ---------------- */

bool Maze_Spin(RelDir r)
{
    float deg;
    switch (r) {
    case REL_FWD:
        return true;
    case REL_RIGHT:
        deg = 90.0f;
        break;
    case REL_BACK:
        deg = 180.0f;                            /* clockwise U-turn */
        break;
    case REL_LEFT:
    default:
        /* Left motor cannot reverse yet: turn 270 degrees clockwise instead. */
        deg = Motion_CanTurn(false) ? -90.0f : 270.0f;
        break;
    }
    if (!Motion_Turn(deg, g_maze_cfg.v_turn, g_maze_cfg.a_turn)) {
        BT_LOG("[MAZE] turn %d rejected", (int)deg);
        return false;
    }
    return wait_motion(TURN_TIMEOUT_MS, false);
}

bool Maze_Turn(RelDir r)
{
    if (r == REL_FWD) {
        return true;
    }
    s_after_turn = true;
    if (!g_maze_cfg.pivot_turns || r == REL_BACK) {
        return Maze_Spin(r);                    /* U-turn: no room to pivot */
    }
    float deg = (r == REL_RIGHT) ? 90.0f : -90.0f;
    if (!Motion_Pivot(deg, g_maze_cfg.v_turn, g_maze_cfg.a_turn)) {
        BT_LOG("[MAZE] pivot %d rejected", (int)deg);
        return false;
    }
    return wait_motion(TURN_TIMEOUT_MS, false);
}

static void front_align(void)
{
    uint16_t d[US_COUNT];
    Ultrasonic_ReadMedian(d, SENSE_SAMPLES);
    uint16_t f = channel_mm(d, g_maze_cfg.ch_front);
    if ((float)f >= front_thr_mm()) {
        return;                                  /* no wall ahead */
    }
    float err = (float)f - front_stop_mm();
    bool can_back = Motion_CanTurn(true) && Motion_CanTurn(false);
    if ((err > ALIGN_MIN_MM && err < ALIGN_MAX_MM) ||
        (can_back && err < -ALIGN_MIN_MM && err > -ALIGN_MAX_MM)) {
        BT_LOG("[MAZE] align to front wall: %d mm", (int)err);
        if (Motion_Forward(err, ALIGN_SPEED, g_maze_cfg.a_run)) {
            (void)wait_motion(MOVE_TIMEOUT_MS, false);
        }
    }
}

static bool move_distance(float len)
{
    if (!Motion_Forward(len, g_maze_cfg.v_run, g_maze_cfg.a_run)) {
        BT_LOG("[MAZE] forward rejected");
        return false;
    }
    float track = g_maze_cfg.sense ? len : 0.0f;
    side_track_start(&s_approach, len);
    if (!wait_motion_ex(MOVE_TIMEOUT_MS, g_maze_cfg.sense, track,
                        g_maze_cfg.sense ? &s_approach : NULL)) {
        return false;
    }
    if (g_maze_cfg.sense && g_maze_cfg.align_front) {
        front_align();
    }
    return true;
}

/* From one stop point to the next cell's stop point. */
bool Maze_MoveCell(void)
{
    float len = g_maze_cfg.pitch_mm;
    if (s_after_turn) {
        len -= 2.0f * stop_offset();
        s_after_turn = false;
    }
    return move_distance(len);
}

/* ---------------- flood-fill run ---------------- */

static ABSOLUTE_DIRECTION dir_to(CELL from, CELL to)
{
    if (to.x > from.x) return EAST;
    if (to.x < from.x) return WEST;
    if (to.y > from.y) return NORTH;
    return SOUTH;
}

static RelDir relative(ABSOLUTE_DIRECTION heading, ABSOLUTE_DIRECTION want)
{
    if (want == heading) return REL_FWD;
    if (want == RIGHT_OF[heading]) return REL_RIGHT;
    if (want == BACK_OF[heading]) return REL_BACK;
    return REL_LEFT;
}

static bool same_cell(CELL a, CELL b)
{
    return a.x == b.x && a.y == b.y;
}

static void wall_field_set(WallInfo *w, ABSOLUTE_DIRECTION d, WallState s)
{
    switch (d) {
    case NORTH: w->north = s; break;
    case SOUTH: w->south = s; break;
    case WEST:  w->west = s;  break;
    case EAST:  w->east = s;  break;
    default: break;
    }
}

static WallState wall_field_get(const WallInfo *w, ABSOLUTE_DIRECTION d)
{
    switch (d) {
    case NORTH: return w->north;
    case SOUTH: return w->south;
    case WEST:  return w->west;
    case EAST:  return w->east;
    default:    return WALL_UNSEEN;
    }
}

static const char *wall_name(WallState s)
{
    return (s == WALL_PRESENT) ? "wall" : (s == WALL_ABSENT) ? "open" : "unseen";
}

/* Newest reading wins (unlike updateWalls, which keeps the first one), so the
 * robot adapts when visitors move walls. Border walls are never touched.
 * A reading that contradicts a known wall (e.g. from the website drawing) is
 * reported as [MISMATCH]. */
/* How often in a row a known wall has been contradicted (per cell side). */
static uint8_t s_contra[MAZE_DIMENSIONS_MAX][MAZE_DIMENSIONS_MAX][4];
#define CONTRA_TO_FLIP 2U

static void clear_contradictions(void)
{
    memset(s_contra, 0, sizeof(s_contra));
}

/* An unseen wall takes the first reading. A known wall (drawn or seen
 * earlier) only flips after CONTRA_TO_FLIP contradicting readings in a row,
 * and never when wall_update is off - one oblique ultrasonic miss at a
 * corner must not rewrite the map. Border walls are never touched. */
static void set_wall(CELL c, ABSOLUTE_DIRECTION d, bool present)
{
    CELL n = neighbourCell(c, d);
    if (n.x == UNREACH_X || n.y == UNREACH_Y || n.x >= MAZE_DIM || n.y >= MAZE_DIM) {
        return;
    }
    WallState s = present ? WALL_PRESENT : WALL_ABSENT;
    WallState old = wall_field_get(&WALLS[c.x][c.y], d);
    uint8_t *cnt = &s_contra[c.x][c.y][d];
    if (old == s) {
        *cnt = 0;
        return;
    }
    if (old != WALL_UNSEEN) {
        if (*cnt < 255U) (*cnt)++;
        bool flip = g_maze_cfg.wall_update && *cnt >= CONTRA_TO_FLIP;
        BT_LOG("[MISMATCH] %u %u %c drawn=%s seen=%s (%u/%u)%s", c.x, c.y, DIR_CHAR[d],
               wall_name(old), wall_name(s), *cnt, (unsigned)CONTRA_TO_FLIP,
               flip ? " -> updated" : (g_maze_cfg.wall_update ? "" : " -> kept drawing"));
        if (!flip) {
            return;
        }
        *cnt = 0;
    }
    wall_field_set(&WALLS[c.x][c.y], d, s);
    wall_field_set(&WALLS[n.x][n.y], BACK_OF[d], s);
}

/* [WALLS] <2 hex digits per cell>, cells in x-major order (x outer, y inner).
 * Byte = N | E<<2 | S<<4 | W<<6, each 0 = open, 1 = wall, 2 = unseen. */
void Maze_ReportWalls(void)
{
    static const char HEX[] = "0123456789ABCDEF";
    char buf[2 * MAZE_DIMENSIONS_MAX * MAZE_DIMENSIONS_MAX + 1];
    size_t k = 0;
    for (uint8_t x = 0; x < MAZE_DIM; x++) {
        for (uint8_t y = 0; y < MAZE_DIM; y++) {
            const WallInfo *w = &WALLS[x][y];
            uint8_t b = (uint8_t)((w->north & 3U) | ((w->east & 3U) << 2) |
                                  ((w->south & 3U) << 4) | ((w->west & 3U) << 6));
            buf[k++] = HEX[b >> 4];
            buf[k++] = HEX[b & 0xFU];
        }
    }
    buf[k] = '\0';
    BT_LOG("[WALLS] %u %s", MAZE_DIM, buf);
}

static int hex_val(char ch)
{
    if (ch >= '0' && ch <= '9') return ch - '0';
    if (ch >= 'A' && ch <= 'F') return ch - 'A' + 10;
    if (ch >= 'a' && ch <= 'f') return ch - 'a' + 10;
    return -1;
}

/* MAZEDEF payload: one hex digit per cell, x-major, bits N=1 E=2 S=4 W=8.
 * Every wall becomes known (present/absent); the border is forced closed. */
bool Maze_LoadMap(uint8_t n, const char *hex)
{
    if (n < 2 || n > MAZE_DIMENSIONS_MAX || hex == NULL || strlen(hex) != (size_t)n * n) {
        return false;
    }
    for (size_t i = 0; i < (size_t)n * n; i++) {
        if (hex_val(hex[i]) < 0) {
            return false;
        }
    }
    g_maze_cfg.size = n;
    MAZE_DIM = n;
    clear_contradictions();
    for (uint8_t x = 0; x < n; x++) {
        for (uint8_t y = 0; y < n; y++) {
            int v = hex_val(hex[x * n + y]);
            WallInfo *w = &WALLS[x][y];
            w->north = ((v & 1) || y == n - 1) ? WALL_PRESENT : WALL_ABSENT;
            w->east  = ((v & 2) || x == n - 1) ? WALL_PRESENT : WALL_ABSENT;
            w->south = ((v & 4) || y == 0)     ? WALL_PRESENT : WALL_ABSENT;
            w->west  = ((v & 8) || x == 0)     ? WALL_PRESENT : WALL_ABSENT;
        }
    }
    if (CURRENT_CELL.x >= n || CURRENT_CELL.y >= n) {
        CURRENT_CELL = (CELL){0, 0};
    }
    BT_LOG("[MAZE] map loaded (%ux%u)", n, n);
    Maze_ReportWalls();
    return true;
}

/* A reading only changes the map when the sensor actually heard an echo. The
 * maze is closed, so a working sensor always hears some wall; "no echo" means
 * a fault (or an open border), and then the drawn wall is kept. */
static void apply_walls(const MazeWalls *w)
{
    CELL c = CURRENT_CELL;
    ABSOLUTE_DIRECTION hd = CURRENT_ABSOLUTE_DIRECTION;
    if (w->df < US_FAR_MM) set_wall(c, hd, w->front);
    if (w->dl < US_FAR_MM) set_wall(c, LEFT_OF[hd], w->left);
    if (w->dr < US_FAR_MM) set_wall(c, RIGHT_OF[hd], w->right);
}

/* Warn once when a mapped sensor has been silent for a while, and again when
 * it recovers. Checked every time the walls are sensed. */
#define SENSOR_SILENT_LIMIT 3U
static void check_sensor_health(const MazeWalls *w)
{
    static uint8_t silent[3];
    static bool reported[3];
    const char *const names[3] = { "front", "left", "right" };
    const uint8_t ch[3] = { g_maze_cfg.ch_front, g_maze_cfg.ch_left, g_maze_cfg.ch_right };
    const uint16_t d[3] = { w->df, w->dl, w->dr };
    for (int i = 0; i < 3; i++) {
        if (d[i] >= US_FAR_MM) {
            if (silent[i] < 255U) silent[i]++;
            if (silent[i] >= SENSOR_SILENT_LIMIT && !reported[i]) {
                BT_LOG("[SENSOR] %s (US%u) not responding - using the drawn walls there",
                       names[i], (unsigned)ch[i] + 1U);
                reported[i] = true;
            }
        } else {
            if (reported[i]) {
                BT_LOG("[SENSOR] %s (US%u) OK again", names[i], (unsigned)ch[i] + 1U);
            }
            silent[i] = 0;
            reported[i] = false;
        }
    }
}

static bool run_to(CELL goal)
{
    bool retried = false;
    BT_LOG("[MAZE] target (%u,%u)", goal.x, goal.y);
    for (uint32_t step = 0; step < MAX_STEPS; step++) {
        if (aborted()) {
            BT_LOG("[MAZE] aborted");
            return false;
        }
        MazeWalls w = { US_FAR_MM, US_FAR_MM, US_FAR_MM, false, false, false };
        if (g_maze_cfg.sense) {
            Maze_Sense(&w);
            check_sensor_health(&w);
            apply_walls(&w);
            Maze_ReportWalls();
        }

        CELL cur = CURRENT_CELL;
        ABSOLUTE_DIRECTION hd = CURRENT_ABSOLUTE_DIRECTION;
        if (same_cell(cur, goal)) {
            BT_LOG("[CELL] (%u,%u) %c f=%u l=%u r=%u  GOAL REACHED", cur.x, cur.y,
                   DIR_CHAR[hd], w.df, w.dl, w.dr);
            return true;
        }

        propagateCost(goal);
        CELL next = smallestNextNeighbourCell(cur, hd);
        if (same_cell(next, cur)) {
            BT_LOG("[CELL] (%u,%u) %c f=%u l=%u r=%u  walls %c%c%c  NO PATH", cur.x, cur.y,
                   DIR_CHAR[hd], w.df, w.dl, w.dr,
                   w.left ? 'L' : '.', w.front ? 'F' : '.', w.right ? 'R' : '.');
            if (g_maze_cfg.wall_update && g_maze_cfg.sense && !retried) {
                /* Probably a wrong reading closed the way: forget and re-explore. */
                BT_LOG("[MAZE] forgetting the map and exploring again from here");
                Maze_ResetMap();
                retried = true;
                continue;
            }
            return false;
        }
        ABSOLUTE_DIRECTION want = dir_to(cur, next);
        RelDir rel = relative(hd, want);
        BT_LOG("[CELL] (%u,%u) %c f=%u l=%u r=%u  walls %c%c%c  -> (%u,%u) %s",
               cur.x, cur.y, DIR_CHAR[hd], w.df, w.dl, w.dr,
               w.left ? 'L' : '.', w.front ? 'F' : '.', w.right ? 'R' : '.',
               next.x, next.y, Maze_RelName(rel));

        if (!Maze_Turn(rel)) {
            return false;
        }
        CURRENT_ABSOLUTE_DIRECTION = want;
        if (rel != REL_FWD) {
            BT_LOG("[POS] %u %u %c", cur.x, cur.y, DIR_CHAR[want]);
        }
        if (!Maze_MoveCell()) {
            return false;
        }
        CURRENT_CELL = next;
        BT_LOG("[POS] %u %u %c", next.x, next.y, DIR_CHAR[want]);
    }
    BT_LOG("[MAZE] step limit reached");
    return false;
}

static bool sensors_mapped(void)
{
    const MazeConfig *c = &g_maze_cfg;
    if (c->ch_front >= US_COUNT || c->ch_left >= US_COUNT || c->ch_right >= US_COUNT) {
        BT_LOG("[MAZE] map all 3 sensors first (USMAP)");
        return false;
    }
    return true;
}

void Maze_ResetMap(void)
{
    uint8_t n = g_maze_cfg.size;
    if (n < 2 || n > MAZE_DIMENSIONS_MAX) {
        n = 3;
        g_maze_cfg.size = n;
    }
    MAZE_DIM = n;
    initWalls();
    clear_contradictions();
    if (CURRENT_CELL.x >= n || CURRENT_CELL.y >= n) {
        CURRENT_CELL = (CELL){0, 0};
    }
    BT_LOG("[MAZE] map cleared (%ux%u)", n, n);
}

bool Maze_SetPose(uint8_t x, uint8_t y, ABSOLUTE_DIRECTION d)
{
    if (x >= MAZE_DIM || y >= MAZE_DIM || d >= ABS_DIR_COUNT) {
        return false;
    }
    CURRENT_CELL = (CELL){x, y};
    CURRENT_ABSOLUTE_DIRECTION = d;
    BT_LOG("[POS] %u %u %c", x, y, DIR_CHAR[d]);
    return true;
}

void Maze_GetPose(CELL *c, ABSOLUTE_DIRECTION *d)
{
    *c = CURRENT_CELL;
    *d = CURRENT_ABSOLUTE_DIRECTION;
}

bool Maze_GoTo(CELL target)
{
    if (!sensors_mapped()) {
        return false;
    }
    if (target.x >= MAZE_DIM || target.y >= MAZE_DIM) {
        BT_LOG("[MAZE] target outside the %ux%u maze", MAZE_DIM, MAZE_DIM);
        return false;
    }
    bool ok = run_to(target);
    BT_LOG("[POS] %u %u %c", CURRENT_CELL.x, CURRENT_CELL.y, DIR_CHAR[CURRENT_ABSOLUTE_DIRECTION]);
    BT_LOG("[MAZE] %s", ok ? "ARRIVED" : "STOPPED");
    return ok;
}

bool Maze_Run(void)
{
    MazeConfig *c = &g_maze_cfg;
    if (!sensors_mapped()) {
        return false;
    }
    Maze_ResetMap();
    (void)Maze_SetPose(0, 0, NORTH);
    if (c->goal.x >= MAZE_DIM || c->goal.y >= MAZE_DIM) {
        BT_LOG("[MAZE] goal outside the maze");
        return false;
    }

    BT_LOG("[MAZE] start: %ux%u, goal (%u,%u), pitch %d mm", MAZE_DIM, MAZE_DIM,
           c->goal.x, c->goal.y, (int)c->pitch_mm);
    bool ok = Maze_GoTo(c->goal);
    Maze_PrintMap();
    if (ok && c->return_home) {
        osDelay(1000);
        ok = Maze_GoTo((CELL){0, 0});
        Maze_PrintMap();
    }
    return ok;
}

/* ---------------- escape game: right-hand wall follower ----------------
 * The robot starts OUTSIDE the maze, in front of the entry, facing in; the
 * entry cell is (0,0) and "in" is NORTH. It keeps its right hand on the wall:
 * right if open, else straight, else left, else U-turn - one cell per step.
 * It needs no map, so uneven cells do not matter. With the entry and the exit
 * both in the outer wall this always finds the exit. Leaving the size x size
 * area means it is out: ESCAPED. Coming back out through the entry means
 * there is no other exit. */

static void step_pos(int *x, int *y, ABSOLUTE_DIRECTION d)
{
    switch (d) {
    case NORTH: (*y)++; break;
    case SOUTH: (*y)--; break;
    case EAST:  (*x)++; break;
    case WEST:  (*x)--; break;
    default: break;
    }
}

static ABSOLUTE_DIRECTION apply_rel(ABSOLUTE_DIRECTION hd, RelDir r)
{
    switch (r) {
    case REL_RIGHT: return RIGHT_OF[hd];
    case REL_LEFT:  return LEFT_OF[hd];
    case REL_BACK:  return BACK_OF[hd];
    default:        return hd;
    }
}

bool Maze_Escape(void)
{
    if (!sensors_mapped()) {
        return false;
    }
    Maze_ResetMap();                       /* map is only for display here */
    int n = MAZE_DIM;
    int ex = (g_maze_cfg.entry_x < n) ? g_maze_cfg.entry_x : 0;
    int x = ex, y = -1;                    /* outside, in front of the entry */
    ABSOLUTE_DIRECTION hd = NORTH;

    BT_LOG("[ESCAPE] start: outside the entry (cell %d,0) of a %dx%d maze, facing in", ex, n, n);
    BT_LOG("[POS] %d -1 N", ex);
    s_after_turn = false;
    if (!move_distance(g_maze_cfg.pitch_mm - stop_offset())) {
        BT_LOG("[MAZE] STOPPED");
        return false;
    }
    y = 0;
    BT_LOG("[POS] %d 0 N", ex);

    for (uint32_t step = 0; step < MAX_STEPS; step++) {
        if (aborted()) {
            BT_LOG("[MAZE] aborted");
            BT_LOG("[MAZE] STOPPED");
            return false;
        }
        if (x < 0 || y < 0 || x >= n || y >= n) {
            if (x == ex && y == -1) {
                BT_LOG("[ESCAPE] came back out through the entry - no other exit found");
                BT_LOG("[MAZE] STOPPED");
                return false;
            }
            BT_LOG("[ESCAPE] out of the maze at %d,%d", x, y);
            BT_LOG("[MAZE] ESCAPED");
            return true;
        }

        MazeWalls w;
        Maze_Sense(&w);
        bool right_open = side_open_confirmed(!w.right, s_approach.open_r, s_approach.wall_r);
        bool left_open = side_open_confirmed(!w.left, s_approach.open_l, s_approach.wall_l);
        bool front_open = !w.front;

        /* Keep the display map in step (inside the maze only). */
        CURRENT_CELL = (CELL){(uint8_t)x, (uint8_t)y};
        CURRENT_ABSOLUTE_DIRECTION = hd;
        apply_walls(&w);
        Maze_ReportWalls();

        RelDir rel = right_open ? REL_RIGHT : front_open ? REL_FWD
                   : left_open ? REL_LEFT : REL_BACK;
        BT_LOG("[CELL] (%d,%d) %c f=%u l=%u r=%u  open %c%c%c  approach L%u/%u R%u/%u -> %s",
               x, y, DIR_CHAR[hd], w.df, w.dl, w.dr,
               left_open ? 'L' : '.', front_open ? 'F' : '.', right_open ? 'R' : '.',
               s_approach.open_l, s_approach.wall_l, s_approach.open_r, s_approach.wall_r,
               Maze_RelName(rel));

        if (!Maze_Turn(rel)) {
            BT_LOG("[MAZE] STOPPED");
            return false;
        }
        hd = apply_rel(hd, rel);
        if (rel != REL_FWD) {
            BT_LOG("[POS] %d %d %c", x, y, DIR_CHAR[hd]);
        }
        if (!Maze_MoveCell()) {
            BT_LOG("[MAZE] STOPPED");
            return false;
        }
        step_pos(&x, &y, hd);
        BT_LOG("[POS] %d %d %c", x, y, DIR_CHAR[hd]);
    }
    BT_LOG("[ESCAPE] step limit reached");
    BT_LOG("[MAZE] STOPPED");
    return false;
}

/* ---------------- map printout ---------------- */

static char hwall(WallState s) { return (s == WALL_PRESENT) ? '-' : (s == WALL_ABSENT) ? ' ' : '.'; }
static char vwall(WallState s) { return (s == WALL_PRESENT) ? '|' : (s == WALL_ABSENT) ? ' ' : ':'; }

void Maze_PrintMap(void)
{
    static const char HEAD[4] = { [NORTH] = '^', [SOUTH] = 'v', [WEST] = '<', [EAST] = '>' };
    char line[4 * MAZE_DIMENSIONS_MAX + 2];
    uint8_t n = MAZE_DIM;

    BT_LOG("MAP (N up, robot ^>v<, G goal, '.'/':' unseen):");
    for (int y = (int)n - 1; y >= 0; y--) {
        size_t k = 0;
        for (uint8_t x = 0; x < n; x++) {
            char h = hwall(WALLS[x][y].north);
            line[k++] = '+';
            line[k++] = h; line[k++] = h; line[k++] = h;
        }
        line[k++] = '+';
        line[k] = '\0';
        BT_LOG("%s", line);

        k = 0;
        for (uint8_t x = 0; x < n; x++) {
            line[k++] = vwall(WALLS[x][y].west);
            char mid = ' ';
            if (CURRENT_CELL.x == x && CURRENT_CELL.y == y) {
                mid = HEAD[CURRENT_ABSOLUTE_DIRECTION];
            } else if (g_maze_cfg.goal.x == x && g_maze_cfg.goal.y == y) {
                mid = 'G';
            }
            line[k++] = ' '; line[k++] = mid; line[k++] = ' ';
        }
        line[k++] = vwall(WALLS[n - 1][y].east);
        line[k] = '\0';
        BT_LOG("%s", line);
    }
    size_t k = 0;
    for (uint8_t x = 0; x < n; x++) {
        char h = hwall(WALLS[x][0].south);
        line[k++] = '+';
        line[k++] = h; line[k++] = h; line[k++] = h;
    }
    line[k++] = '+';
    line[k] = '\0';
    BT_LOG("%s", line);
}

/* ---------------- push game: children push the robot by hand ----------------
 * Motors off. Dead reckoning from the encoders (the wheels must roll on the
 * floor), snapped to the grid: the heading to the nearest 90 degrees (with
 * hysteresis), the position to cells along the current heading. Same frame as
 * the escape run: it starts outside the entry cell (entry_x, 0), facing NORTH
 * = into the maze, so the website maps it onto the drawing the same way. */
#define PUSH_PERIOD_MS      20U
#define PUSH_SNAP_DEG       55.0f   /* re-snap the heading beyond 45 + 10 degrees */
#define PUSH_SENSE_DELAY_MS 400U    /* in a new cell: sense the walls once after this */
#define PUSH_SENSE_MAX_DEG  20.0f   /* ...if roughly square to the grid            */
#define PUSH_SENSE_MAX_MM   45.0f   /* ...and near the cell centre                 */
#define RAD_TO_DEG          57.29578f
#define PI_F                3.14159265f

bool Maze_Push(void)
{
    if (!sensors_mapped()) {
        return false;
    }
    if (Motion_IsBusy()) {
        Motion_Stop();
        osDelay(50);
    }
    Motor_Coast();
    Maze_ResetMap();                       /* map is only for display here */
    const int n = MAZE_DIM;
    const int ex = (g_maze_cfg.entry_x < n) ? g_maze_cfg.entry_x : 0;
    int x = ex, y = -1;                    /* outside, in front of the entry */
    ABSOLUTE_DIRECTION hd = NORTH;

    /* mm per count; the distance scale multiplies counts per mm */
    const float scale = Motion_GetDistanceScale();
    const float mm_l = PI_F * WHEEL_DIAMETER_MM / (ENC_CPR_LEFT * scale);
    const float mm_r = PI_F * WHEEL_DIAMETER_MM / (ENC_CPR_RIGHT * scale);
    const float pitch = g_maze_cfg.pitch_mm;

    float theta = 0.0f;                    /* heading, degrees, + = turned right */
    float theta_q = 0.0f;                  /* heading snapped to the grid        */
    float s = 0.0f;                        /* mm along hd from the cell centre   */
    int32_t l0 = Encoder_Left(), r0 = Encoder_Right();
    uint32_t t_cell = HAL_GetTick();
    bool sensed = true;                    /* nothing to sense outside the maze */
    bool was_outside_entry = true;

    BT_LOG("[PUSH] start: outside the entry (cell %d,0) of a %dx%d maze, facing in.", ex, n, n);
    BT_LOG("[PUSH] Push it slowly with the wheels on the floor. STOP ends.");
    BT_LOG("[POS] %d -1 N", ex);

    for (;;) {
        if (aborted()) {
            BT_LOG("[MAZE] STOPPED");
            return false;
        }
        osDelay(PUSH_PERIOD_MS);

        int32_t l = Encoder_Left(), r = Encoder_Right();
        float dl = (float)(l - l0) * mm_l, dr = (float)(r - r0) * mm_r;
        l0 = l;
        r0 = r;
        theta += (dl - dr) / Motion_GetTrackWidth() * RAD_TO_DEG;
        float err = theta - theta_q;
        s += 0.5f * (dl + dr) * cosf(err / RAD_TO_DEG);

        /* Turned by more than ~half a right angle: snap to the new heading. */
        if (fabsf(err) > PUSH_SNAP_DEG) {
            int quarters = (int)lroundf(err / 90.0f);
            RelDir rel;
            switch (((quarters % 4) + 4) % 4) {
            case 1:  rel = REL_RIGHT; break;
            case 3:  rel = REL_LEFT;  break;
            default: rel = REL_BACK;  break;
            }
            if (quarters != 0) {
                BT_LOG("[CELL] (%d,%d) %c push -> %s", x, y, DIR_CHAR[hd], Maze_RelName(rel));
                theta_q += 90.0f * (float)quarters;
                hd = apply_rel(hd, rel);
                s = 0.0f;                  /* turned on the spot: back to the centre */
                BT_LOG("[POS] %d %d %c", x, y, DIR_CHAR[hd]);
            }
        }

        /* Crossed into the next (or previous) cell along the heading. */
        int moved = 0;
        if (s > 0.5f * pitch) {
            BT_LOG("[CELL] (%d,%d) %c push -> FORWARD", x, y, DIR_CHAR[hd]);
            s -= pitch;
            step_pos(&x, &y, hd);
            moved = 1;
        } else if (s < -0.5f * pitch) {
            s += pitch;
            step_pos(&x, &y, BACK_OF[hd]);
            moved = -1;
        }
        if (moved != 0) {
            BT_LOG("[POS] %d %d %c", x, y, DIR_CHAR[hd]);
            t_cell = HAL_GetTick();
            bool inside = x >= 0 && y >= 0 && x < n && y < n;
            sensed = !inside;
            if (!inside) {
                if (x == ex && y == -1) {
                    if (!was_outside_entry) {
                        BT_LOG("[PUSH] back outside the entry - push it in again");
                    }
                    was_outside_entry = true;
                } else {
                    BT_LOG("[ESCAPE] out of the maze at %d,%d", x, y);
                    BT_LOG("[MAZE] ESCAPED");
                    return true;
                }
            } else {
                was_outside_entry = false;
            }
        }

        /* Settled in a cell, square to the grid, near the centre: look at the walls once. */
        if (!sensed && HAL_GetTick() - t_cell > PUSH_SENSE_DELAY_MS
                && fabsf(theta - theta_q) < PUSH_SENSE_MAX_DEG && fabsf(s) < PUSH_SENSE_MAX_MM) {
            MazeWalls w;
            Maze_Sense(&w);
            CURRENT_CELL = (CELL){(uint8_t)x, (uint8_t)y};
            CURRENT_ABSOLUTE_DIRECTION = hd;
            apply_walls(&w);
            Maze_ReportWalls();
            BT_LOG("[PUSH] (%d,%d) %c walls f=%u l=%u r=%u", x, y, DIR_CHAR[hd], w.df, w.dl, w.dr);
            sensed = true;                 /* wheel counts during sensing are kept */
        }
    }
}
