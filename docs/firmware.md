# RatRocket firmware — standalone build

How the firmware is organised, how to select a mode, and how to drive and
calibrate the robot over Bluetooth. Hardware facts (pins, known board faults)
are in [hardware.md](hardware.md).

## Modes (DIP switches, read once at boot)

Only SW1–SW3 are used (one of the four switches on the board does not work).
Change the switches, then reset or power-cycle.

| SW1 | SW2 | SW3 | Mode | File |
|---|---|---|---|---|
| off | off | off | Web-simulator flood-fill over USART1 (original flow, unchanged) | `maze_main.c` |
| ON | off | off | Bluetooth link test: heartbeat, `PING`, `DIP`, `BAT`, `BTNAME` (motors off) | `app_bt_test.c` |
| off | ON | off | Motor test (open loop): `SWEEP`, `PWM`, `CAL`, `DECEL`, `PWMFREQ` — wheels lifted | `app_motor_test.c` |
| ON | ON | off | PID test: `FWD`, `SPD`, live gain tuning, telemetry — wheels lifted | `app_pid_test.c` |
| off | off | ON | **Maze**: ultrasonic walls + PID moves + flood-fill | `app_maze.c` |

Every mode prints a banner and answers `HELP`.

## Talking to the robot

- **Bluetooth:** HC-05 named `RatRocket` (PIN 1234), 9600 baud. On this PC it is
  COM12. Any serial terminal works; send one command per line.
- **Wired mirror:** in the test and maze modes the same text also goes out on
  USART1 (115200, FTDI on COM7). Not in web-sim mode, where USART1 carries the
  simulator protocol.

## Architecture

| Task | Priority | Job |
|---|---|---|
| `motion` (`motion.c`) | High, 1 kHz | Encoders, speed profiles, per-wheel PID, motor PWM |
| `ultrasonic` (`ultrasonic.c`) | AboveNormal | Fires the 3 HC-SR04 in turn; echoes timed by EXTI + DWT cycle counter |
| `defaultTask` → `app_*.c` | Normal | Mode logic and Bluetooth console; the maze run executes here |
| `telemetry` / `motion_ev` | BelowNormal | Formats motion samples / events for the log |

Rules that keep timing clean:

- **Logging never blocks.** `BT_LOG()` formats into a ring buffer per UART that
  the UART interrupt drains. A full buffer drops the line and counts it
  (`STAT` shows the drop counters).
- **The control loop never prints.** It pushes binary `MotionSample` records
  into a FreeRTOS queue without waiting; a low-priority task turns them into
  text.
- **Commands reach the control task through a queue**, so every `Motion_*` call
  is safe from any task.

### Modules

| File | Purpose |
|---|---|
| `bt_log.c/.h` | Non-blocking Bluetooth/USART1 log and Bluetooth line input |
| `dip_switch.c/.h` | DIP read (physical SW1..SW4 = PC3..PC0) and mode names |
| `encoder.c/.h` | 32-bit wheel positions from the 16-bit TIM4 (left) / TIM2 (right) |
| `motor.c/.h` | Signed per-wheel PWM, brake/coast, PWM frequency (vendor helpers kept) |
| `battery.c/.h` | Supply voltage (ADC PA0), safe to call from several tasks |
| `motion.c/.h` | Closed-loop moves: `Motion_Forward`, `Motion_Turn`, `Motion_Speed`, steering |
| `ultrasonic.c/.h` | HC-SR04 driver, median reads |
| `maze_run.c/.h` | Flood-fill run with real sensors: sense → plan → turn → drive one cell |
| `settings.c/.h` | Save/load maze-mode settings in MCU flash sector 7 |
| `dfu.c/.h` | `DFU` command: reset into the ROM USB bootloader (`.noinit` request flag) |
| `app_*.c/.h` | One file per DIP mode (console + mode logic) |

### Changes to the original files

Kept small on purpose:

- `main.c` — `BT_Log_Init()` after the UART init.
- `freertos.c` — `StartDefaultTask` reads the DIP switches and dispatches to a
  mode; all switches off continues into the original web-sim loop.
- `maze.h`, `maze.c`, `costAlgorithm.c` — the maze size is now a runtime value
  (`MAZE_DIM`, default 5 for the web simulator); arrays are sized by
  `MAZE_DIMENSIONS_MAX` (5).
- `motor.c/.h` — new functions added; existing ones unchanged.
- `CMakeLists.txt` — new source files.
- `STM32F411XX_FLASH.ld` — program flash limited to 384 KB (the last 128 KB
  sector holds saved settings); new `.noinit` RAM section.
- `main.c` — `Dfu_CheckAtStartup()` first thing in `main()`.

## Motion control (`motion.c`)

- 1 kHz loop. Each wheel follows a target position integrated from a
  trapezoidal speed profile. Duty = feed-forward (`KFF` × speed + `KS`
  static-friction offset) + PID on position error, then scaled by
  (tuning supply ÷ present supply) so tuning on USB carries over.
- PWM at ~1 kHz: the motor dead-band drops from ~700 to ~250 duty (of 1010)
  compared with the vendor's 10 kHz.
- Constants measured on this robot: wheel Ø34 mm, ≈2874 encoder counts per
  wheel turn ≈ 26.9 counts per mm (from a 300 mm floor run against a ruler —
  eye-counted wheel turns gave ~2510 and were wrong), track width 96 mm.
  Fine-tune at runtime in maze mode with `CALDIST` and `TRIM`.
- Default gains (tuned with the wheels lifted, USB power):
  `KP 3, KI 6, KD 0.05, KFF 0.14, KS 130`.
- A move is aborted ("following error") if a wheel falls ~128 mm behind its
  target, e.g. when it is blocked.
- **Left motor cannot reverse yet** (board fault, see hardware.md):
  `MOTION_LEFT_CAN_REVERSE 0` in `motion.h`. Left wheel only drives forward or
  coasts; left in-place turns are done as 270° right turns. Set the flag to 1
  after the repair.

## Maze mode

Robot starts in cell (0,0) facing NORTH (x grows east, y grows north). Defaults
for the Maker Faire maze: 3×3 cells, 160 mm pitch (cells are ~16 cm, not exact;
14.5 cm cells were too small for the 10×10 cm robot to spin), track width
96 mm, 80 mm/s straight / 50 mm/s turns, goal (1,1), drive home after the goal.
All settings can be changed over Bluetooth (they reset to the defaults on
power-up).

Uneven cells: while driving one cell, if the front sensor sees the wall that
closes the target cell (within ±50 mm of where it is expected), the stop
point moves to "that wall − calibrated front distance", so the robot stops in
the right place whatever the cell size. With no wall ahead it drives the
nominal pitch; the next wall it sees corrects the error.

### Commands

| Group | Commands |
|---|---|
| Sensors | `US`, `USW <ms>` (stream, `USW 0` off), `USMAP <front> <left> <right>` (1–3 = US1–US3, 0 = none), `WALLS` |
| Calibration | `CALSPIN`, `CENTER`, `CAL`, `THR <front> <side>`, `CALDIST <commanded mm> <actual mm>`, `TRIM <pct>` (+ if it curves left) |
| Single moves | `FWD <mm> [v]`, `TURN <deg> [v]` (spin, + = clockwise), `PIVOT <deg> [v]`, `CELL`, `STOP` |
| Escape | `ESCAPE`, `ENTRY <n>`, `BTN ESCAPE\|GO` (what the PB2 button starts) |
| Maze | `GO`, `GOTO <x> <y>`, `POSE <x> <y> <N\|E\|S\|W>`, `RESETMAP`, `MAP`, `WHERE`, `MAZEDEF <n> <hex>`, `WALLSREP` |
| Settings | `SIZE`, `GOAL`, `PITCH`, `TRACK`, `VRUN`, `VTURN`, `KC <p> <d>`, `HOME 0\|1`, `ALIGN 0\|1`, `SENSE 0\|1`, `WALLUPD 0\|1`, `PIVOTS 0\|1`, `CFG` |
| Keep settings | `SAVE` (to MCU flash, survives power-off; robot freezes ~2 s), `LOAD`, `DEFAULTS` (also erases the saved copy) |
| Misc | `BAT`, `ENC`, `STAT`, `PING`, `DFU` (USB bootloader; hold BOOT0 — see hardware.md, USB enumeration currently fails) |

The PB2 push-button starts `ESCAPE` (or `GO` after `BTN GO`), 1 s after
release. During a run, `STOP` or the button aborts.

### Calibration checklist (in the maze)

1. `USMAP`: identify which sensor (US1–US3) faces front/left/right — hold a
   hand in front of one sensor and watch `USW 250`.
2. Distance: `FWD 300` along a ruler, then `CALDIST 300 <measured mm>`.
   If it curves, `TRIM <pct>` (+ when it curves left; about
   200 × sideways offset × track ÷ distance², in %).
3. `TRACK <mm>`: wheel centre distance. Check with `TURN 360` (do this after
   the distance calibration): if the robot turns short, increase TRACK by the
   ratio 360 ÷ actual angle.
4. `PITCH <mm>`: run `CELL` from a cell centre; adjust until it stops at the
   next centre.
5. Side centring, either way:
   - `CALSPIN` (no ruler): robot anywhere in a cell with walls left and right;
     it spins 180° and back on the spot and learns each sensor's "centred"
     reading from the two views (mounting differences cancel out). Then
     `CENTER` shifts it onto the centre line (turn 90°, drive, turn back).
   - or place it exactly centred by hand and `CAL`. It learns the left and right "centred" readings
   separately (the sensors may be mounted or aimed slightly differently) and
   the side-wall threshold. If there is also a wall ahead it learns the front
   stop distance; otherwise repeat `CAL` in a cell with a wall ahead.
6. `CELL` along a straight corridor to check centring; tune `KC` if it weaves
   (lower p / raise d) or drifts (raise p).
7. `GO`.

`SAVE` stores the current settings in the MCU's flash (sector 7, see
`settings.c`); they are loaded at every boot. Unsaved changes are lost at
power-off.

## Escape game (`ESCAPE`)

The Maker Faire game: visitors build a 3×3 maze with **one entry and one exit
in the outer wall**. The entry can be on any side; whichever way the robot
faces as it drives in is its NORTH. Tell it where along that side the entry
cell is, seen from the robot as it drives in: `ENTRY 0` = the corner with the
outer wall on its left (default), `ENTRY 1` = the middle cell,
`ENTRY 2` = the corner with the outer wall on its right.

1. Put the robot **outside, in front of the entry, facing in**, with its wheel
   axle about one cell length (16 cm) before the middle of the entry cell.
2. `ESCAPE`, the **Escape!** button on the website, or the **PB2 button**
   (`BTN ESCAPE` is the default; `BTN GO` switches the button to the
   flood-fill run).
3. The robot drives into the entry cell and follows the **right-hand wall**,
   one cell per step: right if open, else straight, else left, else U-turn. It needs **no map**, so
   uneven cells (16–17 cm, gaps between wall blocks) do not matter.
4. When it has left the maze area it stops: `[MAZE] ESCAPED`. If it comes back
   out through the entry it reports that there is no other exit.

Fit and safety rules used here:

- **Opening vs. joint gap**: a side only counts as open if it reads open at the
  stop **and** mostly open during the last 60 mm of the approach. The few-cm
  gaps between wall blocks only show up for an instant and are rejected.
- **Distance to the walls**: centring keeps the robot in the middle, or at its
  calibrated distance from the single wall it follows; closer than 25 mm to a
  side wall it steers away at full strength.
- **Front**: stops before a wall (under 18 mm) and on a blocked wheel.

## Turning: pivots (default) and spins

- **Pivot turn** (`PIVOTS 1`, default for left and right turns): the inner
  wheel stays still and only the outer wheel drives forward, along an arc as
  wide as the track. It needs **no reverse** (works with the left-motor fault),
  is more repeatable, and needs less room than a spin: in a 16 cm cell about
  13 mm to the walls versus about 4 mm for a spin.
- A pivot moves the robot centre half a track width (~48 mm) forwards and
  sideways, so in pivot mode the robot **stops 48 mm short of each cell
  centre**; after the pivot it is exactly on the new corridor's centre line and
  the next move is 96 mm shorter. Front-wall stop distance and wall threshold
  are shifted by the same 48 mm automatically (calibrate `front_center` at the
  cell centre as before).
- **U-turns are always spins** (there is no room to pivot in a dead end). They
  are clockwise, so they work with the left-motor fault.
- `PIVOTS 0` returns to in-place spins with stops at the cell centre.
- For `GO`/`GOTO` in pivot mode, place the robot with its axle ~5 cm before the
  centre of the start cell.

## Visitor website (`web/maze_event.html`)

Single HTML file, no server, works offline. Open it in **Chrome or Edge**
(Web Serial), click **Connect robot** and pick the HC-05 port ("Standard
Serial over Bluetooth link", COM12 on this PC). The robot must be in maze
mode (SW3).

Flow at the booth:

1. Visitors build the maze on the floor and draw the same walls on the page
   (Walls tool: click the line between two cells), or press **Random maze**
   and build what it shows. Every change is sent to the robot (`MAZEDEF`).
2. Place the robot and tell the page where it is (**Robot is here** + facing),
   unless it is at the power-on default (0,0) facing N.
3. **Start**: click a cell, the robot drives there. **Goal**: click a cell, it
   drives there from where it is.
4. "Let the sensors correct the drawing" is **off** by default (`WALLUPD 0`):
   the drawing is the truth for walls, the sensors only centre the robot,
   set the stop point and prevent collisions; disagreements are still shown
   in red/orange. On (`WALLUPD 1`): two contradicting readings in a row change
   the robot's map and it replans.

The page uses the robot's coordinates directly: (0,0) bottom-left, North up.
(The older RaspRover hackathon page used a rotated layout; this one does not.)

### Protocol (text lines, 9600 baud)

Page → robot:

| Line | Meaning |
|---|---|
| `MAZEDEF <n> <hex>` | Full drawn maze: n×n hex digits, x-major (x outer, y inner), bits N=1 E=2 S=4 W=8. Border forced closed. Accepted while driving. |
| `GOTO x y` | Drive to a cell from the current pose |
| `POSE x y D` | The robot stands at (x,y) facing D |
| `WALLUPD 0\|1`, `WHERE`, `STOP` | Sensors may correct the drawing, report pose, abort |

Robot → page:

| Line | Meaning |
|---|---|
| `[POS] x y D` | Pose after every turn and every cell, and after `POSE` / `WHERE` / a finished `GOTO` |
| `[WALLS] n <hex>` | Robot's wall map: 2 hex digits per cell, x-major, byte = N \| E<<2 \| S<<4 \| W<<6, each 0 open / 1 wall / 2 unseen |
| `[MISMATCH] x y D drawn=… seen=… (n/2)[ -> updated / -> kept drawing]` | A reading contradicts a known wall; it is only changed after 2 in a row and only with `WALLUPD 1` |
| `[CELL] (x,y) D f= l= r= walls LFR -> (x,y) ACTION` | One planning step: distances (mm), walls seen, next cell and the move |
| `[MAZE] ARRIVED` / `STOPPED` | Result of each leg (`GOTO`, or goal / home in `GO`) |
| `[BUSY] ignored '…'` | A command arrived while driving (only `STOP` and `MAZEDEF` are accepted then) |
| `[SENSOR] left (US2) not responding …` / `… OK again` | A mapped ultrasonic gave no echo 3 times in a row / recovered |

### Safety and robustness

- Ultrasonics miss walls they see at a slant (corners, after an imperfect
  turn). So a known wall is never changed by a single reading (2 in a row,
  and only with `WALLUPD 1`).
- While driving a cell, a front reading under 18 mm ends the move at once
  (braking) instead of driving into the wall.
- A wheel more than ~37 mm behind its target (blocked by a wall) aborts the
  move: `[EV] ABORT following error`.
- "NO PATH" while exploring (`WALLUPD 1`): the robot forgets the map once and
  explores again from where it stands.

### When a sensor fails

- "No echo" is treated as **unknown**, never as "no wall": the maze is closed,
  so a working sensor always hears some wall. The drawn wall is kept.
- Side sensor dead: centring uses the other side or none (encoder straight
  driving). Front sensor dead: the robot drives the nominal pitch per cell.
- Operator fallback: untick "Check walls with the sensors" on the page
  (`SENSE 0`) and the robot follows the drawing only.
| `[EV] ABORT following error …` | A wheel was blocked |
