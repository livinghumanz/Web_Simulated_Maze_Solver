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
| `web/code-data.js` | Blocks, German/English texts, the seven levels |
| `web/code.js` | Editor, drag and drop, simulator, interpreter, robot link, own maze, program files |
| `web/code-selftest.js` | Plays a known solution for every level, checks files and font (see below) |
| `web/fonts/` | Fredoka (`fredoka-latin.woff2`) and its licence `OFL.txt` |
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
| `wenn … sonst` | choose, on one of six sensor conditions |

Conditions: front/left/right, each as "free" or "wall". The six cover the
right-hand wall follower without needing a NOT block.

Blocks are plain objects — `{t:'repeat', n:3, body:[…]}` — so a program is
JSON. A path addresses one block, alternating index and key: `[2,'body',0]`
is `prog[2].body[0]`.

## Levels

Seven tasks. 1–6 are on a 3×3 grid so every one of them can also run on the
real maze. Stars: three if the program needs at most `par` blocks.

1. **Geradeaus** — a sequence (2 blocks)
2. **Um die Ecke** — turning (5)
3. **Immer im Kreis** — `repeat` pays off (4)
4. **Schau nach vorne** — the first sensor decision (4)
5. **Raus hier!** — the right-hand wall follower, on the maze the robot really
   escaped on 2026-11-07 (6 blocks, par 7)
6. **Drei Labyrinthe** — the same program, three different mazes
7. **Eigenes Labyrinth** — the pupil builds the maze (see below); no stars

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
`allow` (which blocks appear in the box) and `par`. Then add its solution to
`code-selftest.js` and run the self-test.

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
- All blocks are allowed. No par and no stars: a win shows the block count
  ("Geschafft! 7 Bausteine.").
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
{ "version": 1, "level": 5, "lang": "de",
  "prog": [ { "t": "untilOut", "body": [ … ] } ] }
```

On task 7 the file also carries the maze, so a teacher sees what the program
was built for:
`"maze": { "n": 4, "walls": ["1,1,E"], "exits": ["3,3,N"], "goal": null, "start": { "x": 0, "y": 0, "d": "N" } }`.

**Öffnen** loads such a file into the task that is open now; if the file came
from another task, the message says so ("Programm aus Aufgabe 5 geladen.").
A task-7 file opened on task 7 brings its maze back too.

Opening is strict, and a file is data only — it is read with `JSON.parse` and
never run. `version` must be 1; every block must be a known type with exactly
its fields; `wiederhole` counts are clamped to 1–9; conditions must be one of
the six; at most 500 blocks, 12 levels deep, 200 kB; unknown keys are dropped.
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

Switching it on tells the pupil where to put the robot: the task's start cell
and heading ("… ins Startfeld unten links im Labyrinth, Blick nach oben
(Norden)"; in an own maze the placed start, also outside the border). Own
mazes above 5×5 do not run in robot mode at all (see above).

## Self-test

`web/code.html?selftest=1` loads `code-selftest.js`, which runs at full speed:

- tasks 1–6 with their intended solution — solved, three stars, start inside
  on (0,0) facing north, and exactly one border opening on tasks 5 and 6
  (task 6 must solve all three of its mazes);
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
- the font — Fredoka must load from `web/fonts`, with no font CDN on the page.

Run it after changing a level, the interpreter or the file format. It never
writes to `localStorage`, so running it in a classroom browser does not touch
the pupils' work. `?selftest=hook` only sets up the test hook
(`window.RRApp`) for scripted screenshots and runs nothing.

Last run (2026-11-11): **ALL PASS (33 checks).**

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

- Programs stored **on** the robot, so it runs without a laptop. Needs the
  interpreter in the firmware (`PUSH`-style), then slots in flash.
- A teacher view of who solved what.
