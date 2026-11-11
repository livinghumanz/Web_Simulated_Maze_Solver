# RatRocket Lernen — concept explainers and Lexikon

`web/learn.html` explains how the robot works, for pupils of about 10–16. It
has seven interactive explainers, a Lexikon of 49 words and links to the
printable worksheets (`web/print/`, see below). German first,
English one click away. It works offline from `file://` in Chrome or Edge:
no server, no CDN, SVG and plain JavaScript only.

## Files

| File | Holds |
|---|---|
| `web/learn.html` | Page frame: top rail (Themen, Lexikon, Arbeitsblätter), robot sprite (`#bot`), view container |
| `web/code-data.js` | The editor's data, loaded read-only: the Variablen explainer and the Variable card take the block words (`setze … auf …`, `wiederhole bis …`) and glyphs from it, so they read exactly like RatRocket Code. Without it `learn.js` uses a built-in copy |
| `web/learn.css` | All styling. Tokens copied from `code.css`; Fredoka is referenced from `web/fonts`, not copied |
| `web/learn-data.js` | All texts (`TEXT.de` / `TEXT.en`), the seven topics, `DIPMODES`, the Lexikon categories and entries |
| `web/learn.js` | Router, the seven simulations, home cards, Lexikon, micro-interactions, self-test |

The JS files are plain ASCII. Umlauts and symbols are `\u` escapes (`'Gr\u00f6\u00dfe'`).

## Addresses

| Link | Opens |
|---|---|
| `learn.html` | Home: seven topic cards, the Lexikon card and the worksheet card |
| `#pid` `#encoder` `#pwm` `#ultraschall` `#floodfill` `#gyro` `#variablen` | One explainer |
| `print/index.html` | The worksheets (rail tab „Arbeitsblätter“ and a home card) |
| `#lexikon` | The whole Lexikon |
| `#lexikon/hbruecke` | One word: scrolls to it and highlights it |
| `#lexikon/motor` | One category (`elek`, `motor`, `sens`, `regel`, `soft`, `algo`) |
| `?kp=3&kd=0#pid` | PID opens with these numbers (`ki` too). Handy for worksheets |
| `?lang=en` | English for this visit (the button stores the choice) |
| `?motion=reduce` | The reduced-motion version, as with the system setting |
| `?selftest=1` | Runs the self-test (see below) |
| `?demo=<s>` | Fast-forwards the open explainer, for screenshots |

The language is stored in `localStorage` (key `ratrocket.learn`). Without a
stored choice the page takes the editor's language (`ratrocket.code`).

## The explainers

Every explainer has the same frame (`topicShell` in `learn.js`): title and a
two-line lead, a dark stage, controls on the right, a status line, "Merk dir",
"Probier's am Roboter" (real console commands from `firmware.md`, editor
features not built yet are marked "kommt bald"), links into the Lexikon and
the next topic. Each simulation runs at a fixed time step, so the behaviour is
a consequence of the numbers, not a clip.

| Topic | Model |
|---|---|
| PID | The firmware's own lane-keeping law (`maze_run.c`): sensor sample every 50 ms, filtered D, steer clamped to 25 mm/s, 80 mm/s, track 96 mm, 160 mm corridor, 0.12 s wheel lag, left motor 6 mm/s stronger. Too little P drifts into the wall, P without D zigzags wall to wall, P 1.5 / D 1.0 settles. The I slider (Profi) removes the last 2 mm. The bridge shows the matching `KC p d`. |
| Encoder | 2874 pulses per wheel turn, wheel 34 mm (`firmware.md`): 26.9 pulses per mm, 4305 per 160 mm cell. The wheel carries all 2874 tick marks; a 20× magnifier shows them one by one. |
| PWM | Switch at 1 Hz or 1000 Hz; winding current lags 2 ms, the wheel has inertia and Coulomb friction, which gives the real dead band (about 25 %). Scope with IN1/IN2: the pulsing input sets the direction, as on the DRV8833. |
| Ultraschall | 343 m/s, half the round trip, slowed 250×. Firmware limits: echo timeout 30 ms, nothing beyond 2 m (`ultrasonic.c`). A slanted wall reflects the ±15° beam away: no echo. |
| Flood-Fill | 5×5 maze, goal in the middle, robot coordinates. Breadth-first flood from the goal, step by step; the robot walks downhill. "Neue Mauer" closes an edge on the planned way (never cutting a cell off) and floods again. Lines can be clicked to toggle walls. |
| Gyroskop | The MPU6050 on header H2 (`hardware.md`): at rest it read about −240 raw on the vertical axis = −1.8 °/s. Real turn rate follows the command with a 0.05 s lag; the gyro reads rate + bias + ±0.3 °/s noise; 500 times a second (rate − calibrated bias) × 0.002 s is added up. Rate needle, heading dial with the computed (gold) and the real (dashed) hand, error curve over 60 s. "Kalibrieren" averages 1 s at rest (refused while turning); "90° rechts/links" stops on the computed angle (≈ 5° too far uncalibrated); "Drift-Demo" stands still in 10× time-lapse; "1 Minute warten" shows −108°. Bridge: connected, IMU answers, gyro turns "Regelung in Arbeit" — only `IMU` is named, as in `firmware.md`. |
| Variablen | The editor's blocks, run step by step in an 8-cell corridor with the editor's watch panel (gold = changed last, „Gezeigt“ log). Part 1: `setze`, three × (`fahre 1 Feld`, `ändere … um 1`), `zeige`. Part 2: `wiederhole bis Schritte = 5` with the sign (=, >, <), the number and the `ändere` step editable inside the block. Checks before every round, as `code.js`: `< 5` never runs, `um 2` never hits 5 and drives into the wall ("Autsch"). |

With reduced motion nothing moves: each explainer shows its final state at
once (PID draws the whole 15 s run), "Abspielen"/"Pause" are disabled and the
step buttons advance by hand.

## Adding an explainer

1. Add the topic to `TOPICS` in `learn-data.js` (`id`, `tag`, `title`, `sub`,
   `lex`) and its texts to both `TEXT.de` and `TEXT.en`.
2. Write `viewXyz(main, tp)` in `learn.js`: call `topicShell` with `lead`,
   `main`, `side`, `merk`, `tryItems()` and optionally `bridge()`. Return
   `{ kind: 'topic', id, frame(dt), relabel(), demo(s), api }`.
3. Register it in `VIEWS`, add a teaser to `VIG`, add checks to `selftest()`.

## Adding a Lexikon entry

One object in `LEX` (`learn-data.js`):

```js
{
  id: 'relais', cat: 'elek',                     // id = link #lexikon/relais
  term:  { de: 'Relais', en: 'Relay' },
  alias: 'Schalter switch',                      // extra search words (optional)
  text:  { de: '1-3 kurze Saetze.', en: '1-3 short sentences.' },
  where: { de: 'Wo am Roboter? Nur echte Fakten aus docs/.', en: '...' },
  links: ['taster', 'highlow'],                  // other entry ids
  topic: 'pwm',                                  // optional: full explainer
  status: 'planned',                             // optional badge: 'planned' = geplant,
                                                 //   'wip' = in Arbeit, 'connected' = angeschlossen · Regelung in Arbeit
  act: 'hbridge',                                // optional: micro-interaction in learn.js (ACTS)
  fig: (L) => '<rect x="10" y="10" width="40" height="30" class="rf"/>',
}
```

- `fig(L)` returns the inside of an SVG with `viewBox="0 0 200 110"`; `L` is
  `'de'` or `'en'` for labels. Use the classes in `learn.css`: `k`/`k1` ink
  lines, `r`/`rf` board red, `g`/`gf` gold, `b`/`bf` blue, `gr`/`grf` green,
  `mf`/`wf`/`df` light, white, dark fills, `tb`/`ts`/`tw` text. A
  `stroke-width` attribute works (the default width is inherited).
- Animations are classes too (`a-spin`, `a-flow`, `a-ping`, `a-march`,
  `a-tour`, `a-blink`, …); they stop with reduced motion.
- `#bot` draws the robot: `<use href="#bot" transform="translate(x y) rotate(90) scale(.3)"/>`.
- A micro-interaction is a function in `ACTS` (`learn.js`) that gets the
  card, the figure, an empty controls row and an output line. There are nine:
  `hbridge`, `dip`, `led`, `press`, `dead`, `cmd`, `var` (setze/ändere/zeige
  on one note), `uf2` (UPDATE → RATROCKET drive → copy `ratrocket.uf2`) and
  `dpad` (the drive.html D-pad: `FWD 160`, `TURN ±90`, `STOP`).
- New in November 2026: Variable (now interactive), Liste (geplant),
  Funktion / „Mein Baustein“ (in Arbeit), Karte (Gedächtnis), DIP-Schalter:
  die Modi (table from `DIPMODES`, the five rows of `firmware.md`), Bootloader
  & UF2 (interactive), Fernsteuerung; Gyroskop & IMU went from „geplant“ to
  „angeschlossen · Regelung in Arbeit“.
- Figures are drawn when a card scrolls near the screen.

Then run the self-test: it checks that every entry has both languages, a
figure and valid links.

## Worksheets (`web/print/`)

Print-ready A4 pages, one HTML file per sheet, shared `print.css` (A4, 14/14/16 mm
margins, a page break per `<section class="sheet-page">`, black-and-white,
system fonts) and `print.js` (print button). `print/index.html` lists them by
module; the mapping sheet → lesson is in `docs/curriculum/anhang-arbeitsblaetter.md`.

`print.js` reports to a parent frame, which the self-test uses:
`{ rrPrint: 'index', links: [...] }` from the index (every `a.sheet-link`) and
`{ rrPrint: 'sheet', file, title, pages }` from each sheet.

## Self-test

```
msedge --headless=new --disable-gpu --user-data-dir=<fresh profile> --virtual-time-budget=30000 --dump-dom "file:///W:/FreelanceProjects/Micromouse/web/learn.html?selftest=1"
```

The title becomes `SELFTEST PASS (n checks)` or `SELFTEST FAIL <ids>`; the
details are in `<pre id="selftest">`. It opens every view and checks: the
controls exist; PID "zu schwach" hits the wall, "zu zackig" hits both walls,
"genau richtig" settles within 4 mm, the curve changes with P, I removes the
offset; 1 Feld = exactly 4305 pulses; PWM 50 % gives a third of full speed,
20 % stands still, the direction follows the pulsing input, 1 Hz jerks; echo
at 30 cm after 1.749 ms, no echo from a slanted or missing wall, "zu weit"
beyond 2 m; the flood reaches all 25 cells, the robot walks the shortest way,
a new wall changes the plan; all 49 Lexikon entries render in both languages
with valid links; search (German, English, `loeten` for "Löten"); the
H-bridge truth table of the DRV8833 (`hardware.md`: IN1/IN2 = 10 clockwise,
01 anticlockwise, 00 coast, 11 brake, never both switches of one leg closed);
deep links to a word and to a category; the language switch; Fredoka from
`web/fonts` and no external request. It never writes to `localStorage`.

Gyroskop: the needle follows the rate (incl. bias); standing still 30 s
uncalibrated drifts −54°; calibration is refused while turning, then finds
−1.8 °/s and the error stays under 0.5° for 30 s; a calibrated 90° turn ends
within 0.5°, an uncalibrated one turns more than 92°; one minute of waiting
drifts −108°. Variablen: the block texts equal the editor's (`code-data.js`);
the watch panel marks the changed variable; part 1 ends with Schritte = 3 and
„Gezeigt Schritte: 3“; `= 5` drives 5 cells with 6 checks, `> 3` drives 4,
`< 5` none, `um 2` hits the wall; the sign and number inside the block work.
New Lexikon words exist in both languages with a figure; the IMU card says
„angeschlossen“; the DIP table matches `firmware.md`; Variable, UF2 and
Fernsteuerung react to clicks. Worksheets: the index (in a hidden frame) lists
≥ 10 sheets and every link opens a sheet that reports 1–2 pages.

Last run (2026-11-11): **PASS (72 checks)**, also with `&motion=reduce` and `&lang=en`.

Headless browsers may not run `requestAnimationFrame`; the page then drives
its animation from a timer while it is visible.
