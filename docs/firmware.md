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

### USB-C console (2026-11-10)

The robot is a **driverless USB serial device** (CDC, VID 0483 / PID 5740).
Plug a USB-C cable into any PC or Chromebook and it appears as a COM port
(COM9 on this PC) with no driver and no ST tools. Output goes to Bluetooth,
USART1 (if mirrored) **and** USB-C at once, and commands may arrive on
Bluetooth or USB-C - both feed the same line buffer (`feed_rx_char` in
`bt_log.c`). The baud rate is ignored by CDC, so 9600 works for both links.

- `usbd_cdc_if.c`: `CDC_Receive_FS` hands bytes to `BT_Log_UsbRx`;
  `CDC_TransmitCplt_FS` calls `BT_Log_UsbTxDone`; `CDC_Transmit_FS` now
  refuses before enumeration (CubeMX dereferenced a NULL class handle there).
- `bt_log.c`: a 2 KB ring, drained in 64-byte packets. It is guarded with
  PRIMASK rather than a FreeRTOS critical section, because the pump also runs
  in the USB interrupt. Bytes are consumed and claimed in one step - advancing
  afterwards races with the completion interrupt and sends every line twice.
- Nothing is buffered while no host is connected, so a robot on a powerbank
  does not fill the ring.
- **Flashing** over USB-C works through the tinyuf2 bootloader (a USB drive
  named RATROCKET), see [Flashing](#flashing). ST's ROM bootloader stays
  unusable on this board; see `hardware.md`.


- **Bluetooth:** HC-05 named `RatRocket` (PIN 1234), 9600 baud. On this PC it is
  COM12. Any serial terminal works; send one command per line.
- **Wired mirror:** in the test and maze modes the same text also goes out on
  USART1 (115200, FTDI on COM7). Not in web-sim mode, where USART1 carries the
  simulator protocol.

## Flashing

### Over USB-C: drag and drop (normal way)

The first 64 KB of flash hold the [tinyuf2](https://github.com/adafruit/tinyuf2)
USB bootloader (since 2026-11-10). In update mode the robot is a USB drive
named **RATROCKET**; copying a `.uf2` file onto it flashes the program. No
driver and no ST tools are needed.

1. Build: `cmake --build build/Debug`. Every build also writes
   `build/Debug/ratrocket.uf2` (objcopy + `tools/make_uf2.py`; needs Python 3,
   otherwise CMake prints a warning and skips the file).
2. Connect USB-C and enter update mode, either way:
   - send `UPDATE` (or `DFU`) over Bluetooth or the USB serial port (works in
     every mode except web-sim, which has no console), or
   - **double-press the reset button** (second press within 0.5 s).
3. Copy `ratrocket.uf2` onto the RATROCKET drive (Explorer, or
   `Copy-Item build\Debug\ratrocket.uf2 D:\`). About 2 s later the drive
   disappears and the robot starts the new program (COM9 is back).

- Pressing reset once leaves update mode without flashing.
- The saved settings survive: the bootloader only erases the sectors the file
  writes to, and `make_uf2.py` refuses an image that would reach the settings
  sector (it also refuses a program not linked for 0x08010000).
- Every start spends 0.5 s in the bootloader (the double-press window).
- Blue LED (PB5): on for that 0.5 s, on in update mode, flickering while a file
  is written. (The pin level is verified; the LED itself not yet by eye.)
- The drive also shows `INFO_UF2.TXT` (bootloader version, board ID
  `KAVWV-RatRocket-F411RE-v1`) and `CURRENT.UF2` (a copy of the flash).
- USB IDs in update mode: VID 1209 / PID 0010 (pid.codes test ID, to be
  replaced by a permanent pid.codes allocation), "KAVWV RatRocket". The
  program itself keeps ST's CDC IDs (0483 / 5740).

### Flash map

| Address | Size | Sectors | Contents |
|---|---|---|---|
| 0x08000000 | 64 KB | 0-3 | tinyuf2 bootloader (16 KB used). It write-protects sectors 0-1 at every start. |
| 0x08010000 | 320 KB | 4-6 | the program (`STM32F411XX_FLASH.ld`; vector table offset in `system_stm32f4xx.c`) |
| 0x08060000 | 128 KB | 7 | saved settings (`settings.c`) |

`UPDATE` (`dfu.c`) writes the bootloader's "stay in update mode" value
0xF01669EF to the RAM word 0x2000FFFC and resets; RAM survives a reset. That
word lies in RAM the program leaves unused (between its heap and the main
stack at the top of RAM).

### With the ST-Link (development and recovery)

- The program, as before (erases sectors 4-6 only, fine with the protection):
  `STM32_Programmer_CLI -c port=SWD -w build/Debug/Rat_Rocket_F411RET6_PinConfigs.elf -v -rst`
- The bootloader (install, update or recovery). Its sectors are
  write-protected, so clear WRP0/WRP1 in the same command; the bootloader sets
  them again at its next start:
  `STM32_Programmer_CLI -c port=SWD -ob WRP0=1 WRP1=1 -w tinyuf2.bin 0x08000000 -v -rst`
- Erasing with `-e` skips the write-protected sectors 0-1 ("Protected sectors
  are not erased"); clear WRP0/WRP1 first to remove the bootloader, and the
  program does not start without it. A full erase also wipes the saved
  settings (sector 7).

### Building the bootloader

Source: the tinyuf2 checkout at `W:/FreelanceProjects/tinyuf2`, board
`ports/stm32f4/boards/kavwv_ratrocket` (`board.h`: LED, USB IDs, clock;
`board.cmake`). Besides the `lib/tinyusb` and `lib/uf2` submodules it needs
`lib/mcu/st/cmsis_device_f4` @ 2615e866 and `lib/mcu/st/stm32f4xx_hal_driver`
@ 04e99fbd (the pins in `tools/get_deps.py`). Build with ST's bundled tools in
a PowerShell **without w64devkit on PATH** (GCC's parallel LTO link would run
its `make`/`sh`, which cannot handle Windows paths), and only the `tinyuf2`
target (the other targets need tinyuf2's own Python scripts):

```powershell
$b = "$env:LOCALAPPDATA\stm32cube\bundles"
$env:PATH = "$b\gnu-tools-for-stm32\14.3.1+st.2\bin;$b\ninja\1.13.2+st.1\bin;$b\cmake\4.3.1+st.1\bin;C:\Program Files\Git\cmd;C:\Windows\System32;C:\Windows"
$bd = "W:/FreelanceProjects/tinyuf2/cmake-build/cmake-build-kavwv_ratrocket"
New-Item -ItemType Directory -Force "$bd/_bin/apps" | Out-Null
cd W:\FreelanceProjects\tinyuf2
cmake -B $bd -G Ninja -DCMAKE_BUILD_TYPE=MinSizeRel -DBOARD=kavwv_ratrocket "-DARTIFACT_PATH=$bd/_bin" ports/stm32f4
cmake --build $bd --target tinyuf2
```

The result is `$bd/tinyuf2.bin` (15.8 KB). The bootloader uses the program's
clock tree (25 MHz crystal, 40 MHz core, 48 MHz USB): tinyuf2's usual F411
setting (84 MHz) crashed at random on this board.

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
| `dfu.c/.h` | `UPDATE` / `DFU` command: restart into the tinyuf2 USB bootloader (RATROCKET drive) |
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
- `CMakeLists.txt` — new source files; post-build step that writes
  `ratrocket.uf2` (`tools/make_uf2.py`).
- `STM32F411XX_FLASH.ld` — program flash 0x08010000-0x0805FFFF (320 KB): the
  first 64 KB hold the USB bootloader, the last 128 KB sector the saved
  settings.
- `system_stm32f4xx.c` — `USER_VECT_TAB_ADDRESS` with `VECT_TAB_OFFSET`
  0x10000, so the vector table is at 0x08010000.

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
- A move is aborted ("following error") if a wheel falls ~37 mm behind its
  target (1000 counts at 26.9 counts/mm), e.g. when it is blocked.
- Left motor reverse was repaired on 2026-11-07 (see hardware.md):
  `MOTION_LEFT_CAN_REVERSE 1 (both wheels reverse since the 2026-11-07 repair)` in `motion.h`. Left wheel only drives forward or
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
| Push game | `PUSH` (motors off, push the robot by hand; encoders track it; `STOP` ends) |
| IMU | `IMU` (scan header H2 over software I2C, WHO_AM_I, 5 raw accel/gyro samples) |
| Maze | `GO`, `GOTO <x> <y>`, `POSE <x> <y> <N\|E\|S\|W>`, `RESETMAP`, `MAP`, `WHERE`, `MAZEDEF <n> <hex>`, `WALLSREP` |
| Settings | `SIZE`, `GOAL`, `PITCH`, `TRACK`, `VRUN`, `VTURN`, `KC <p> <d>`, `HOME 0\|1`, `ALIGN 0\|1`, `SENSE 0\|1`, `WALLUPD 0\|1`, `PIVOTS 0\|1`, `CFG` |
| Keep settings | `SAVE` (to MCU flash, survives power-off; robot freezes ~2 s), `LOAD`, `DEFAULTS` (also erases the saved copy) |
| Misc | `BAT`, `ENC`, `STAT`, `PING`, `UPDATE` or `DFU` (USB update mode: RATROCKET drive, see [Flashing](#flashing)) |

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

## Turning: spins (default) and pivots

**Since 2026-11-07 (left reverse repaired) the default is spins (`PIVOTS 0`,
saved in flash).** TURN 360 on the floor with the powerbank: right exact,
left 1-2° over. Escape run with spins: ESCAPED, front stops at 32-37 mm
(target 33), side readings 45-54 mm (target 48). The pivot notes below
are kept for reference.

- **Pivot turn** (`PIVOTS 1`; the default is spins since 2026-11-07): the inner
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

Escape game on the page:

- The **entry is fixed on the left of 0,0** (green dashes). The robot icon waits
  outside it, facing in. **Clear walls** keeps the entry open and puts the robot
  icon back there. To change it, edit `entry` near the top of the page script.
- Click the **outer wall** (Walls tool) to open the **exit** (green dashes).
  Openings are for the screen only: the robot always gets a closed border in
  `MAZEDEF`.
- **Escape!** sends `ENTRY <n>` for that entry (left of 0,0 = `ENTRY 2`: the
  robot drives in heading east, the cell is the third from its left), then
  `ESCAPE`.
- During an escape the robot reports `[POS]`/`[WALLS]` in its own frame
  (it "drives north into cell ENTRY,0"); the page rotates them onto the drawing.
- The drawing is kept in the browser (`localStorage`), so a page reload keeps it.
- The page no longer sends `WHERE` on connect (the robot's idle position would
  pull the icon off the entry); use **Where are you?** if needed.

First full run, 2026-11-07, maze: walls (0,2)|(1,2), (0,2)/(0,1), (0,1)/(0,0),
(1,1)|(2,1), (2,2)/(2,1), (2,1)/(2,0), (1,0)|(2,0); exit right of (2,2).
Right-hand path (0,0) → (1,0) → left → (1,1) → (1,2) → right → (2,2) → out:
ESCAPED, every sensor reading matched the drawing.

### Round display (optional)

The page can mirror the robot's moves on the KAVWV round display (ESP32 +
GC9A01, firmware in `W:/FreelanceProjects/GC9A01-Display-turnByTurn`) over
BLE, exactly like the phone app does. Click **Connect display** and pick
`KAVWV-xxxx` (the phone app must not be connected to it at the same time).
`web/kavwv_display.js` speaks the display protocol and is checked byte for
byte against all 7 NavCore/Heartbeat/Session golden vectors in the display
repo (`vendor/vectors.json`).

| Robot | Display |
|---|---|
| waiting / run started | "depart" arrow, `--` |
| decides FORWARD / LEFT / RIGHT / UTURN | big arrow; 100 m (straight) or 0 m (turn now) |
| top number | escape: distance driven; GOTO: distance to go (1 cell = 100 m, "mini city") |
| progress arc | escape: share of the maze visited; GOTO: share of the way done |
| `ESCAPED` / `ARRIVED` | finish flag, full arc |
| `STOPPED` | arrow cleared |
| route line | cells driven (grey trail) -> robot -> next cell / GOTO route on the drawn maze (dark), heading-up, 3 m per pixel (a cell ~33 px) |
| turns | the heading is stepped every 66 ms (1.5 s per 90°, 2.5 s per U-turn) so the display swings the route round smoothly; it snaps to the robot's reported direction when the turn ends |

- Always **dark** theme: the page sends SetConfig theme = night on every
  connect (the display resets to "auto" - night only 20:00-06:00 - at each
  power cycle).
- The display cannot draw maze walls (it ignores the map-underlay message and
  the route is one continuous line), so walls stay on the website.
- **Test display (arrows demo)** cycles the arrows without the robot.
- `web/kavwv_display.js` encoders (NavCore, RouteSnippet, Heartbeat, Session)
  are checked against the display repo's golden vectors (8/8 pass).

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
