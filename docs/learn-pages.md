# RatRocket Lernen — concept explainers and Lexikon

`web/learn.html` explains how the robot works, for pupils of about 10–16. It
has five interactive explainers and a Lexikon of 44 words. German first,
English one click away. It works offline from `file://` in Chrome or Edge:
no server, no CDN, SVG and plain JavaScript only.

## Files

| File | Holds |
|---|---|
| `web/learn.html` | Page frame: top rail, robot sprite (`#bot`), view container |
| `web/learn.css` | All styling. Tokens copied from `code.css`; Fredoka is referenced from `web/fonts`, not copied |
| `web/learn-data.js` | All texts (`TEXT.de` / `TEXT.en`), the five topics, the Lexikon categories and entries |
| `web/learn.js` | Router, the five simulations, home cards, Lexikon, micro-interactions, self-test |

The JS files are plain ASCII. Umlauts and symbols are `\u` escapes (`'Gr\u00f6\u00dfe'`).

## Addresses

| Link | Opens |
|---|---|
| `learn.html` | Home: five topic cards and the Lexikon card |
| `#pid` `#encoder` `#pwm` `#ultraschall` `#floodfill` | One explainer |
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
  status: 'planned',                             // optional: "geplant" badge
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
  card, the figure, an empty controls row and an output line.
- Figures are drawn when a card scrolls near the screen.

Then run the self-test: it checks that every entry has both languages, a
figure and valid links.

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
a new wall changes the plan; all 44 Lexikon entries render in both languages
with valid links; search (German, English, `loeten` for "Löten"); the
H-bridge truth table of the DRV8833 (`hardware.md`: IN1/IN2 = 10 clockwise,
01 anticlockwise, 00 coast, 11 brake, never both switches of one leg closed);
deep links to a word and to a category; the language switch; Fredoka from
`web/fonts` and no external request. It never writes to `localStorage`.

Last run (2026-11-11): **PASS (47 checks)**, also with `&motion=reduce` and `&lang=en`.

Headless browsers may not run `requestAnimationFrame`; the page then drives
its animation from a timer while it is visible.
