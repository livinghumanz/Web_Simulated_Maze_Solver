# RatRocket Code — block editor for the classroom

A browser page where pupils (about 10–14) build a program from blocks and
watch it run, first in a simulator and then on the real robot. German is the
default language, English is one click away. Nothing is installed: it is one
HTML file plus three scripts, a font and a few images, and it works offline
from a USB stick.

Open `web/code.html` in **Chrome or Edge**. Firefox and Safari can run the
simulator but cannot connect a robot (no Web Serial).

## Files

| File | Holds |
|---|---|
| `web/code.html` | Page structure and the maze robot sprite (SVG `<defs>`) |
| `web/code.css` | All styling, and the `@font-face` for Fredoka |
| `web/code-data.js` | Blocks, German/English texts, the nine levels |
| `web/code.js` | Editor, drag and drop, simulator, interpreter, variables and watch panel, robot link, own maze, program files |
| `web/code-selftest.js` | Plays a known solution for every level, checks files and font (see below) |
| `web/fonts/` | Fredoka (`fredoka-latin.woff2`) and its licence `OFL.txt` |
| `web/drive.html`, `drive.css`, `drive.js` | **Fernsteuerung** — the remote-control page (see below) |
| `web/img/robot-maze.png` | Top-view render of the real board, the robot in the maze |
| `web/img/robot.png` | The 3/4 render in the header and the robot card |
| `web/img/robot.svg` | A drawn top view of the robot as a standalone file, for slides |

Separate from the Maker Faire page (`web/maze_event.html`), which is
unchanged and still the one that drives a full escape run.

The JS files are plain ASCII: umlauts and symbols are written as `\u` escapes
(`'Gr\u00f6\u00dfe'`), so no editor or shell can garble them.

## Blocks

| Block | Does |
|---|---|
| `fahre 1 Feld` | one cell forward |
| `drehe nach rechts` / `links` / `dreh dich um` | turn on the spot |
| `wiederhole n mal` | repeat, 1 to 9 |
| `wiederhole, bis du draußen bist` | repeat until the robot has left the maze |
| `wiederhole bis …` | repeat until a condition is true — checked before every round |
| `wenn … sonst` | choose, on a condition |
| `setze <Variable> auf <n>` | the variable gets the number n |
| `ändere <Variable> um <n>` | add n to the variable (n may be negative: −1 counts down) |
| `zeige <Variable>` | the value as a speech bubble over the robot, and in the log under the watch panel |

Colours: Fahren blue, Wiederholen green, Entscheiden purple, **Variablen
orange** (`--c-var`, Scratch-like, dark enough for white text).

**Conditions.** A condition is *either* a **sensor condition** — one of six
strings, front/left/right each as "free" or "wall" (`'frontFree'`,
`'rightWall'` …; the six cover the right-hand wall follower without a NOT
block) — *or* a **comparison** `{v, op, n}`: variable `v` compared with the
number `n`, `op` one of `=`, `>`, `<`. Both kinds work in `wenn` and in
`wiederhole bis`. On the page it is one picker: the sensor conditions and,
below them, the program's variables; choosing a variable adds the `= > <`
picker and the number. Old programs (a string) are unchanged.

Blocks are plain objects — `{t:'repeat', n:3, body:[…]}`,
`{t:'changeVar', v:'Schritte', n:1}`,
`{t:'repeatUntil', cond:{v:'Schritte', op:'=', n:5}, body:[…]}` — so a
program is JSON. A path addresses one block, alternating index and key:
`[2,'body',0]` is `prog[2].body[0]`.

## Variables

- **Variablen** in the block box (tasks 7, 8, 9): **Neue Variable** opens a
  small field right there — no browser prompt — with a suggestion
  (`Schritte`, then `Zähler`; in English `Steps`, `Counter`). A name is
  letters (umlauts and ß included) and digits, a letter first, 1–12
  characters, unique ignoring case; at most 12 variables. A wrong name says
  why under the field and **OK** stays off. The names are listed as chips;
  **×** deletes one, but only while no block uses it ("Schritte steckt noch in
  einem Baustein."). The three blocks appear once a variable exists.
- **One scope per program.** The variables belong to the task's program,
  are saved with it in `localStorage` (field `vars`, per task id, checked on
  loading; a name a stored program uses is added back) and in the program
  file.
- **Values start at 0 on every run** — and on every maze of a task with
  several mazes. Numbers in the blocks are −999 to 999 (typed, or − and +);
  values while running are not capped.
- **Watch panel** "Variablen" under the maze: every variable with its value
  now. The one that changed last has a gold outline and blinks once; Zurück
  and every new run set all back to 0. Under it, **Gezeigt** lists what
  `zeige` showed in this run (the last eight). Hidden while the program has
  no variable.
- **The robot never hears about variables.** They live in the browser's
  interpreter; only `fahre`, `drehe` and sensor conditions talk to the robot.
  A comparison sends nothing — not even `WALLS` — and neither do `setze`,
  `ändere` and `zeige` (checked by the self-test with a stand-in robot).
  Nothing changed in the firmware.
- **Runaway guard.** Every variable block is one action and `wiederhole bis`
  costs one action per check, so a condition that never comes true ends with
  "läuft zu lange" like any endless loop.

## Levels

Nine tasks. All but 7 are on a 3×3 grid so every one of them can also run on
the real maze. Stars: three if the program needs at most `par` blocks.

1. **Geradeaus** — a sequence (2 blocks)
2. **Um die Ecke** — turning (5)
3. **Immer im Kreis** — `repeat` pays off (4). The middle cell is walled in
   and a wall on the bottom row (between the middle and the right cell)
   closes the old 3-block shortcut, so "around the outside" is the only way:
   4 blocks with the loop, 8 without (one star)
4. **Schau nach vorne** — the first sensor decision (4)
5. **Raus hier!** — the right-hand wall follower, on the maze the robot really
   escaped on 2026-11-07 (6 blocks, par 7)
6. **Drei Labyrinthe** — the same program, three different mazes
7. **Eigenes Labyrinth** — the pupil builds the maze (see below); no stars
8. **Zähl mit!** — the first variable task (par 6). A U-shaped corridor,
   6 cells: up 2, right 2, down 2 to the star. Won when the program **ends**
   on the star and some variable holds the number of cells driven. Intended:
   `wiederhole 3 mal { wiederhole 2 mal { fahre 1 Feld, ändere Schritte
   um 1 }, drehe nach rechts }` (5 blocks); one loop counting every cell
   (6) earns three stars too. Driving there without counting, or counting
   once per corner, is "Am Stern! Aber keine Variable hat deine 6 Felder
   gezählt." (Typing `setze Schritte auf 6` also wins — a question for the
   class: who counted, you or the robot? Task 9 closes that door.)
9. **Genau 5** — drive exactly 5 cells and stop on the star, in three mazes
   (par 6). Each corridor goes on past the star, so "drive until a wall"
   overshoots, and the mazes need 2, 3 and 2 right turns before cell 5 — no
   fixed number of loop rounds fits all three, and `wiederhole n mal` is not
   in the box. Intended: `wiederhole bis Schritte = 5 { wenn vorne frei
   { fahre 1 Feld, ändere Schritte um 1 } sonst { drehe nach rechts } }`
   (5 blocks; `setze Schritte auf 0` in front still earns three stars).
   Ending on the star after a detour is "… aber nach 7 Feldern. Genau 5
   sollen es sein."

Tasks 8 and 9 are judged when the program ends (`endOnStar`), not when the
robot first touches the star — otherwise the last `ändere` after the last
move would never run, and in task 9 driving past the star would count.
Off the star at the end: "Das Programm ist zu Ende – aber du stehst nicht
auf dem Stern."

**Numbering.** Task ids are what progress, programs and variables are stored
under, and what `?level=` and the file names use, so 1–7 keep their ids.
The own maze stays task **7** — the curriculum uses "Aufgabe 7" from week 3
on, for the tournament and the file swaps — and stays the free task where
every block, variables included, is allowed. The variable tasks come after
it as **8** and **9**, in the order the course reaches them (week 7). A
variant may now move the star (`variants[i].goal`).

Every task starts the robot **inside, on cell (0,0) facing north**. Tasks 5
and 6 have exactly one opening in the border — the exit — and "out" simply
means the robot has left the grid. (The robot's own escape game on the Maker
Faire page and the firmware's button mode still start outside an entry — that
is on purpose and stays there; only this editor starts inside.)

Tasks 5 and 6 were checked for the inside start: the 6-block wall follower
gets out of all three mazes and still earns three stars (par 7), so no wall
or par had to change.

To add a level, append to `LEVELS` in `code-data.js`: walls as `"x,y,DIR"`
(the far side is added automatically), `start`, `goal` (a cell or `'out'`),
`allow` (which blocks appear in the box) and `par`; optionally `endOnStar`,
`cells` (exactly this many moves) and `countCells` (a variable must hold the
moves). Then add its solution to `code-selftest.js` (and the variables it
needs to `VARS`) and run the self-test.

`code.html?level=3` opens one task directly — useful on a worksheet.

## Own maze (task 7)

While no program runs, the maze can be edited. The bar above it holds three
tools, the size, **Leeren** and **Zufall**:

- **Wände** — click a line to switch it on or off. Inside the maze that is a
  wall; on the border it is an opening (green dots) — as many as you like.
- **Start** — click a cell to put the robot there: any cell inside, or any
  cell just outside the border (the ring around the maze, not the corners).
  Clicking the start cell again turns the robot a quarter to the right; the
  robot in the drawing turns with it. A robot outside can only drive in
  through an opening.
- **Ziel** — click a cell to put the star there; click the star to take it
  away. Star and start never share a cell.

Two ways to win, written out on the task line:

- **With a star:** reach the star. Openings are just terrain then — driving
  out of the maze is "outside", not a win.
- **Without a star:** an escape game — be outside the grid after having been
  inside. Any opening counts, the way in too: it is the pupils' own game.
- **Neither star nor opening:** nothing runs; the message says "Dein
  Labyrinth hat kein Ziel – setz einen Stern oder öffne die Außenwand."

`wiederhole, bis du draußen bist` uses the same rule ("inside once, now
outside"), so it works for starts inside and outside.

- **Sizes** from 3×3 to 32×32 — 16×16 and 32×32 are the classic and the
  half-size Micromouse competition mazes (said in the size's "i"). Each size
  keeps its own maze.
- **Echter Roboter: up to 5×5** — the firmware's maze is at most 5×5. On a
  bigger own maze the page refuses to run in robot mode ("Der echte Roboter
  kann bis 5 × 5 – größere Labyrinthe laufen in der Simulation.") and never
  drives the robot; the simulation always runs. The page sends no `MAZEDEF`.
- **Zufall** builds a perfect maze (every cell reachable, exactly one way
  between two cells) with an iterative backtracker — instant even at 32×32.
  The start stays as placed. The border closes again, except: a start outside
  gets the opening in front of it, and without a star there is one exit at
  the border cell farthest (by steps) from the start. A star moves to the
  cell farthest from the start. Openings the pupil made elsewhere are closed.
- **Leeren** removes all walls; start, star and openings stay.
- All blocks are allowed, `wiederhole bis` and the variables too. No par and
  no stars: a win shows the block count ("Geschafft! 7 Bausteine.").
- Hovering shows which line or cell a click would change. While a program runs
  or is being stepped, the maze is locked; **Zurück** unlocks it.
- The mazes (with start and goal) are saved in `localStorage` with everything
  else (key `ratrocket.code`, field `sandbox`) and checked when loaded.

Big mazes stay quick: walls and openings are drawn as one path each, above
16×16 the cells are one tile and above 12×12 the corner dots go; lines get
thinner with the cell. A 32×32 maze is about 70 SVG elements; Zufall plus
drawing took 17 ms and an edit about 3 ms in headless Edge. The robot moves
in shorter steps in big mazes (in proportion to the cell), so it crosses the
screen as fast as in a 5×5, and the runaway guard grows with the maze
(16 actions per cell; a wall follower needs about 8 — measured, at most 544
on 20,000 random 8×8 mazes), so a correct program is never stopped as
"läuft zu lange".

## Saving and opening programs

**Speichern** (top of the program panel) downloads the program of the open
task as `ratrocket-aufgabe<N>.json` — for handing in, or for later:

```json
{ "version": 2, "level": 9, "lang": "de", "vars": ["Schritte"],
  "prog": [ { "t": "repeatUntil", "cond": { "v": "Schritte", "op": "=", "n": 5 },
              "body": [ … ] } ] }
```

`vars` lists the program's variables (empty if it has none). Files written
before variables existed say `"version": 1` and have no `vars`; they still
open.

On task 7 the file also carries the maze, so a teacher sees what the program
was built for:
`"maze": { "n": 4, "walls": ["1,1,E"], "exits": ["3,3,N"], "goal": null, "start": { "x": 0, "y": 0, "d": "N" } }`.

**Öffnen** loads such a file into the task that is open now; if the file came
from another task, the message says so ("Programm aus Aufgabe 5 geladen.").
A task-7 file opened on task 7 brings its maze back too.

Opening is strict, and a file is data only — it is read with `JSON.parse` and
never run. `version` must be 1 or 2; every block must be a known type with
exactly its fields; `wiederhole` counts are clamped to 1–9, the other numbers
to −999–999; a condition must be one of the six sensor conditions or a
comparison `{v, op, n}` with `op` one of `= > <`; at most 500 blocks, 12
levels deep, 200 kB; unknown keys are dropped. Version 2 must list `vars`:
valid, unique names (as above), at most 12; a block or comparison naming a
variable that is not listed refuses the file. Version 1 knows only the seven
old block types and no variables.
A maze must be 3–32 cells wide; walls inside, openings on the border; the
start inside or on the ring just outside; the star inside and not on the
start.
If anything is wrong the whole file is refused with a short message and the
program stays as it was.

## Win moment

When a task is solved, 14 gold stars burst from the robot for about a second
and the robot hops once on its axle — SVG and CSS only. With "reduce motion"
switched on in the operating system nothing moves. The verdict bar is the same
either way.

## Tournament counters

After every run — solved or not — the verdict bar shows, in a small line under
the message, what the tournament counts (`docs/curriculum/anhang-turnier.md`):

`6 Bausteine · 5 Felder · 3 Drehungen · 74 Fahrzeit-Punkte`

Blocks are the program's blocks; Felder are the cells actually driven (the
move out of the maze counts); Drehungen are the turns actually made —
`drehe nach rechts`, `drehe nach links` and `dreh dich um` count alike; and
**Fahrzeit-Punkte = 10 × Felder + 8 × Drehungen**. A move into a wall is not
counted. On task 6 the line is for the maze just driven. The test hook has
them as `RRApp.stats`. Check values from the curriculum: task 2 = 48, task 5
= 74 (both met by the self-test).

## Real robot

The switch **Echter Roboter** sends every block to the robot over Web Serial
(USB-C or Bluetooth, 9600). One block, one console command, and the page waits
for the robot's reply:

| Block | Command | Reply it waits for |
|---|---|---|
| move | `CELL` | `CELL done` / `CELL failed` |
| turn | `TURN 90`, `TURN -90`, `TURN 180` | `TURN done` |
| `wenn` | `WALLS` | `WALLS: F=… L=…(wall) R=…(wall)` |

In robot mode the **sensors decide**, not the drawing: the answer to `WALLS`
drives the `wenn` block, so a maze built differently from the screen still
works. The robot must be in maze mode (DIP SW3).

Variable blocks and comparisons send **nothing**: variables live in the
browser (see *Variables*). `wiederhole bis` with a sensor condition sends
`WALLS` before each round, like `wenn`.

Switching it on tells the pupil where to put the robot: the task's start cell
and heading ("… ins Startfeld unten links im Labyrinth, Blick nach oben
(Norden)"; in an own maze the placed start, also outside the border). Own
mazes above 5×5 do not run in robot mode at all (see above).

- **Tasks 6 and 9 never move on by themselves with the robot.** In the
  simulation the next maze still starts after a second; with **Echter Roboter** the verdict
  says "Geschafft! 1/3. Bau das nächste Labyrinth auf und stell den Roboter
  auf den Start." and waits for **Weiter**.
- **No answer is its own message.** If the robot does not answer a command in
  time (`CELL` 15 s, `TURN` 12 s, `WALLS` 4 s), the run ends with "Der
  Roboter antwortet nicht – Verbindung prüfen." instead of the wall message.
  A refused or failed move is still "Autsch – da ist eine Wand".

## Fernsteuerung (remote control)

`web/drive.html` drives the robot directly with a big cross of buttons —
curriculum lesson 4 (ages 8–10), built for a phone over Bluetooth as much as
for a laptop. Link: **Fernsteuerung** in the editor's top bar (and back via
**RatRocket Code**). The robot must be in maze mode (DIP SW3 on, SW1/SW2 off).

| Button | Command | Reply it waits for |
|---|---|---|
| up | `FWD 160` (or `FWD 80` with *½ Feld*) | `FWD done (event n)` |
| down | `FWD -160` / `FWD -80` | `FWD done …`; older firmware: `FWD rejected` |
| left / right | `TURN -90` / `TURN 90` | `TURN done (event n)` |
| *langsam / mittel / schnell* | `VRUN 50` / `VRUN 80` / `VRUN 120` | the `v_run …` line of the CFG block |
| STOPP | `STOP` | none — never locked |

Backwards was checked in the firmware source, not assumed: `FWD` parses a
signed distance (`strtof`, limit ±1000 mm, `app_maze.c`) and
`Motion_Forward` refuses a negative one only if a wheel cannot reverse; both
reverse flags are 1 in `motion.h` since the left-motor repair (the note in
`docs/firmware.md` still says 0). A robot with older firmware answers
`FWD rejected`; the page then says backwards is not possible and suggests
"Links" twice.

While a command waits for its reply, the arrows, step and speed are locked;
**STOPP** always works (during a move the robot stops and still answers
`FWD done`). Speed is sent once after connecting, so the robot drives at the
speed shown. Arrow keys drive, space or Escape stops. Same German/English
switch as the editor (the language setting is shared).

`drive.html?selftest=1` runs a smoke test with a stand-in robot: every button
and option must send exactly its command, the lockout must hold (other
buttons send nothing, STOP goes out at once), a silent robot must give the
"antwortet nicht" message, and a refused backwards move its own hint. Last
run (2026-11-11): **ALL PASS (18 checks)**.

## Self-test

`web/code.html?selftest=1` loads `code-selftest.js`, which runs at full speed:

- tasks 1–6, 8 and 9 with their intended solution — solved, three stars, start inside
  on (0,0) facing north, and exactly one border opening on tasks 5 and 6
  (task 6 must solve all three of its mazes);
- the tournament counters of those runs (tasks 1–5: 20, 48, 76, 48, 74
  Fahrzeit-Punkte); task 3's old shortcut must crash and the loop-less
  8-block solution earn one star; task 6 with a stand-in robot must wait for
  **Weiter** after each maze; a silent robot (on `CELL` and on `WALLS`) must
  give the "antwortet nicht" message;
- own mazes set through the test hook — with a star, with an exit past a dead
  end, and with a moved and turned start for both kinds of goal — each must
  be solved, and no stars may be handed out;
- the own maze's rules — a start outside gets in through one opening and out
  through another; out through the way in counts too; a star win from
  outside; with a star, driving out is no win; no star and no opening shows
  the message instead of running; the edit rules (pure toggles, start inside
  or just outside, turning) through the same edits a click makes;
- Zufall — random mazes at 3×3, 5×5, 8×8 and 32×32, starts inside and
  outside: perfect and connected, start kept, way in open, star or exit
  farthest from the start; and the wall follower must solve random 5×5,
  8×8 and 16×16 mazes in both modes;
- Echter Roboter refuses an 8×8 own maze with the 5×5 message, but not a 5×5;
- program files — a saved program opens again unchanged, a task-7 file keeps
  its maze and start, counts are clamped, unknown keys dropped, and 21 broken
  or hostile files are refused;
- tasks 8 and 9 with their intended solutions (three stars; task 9 in all
  three mazes), and task 8 in the counters (84 Fahrzeit-Punkte);
- variables — `setze`, `ändere` (also negative) and `= > <` in `wenn` give
  the right values, and the next run starts at 0 again; `wiederhole bis`
  counts to 4, stops at `> 9`, runs no round when already true, and stops
  at a wall with `vorne Wand`; three never-true loops end at the action
  budget; the watch panel shows 0, then each new value with the gold outline
  on the last change, `zeige` gives the bubble and the log entry, Zurück
  resets, and the panel hides without variables; **Neue Variable** through
  the page (suggestion, name rules, case-insensitive duplicates, blocks
  appear, a used variable cannot be deleted); the Variablen box only on
  tasks 7–9, and the task ids are 1–9;
- wrong programs do not win: task 8 without counting or counting once per
  corner; task 9 with `Schritte > 5`, `bis vorne Wand`, no turning, fixed
  moves, `wiederhole 7 mal` / `8 mal` (one maze at most), and past the star
  and back; a second variable-driven form of task 9 does win;
- with a stand-in robot: task 8 sends exactly `CELL` and `TURN 90`, task 9
  sends `WALLS` only for its 7 sensor checks, never for its 8 comparisons;
- version-2 files keep variables and the blocks using them (a variable
  called `constructor` too), version-1 files open, numbers are clamped to
  −999–999, and 21 broken files with variables are refused; the
  `localStorage` data holds the variables, and loading drops bad lists and
  brings back names a stored program uses;
- the font — Fredoka must load from `web/fonts`, with no font CDN on the page.

Run it after changing a level, the interpreter or the file format. It never
writes to `localStorage`, so running it in a classroom browser does not touch
the pupils' work. `?selftest=hook` only sets up the test hook
(`window.RRApp`) for scripted screenshots and runs nothing.

Last run (2026-11-11): **ALL PASS (52 checks).**

Headless:

```
msedge --headless=new --virtual-time-budget=40000 --dump-dom \
  "file:///W:/FreelanceProjects/Micromouse/web/code.html?selftest=1"
```

The page title becomes `SELFTEST PASS` or `SELFTEST FAIL <ids>`.

## Notes

- Progress, programs and own mazes are kept in `localStorage` — per browser,
  no accounts, nothing leaves the machine.
- The maze robot is a top-view render of the real board. Its wheel axle sits
  on the cell centre, so it turns on the spot like the real robot. The sprite
  scale is one line in `drawMaze()` (`code.js`).
- Fredoka ships in `web/fonts`: one variable woff2 (weights 400–600, latin
  subset, includes the umlauts), SIL Open Font License, loaded with
  `font-display: swap` and the system fonts as fallback. The page makes no
  request to the internet.
- The win rules live in `reachedGoal()` and `isOut()` (`code.js`): the star,
  or outside the grid after having been inside (`world.entered`). Tasks start
  inside, so for them "out" is simply "off the grid".
- The intended 6-block solution of task 5 is not dead-end safe (it always
  drives after deciding): measured on random mazes it crashes in about 30 %
  of 3×3, 83 % of 5×5 and 99 % of 8×8 mazes. The 7-block version that only
  turns left when blocked always gets through — a good question for the
  class.

## Not built yet

- **Lists** and **own functions** (blocks made of blocks) — the next steps
  after variables (curriculum module 7 and 8).
- Programs stored **on** the robot, so it runs without a laptop. Needs the
  interpreter in the firmware (`PUSH`-style), then slots in flash.
- A teacher view of who solved what.
