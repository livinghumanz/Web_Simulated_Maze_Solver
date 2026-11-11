# RatRocket Werkstatt (`web/werkstatt.html`)

The workshop page for curriculum module 6 (lessons 11 and 12, plus lesson P3,
see `curriculum/modul-6-werkstatt.md`): pulses and PWM with sliders, PID first
by feel and then by name, and the calibration of distance, straightness,
turning and centring. It replaces the typing in the English command field of
`maze_event.html` for these lessons.

Open it in **Chrome or Edge** (Web Serial), offline from `file://`, and click
**Roboter verbinden** (USB-C or the HC-05 "RatRocket", 9600 baud). German
first; **English** switches the language (shared with RatRocket Code).

| File | Contents |
|---|---|
| `web/werkstatt.html` | Page: rail, three workshop tabs, panels |
| `web/werkstatt.css` | Workshop styles; tokens, buttons, tips and the Fredoka font come from `code.css` (linked, not copied) |
| `web/werkstatt-data.js` | All texts, German and English (`TEXT.de`, `TEXT.en`) |
| `web/werkstatt.js` | Serial link, command runner, the three workshops, charts, stand-in robot, self-test, demo |

URL options: `?selftest=1`, `?demo=motor|pid|cal` (fills a workshop from the
stand-in robot, for screenshots), `?lang=en`, `?motion=reduce`, and the hash
`#motor`, `#pid`, `#cal` opens a tab directly.

## What the page does

**Three tabs, one per firmware mode.** Each starts with a "Roboter-Modus"
strip: a drawing of the DIP block with the switches the workshop needs
(switch 4 greyed, it is unused), the sentence to read ("Nur Schalter 2 an.
Dann Reset."), and a chip that says whether the robot is in that mode. The tab
whose mode the robot is in gets a green dot. In the wrong mode every control
refuses with a friendly hint naming the mode the robot is in and the switches
to set, and the strip flashes.

1. **Motoren & Pulse** (motor-test mode, SW2; wheels lifted)
   - Per wheel: a wheel drawn as seen from outside with a flag that turns with
     the encoder count, the pulse count in big digits, pulses per second, and
     a duty slider −1010…1010 with a curved arrow and "vorwärts · gegen den
     Uhrzeigersinn" etc. Forward is anticlockwise on the left wheel and
     clockwise on the right one (the curriculum's mirror puzzle).
   - **Dreh!** press and hold: the wheels turn while held (at most 10 s).
     **2 Sekunden** for a timed run, **Zähler auf 0**.
   - **Pulse pro Umdrehung**: pick a wheel and 1000/3000/6000 pulses, **Los!**
     turns it by that many pulses, the child enters the counted turns (whole
     turns plus ¼, ½, ¾ "bis 3/6/9 Uhr"), the page divides; each try goes into
     a table with mean and spread.
   - **Tastgrad-Kurve**: SWEEP drawn live, one point per wheel per duty step,
     with the "steht still" band up to the last duty at which a wheel did not
     turn, a sentence naming both start thresholds, a hatched mark on the duty
     sliders for the same zone, the previous sweep as a ghost, and a table
     view.
2. **PID** (PID-test mode, SW1 + SW2; wheels lifted)
   - **Fahr 30 cm!** plots the telemetry live: *Tempo* (plan against measured
     speed), *Weg* (planned against measured distance, from the speed plan and
     the position error) and *Fehler* (pulses behind the plan). The previous
     run stays as a ghost; a table lists the last runs with their knob values,
     final and largest error.
   - Step 1 "nach Gefühl": three knobs **A, B, C** (they are Kp, Ki, Kd, but
     nothing on the page says so). Presets **zu weich**, **zackig**,
     **Werkseinstellung**. Step 2: **Namen verraten** names them Kp/Ki/Kd
     with "Gegenwart / Vergangenheit / Zukunft" and shows the two further
     gains the firmware exposes (KFF feed-forward, KS start boost).
3. **Kalibrieren** (maze mode, SW3; on the floor)
   - Four wizards with numbered steps: **Strecke** (CALDIST), **Geradeaus**
     (TRIM), **Drehen** (TRACK), **Mitte** (CALSPIN, CENTER, CELL, KC). Each
     shows its arithmetic before applying, checks the value in the robot's
     CFG reply after applying, uses a measurement only once (drive again to
     re-check), and ends with **Speichern** → a confirmation ("Hast du deine
     Lehrkraft gefragt?") → SAVE → "Gespeichert ✓" with the CFG lines, the
     changed one highlighted.
   - A side panel shows what the robot uses now (scale, trim, track, KC) and
     the raw CFG block.

**Always:** a big round **STOPP** (bottom right, also Escape) that is never
locked; a "Mitschrift" with the robot's lines (folded away, so it does not
give away the knob names). Info icons carry the explanations; the page has no
paragraphs of text.

### How the page finds the mode

The firmware prints `Mode: …` only in its boot banner, which is gone by the
time a browser connects (nothing is buffered while no host is connected). So
the page sends `HELP` after connecting and reads the first help line:
`Motor test commands` → motor test, `PID test commands` → PID test,
`Maze mode commands` → maze, `Commands:` → Bluetooth test. No answer at all
means web-sim mode (all switches off, no console) or no robot. A banner that
arrives later (reset while Bluetooth stays connected) switches the mode at
once (`Mode: MOTOR_TEST …`, etc.). A `? unknown` reply makes the page check
the mode again.

### How a command is sent

One command at a time. Every console prints `> CMD` before it acts, so the
page waits for that echo (2.5 s) and then for the command's own reply (time
per command, below). No echo or no reply: "Der Roboter antwortet nicht (CMD)"
and the controls unlock. `busy - ignored` / `[BUSY] ignored`: "noch
beschäftigt". All replies are matched against the strings in
`Core/Src/app_motor_test.c`, `app_pid_test.c` and `app_maze.c`.

**STOP** goes out at once, whatever is pending, and is sent again (up to 3
times, 0.7 s apart) until `> STOP` comes back: the firmware keeps only one
unread line (`bt_log.c`, `feed_rx_char`), so a second line arriving within the
~10 ms before the first is read is lost. For the same reason, releasing
**Dreh!** sends STOP right after the robot's echo of the PWM line, or at the
latest 150 ms after PWM went out, never in the same instant. If a stopped
command stays silent (e.g. `CENTER` after an aborted spin), the page frees
itself 2 s after the STOP echo. Leaving the page or the window while holding
**Dreh!** also stops.

## Command mapping

Times: echo timeout first, then the reply timeout.

| Control | Sends | Waits for | Timeout |
|---|---|---|---|
| connect, **Prüfen** | `HELP` | first help line (mode) | 3 s |
| **STOPP**, Escape | `STOP` | `> STOP` (re-sent) | 3 × 0.7 s |
| **Motor test** | | | |
| **Dreh!** pressed | `PWM <l> <r> 10000` | `PWM done\|aborted: moved L=… R=… counts`; the `[T]` lines (5/s) drive the counters while it runs | 2.5 s + 13 s |
| **Dreh!** released | `STOP` | `> STOP`, then the PWM line above | see STOP |
| **2 Sekunden** | `PWM <l> <r> 2000` | as above | 2.5 s + 5 s |
| **Zähler auf 0** | `ENC0` | `ENC: reset` | 2.5 s + 3 s |
| live counter (idle, motor tab open, every 300 ms) | `ENC` | `ENC: L=… R=…` (also read from `[HB]` and `[T]`) | 1.5 s + 1.5 s |
| **Los!** (pulses per turn) | `JOG L\|R 1000\|3000\|6000` | `JOG result: L moved …, R moved … counts` | 2.5 s + 25 s |
| **Kurve messen** | `SWEEP` | rows `duty  Lcps  Rcps` (live), `SWEEP done\|aborted` | 2.5 s + 20 s |
| **PID test** | | | |
| mode found / tab opened | `GAINS` | `GAINS: KP=… KI=… KD=… KFF=… KS=…` | 2.5 s + 3 s |
| knob A, B, C | `KP x`, `KI x`, `KD x` | `GAINS: …` (sliders follow the reply) | 2.5 s + 3 s |
| KFF, KS (after the reveal) | `KFF x`, `KS x` | `GAINS: …` | 2.5 s + 3 s |
| **zu weich** | `KP 1`, `KI 0`, `KD 0` | `GAINS: …` each | |
| **zackig** | `KP 9`, `KI 18`, `KD 0.3` | | |
| **Werkseinstellung** | `KP 3`, `KI 6`, `KD 0.05`, `KFF 0.14`, `KS 130` | | |
| **Fahr 30 cm!** | `TEL 100`, then `FWD 300` | `telemetry every 100 ms`; `[P] t vt v e d` samples; `[EV] DONE … final err L=… R=…` / `STOPPED` / `ABORT` | 2.5 s + 3 s; 2.5 s + 15 s |
| **Maze** | | | |
| tab opened, **Neu lesen**, after SAVE | `CFG` | CFG block, ends with `centring KC p=…` | 2.5 s + 3 s |
| Strecke **Fahr!** | `FWD 200\|300\|500` | `FWD done (event n)`: 2 arrived, 3 stopped, 4 blocked | 2.5 s + 25 s |
| Strecke **Übernehmen** | `CALDIST <commanded> <measured>` | CFG; `distance scale` must equal old × commanded ÷ measured | 2.5 s + 4 s |
| Geradeaus **Fahr!** | `FWD 500\|800` | `FWD done (event n)` | 2.5 s + 25 s |
| Geradeaus **Übernehmen** | `TRIM <old ± 200·offset·track/distance²>` (+ when it ended left of the line) | CFG; `trim` checked | 2.5 s + 4 s |
| Drehen **Rechtsherum / Linksherum** | `TURN 360`, `TURN -360` | `TURN done (event n)` | 2.5 s + 30 s |
| Drehen **Übernehmen** | `TRACK <old · 360 ÷ (360 + mean error)>` | CFG; `track` checked | 2.5 s + 4 s |
| Mitte **Mitte lernen** | `CALSPIN` | `CALSPIN ok: centred L=… R=…`, `CALSPIN: robot is … of centre` / `CALSPIN failed` | 2.5 s + 30 s |
| Mitte **In die Mitte** | `CENTER` | `CENTER done: …` / `CENTER: already centred` / `no side wall` / `offset too large` | 2.5 s + 30 s |
| Mitte **Ein Feld** | `CELL` | `CELL done\|failed` | 2.5 s + 30 s |
| Mitte **Übernehmen** | `KC <p> <d>`: weaves → p × 0.8, d × 1.25; drifts → p × 1.25 | CFG; `centring KC` checked | 2.5 s + 4 s |
| **Speichern** → **Ja, speichern** | `SAVE`, then `CFG` | `SAVE ok …` / `SAVE FAILED` / `SAVE: robot is moving` | 2.5 s + 8 s |

### Decisions behind the mapping

- **Live counter while the wheels turn comes from `[T]`, not from `ENC`.** The
  motor-test console ignores everything but STOP while a motor command runs
  (`busy - ignored`), so polling ENC then would only produce noise. `ENC` is
  polled only while nothing runs (to watch a wheel turned by hand); polls are
  not written to the Mitschrift. JOG and SWEEP print no `[T]` lines, so the
  counter jumps at their end.
- **Hold to spin = `PWM l r 10000` + `STOP` on release**, because a running
  PWM cannot be changed or extended. The 10 s limit of the firmware is the
  safety net if STOP never arrives.
- **Pulses per turn uses `JOG`** (the curriculum's `JOG L 1000`); `CAL` (three
  twitches first) is not used.
- **Turning is calibrated with `TRACK` only.** `TRIM` changes the two wheels
  in opposite directions and hardly changes a spin, and the firmware has no
  per-direction turn setting, so the wizard uses the mean of the clockwise and
  anticlockwise errors and warns when they differ by 5° or more.
- **Wizard values are checked in the CFG reply**, with the precision CFG
  prints (scale in % with two decimals). After applying, the measurement is
  used up: the child drives again before the next correction.
- **CFG is read up to its `centring KC` line**; indented lines after it (the
  `imu …` line of newer firmware) are shown in the panel but not needed.
  `TURN done (event n) …` is matched by its prefix, so the longer gyro report
  of newer firmware still works.
- **TEL 100** (10 samples a second), not faster: a `[P]` line is ~55 bytes,
  so 100 ms already uses about half of the 9600-baud Bluetooth link.
- **SAVE has a confirmation step** that asks for the teacher (the curriculum
  forbids pupils to type SAVE). `DEFAULTS` is not offered.

## Self-test

```
msedge --headless=new --disable-gpu --user-data-dir=<fresh profile> --virtual-time-budget=60000 --dump-dom "file:///W:/FreelanceProjects/Micromouse/web/werkstatt.html?selftest=1"
```

The title becomes `SELFTEST PASS (n checks)` or `SELFTEST FAIL <ids>`; the
details are in the `<pre id="selftest">` overlay. It never opens a serial port
and never writes `localStorage`: a stand-in robot (`FakeBot` in
`werkstatt.js`) answers with the firmware's reply strings, with a start
threshold per wheel (left 300, right 200), a PID move that lags more with a
small Kp and rings with a big Ki, blocking maze moves, the CFG block after
every setting, and the one-line buffer (a STOP right behind the previous line
is dropped). It checks:

- **mode gating**: HELP finds the mode; the strips and the tab dot; in the
  wrong mode Dreh!, 2 Sekunden, Zähler auf 0, Los!, Kurve messen and the
  calibration send nothing and show the hint; a boot banner switches the mode;
  a `? unknown` reply makes the page check again;
- **every control's exact command**: `PWM 500 -450 10000` + `STOP`,
  `PWM 500 -450 2000`, `ENC0`, `JOG R 3000`, `JOG L 6000`, `SWEEP`, `ENC`
  polling, `KP 4.5`, `KI 12`, `KD 0.1`, `KFF 0.2`, the three presets,
  `TEL 100` + `FWD 300`, `FWD 300`, `CALDIST 300 262`, `SAVE` + `CFG`,
  `FWD 500`, `TRIM 0.77`, `TURN 360`, `TURN -360`, `TRACK 93.9`, `CALSPIN`,
  `CENTER`, `CELL`, `KC 1.2 0.63`;
- **charts**: the counters follow the `[T]` lines; the sweep chart grows one
  row at a time (9 points per wheel), the dead band ends at 300, the note
  names 300 and 200, slider marks, table, ghost of the previous sweep; the
  PID chart has one point per `[P]` line, the distance view ends at 300 mm,
  the error view has its zero line, the ghost appears and "zu weich" ends
  with a larger error than "Werkseinstellung";
- **wizard arithmetic**: 100 % × 300 ÷ 262 = 114,50 %; out-of-range
  measurements refused; trim 0,77 % for 10 mm left over 500 mm with a 96 mm
  track (and −0,77 % to the right); track 96 × 360 ÷ 368 = 93,9 mm; the
  asymmetry warning; KC weaving 1,5/0,5 → 1,2/0,63, drifting → 1,88/0,5; a
  measurement is applied only once; SAVE asks first and shows the CFG line;
- **timeouts and STOP**: a silent robot and a robot that echoes but never
  finishes give "antwortet nicht" and unlock; STOP is live and sent at once
  during a command and ends it; a dropped STOP is sent again; a quick tap on
  Dreh! still gets its STOP through;
- language switch and key parity, the Fredoka font from `web/fonts`, no
  external files, and with `&motion=reduce` that the wheel does not animate.

Last run (2026-11-11): **PASS (69 checks)**, also with `&lang=en` (69) and
`&motion=reduce` (70).

Screenshots: `?demo=motor`, `?demo=pid`, `?demo=cal` play a short scripted
session against the stand-in robot (the rail says "Demo-Roboter (kein
echter)"). Take each in its own fresh headless browser: a reused headless page
can be throttled, and the stand-in robot then runs slower than the page's
timeouts.

## First session with the real robot: manual test checklist

Wheels lifted for parts A–C; a ruler, a tape line, the angle disc and a
corridor of maze walls for D. Keep the Mitschrift open to compare with what
the robot prints.

**A. Connection and mode**

- [ ] Motor test (only SW2 on, reset). Connect over USB-C: the Motoren strip
      says "passt ✓", tab 1 has the green dot, the other strips name
      "Motor-Test".
- [ ] Same over Bluetooth (RatRocket). Press reset while connected: the
      banner arrives and the chip stays right without reconnecting.
- [ ] The DIP drawing matches the real switch block (which way is ON).
- [ ] All switches off (simulator): "antwortet nicht" with the simulator hint.
- [ ] PID mode and maze mode are recognised the same way.

**B. Motoren & Pulse**

- [ ] Turn each wheel by hand: its counter changes about 3 times a second;
      forward gives positive counts; the drawn wheel and its flag turn the way
      the real wheel does seen from outside.
- [ ] Duty 400 left, hold **Dreh!** ~2 s: the wheel turns, the counter runs
      live, release stops within ~0.3 s, the status names the pulses moved.
- [ ] The arrow is right: left positive = anticlockwise seen from the left
      side, right positive = clockwise seen from the right side; negative
      reverses (both wheels can reverse since 2026-11-07).
- [ ] A quick tap on **Dreh!**: at most a twitch, message "Halte … gedrückt",
      nothing keeps running. Holding and switching to another window stops.
- [ ] **2 Sekunden**, **Zähler auf 0**.
- [ ] Below the start threshold (e.g. 150) nothing turns, and the page does
      not call it an error.
- [ ] **Los!** with 3000 on each wheel, count the turns, enter them: the
      result should be near the 2874 pulses per turn of `motion.h` (or near
      2500, the eye-count puzzle of the curriculum).
- [ ] **Kurve messen**: one point about every second, nine per wheel, the
      numbers equal the robot's table in the Mitschrift; the "steht still"
      band and the slider marks sit at the last duty where a wheel stood.
- [ ] **STOPP** during the sweep: "Messung abgebrochen", page unlocks.
- [ ] Bluetooth: no "antwortet nicht" while idle (ENC polling), and `STAT`
      (typed in another page) shows no dropped lines after a long hold.

**C. PID**

- [ ] After connecting, the knobs show 3 / 6 / 0,05; the page shows A/B/C and
      no Kp/Ki/Kd anywhere until **Namen verraten**.
- [ ] Each knob sends its value and the robot's GAINS line puts the slider
      where the robot says.
- [ ] **Fahr 30 cm!**: the chart grows about 10 times a second, ends with
      "Fertig", the end error equals the robot's `[EV] DONE … final err`.
- [ ] **zu weich** / **zackig** / **Werkseinstellung** each send their values;
      runs with them look and sound different, the table keeps them.
- [ ] **STOPP** during the run: `[EV] STOPPED`, page unlocks.
- [ ] A wheel touching the block: `[EV] ABORT following error` gives the
      "blockiert?" message.

**D. Kalibrieren** (maze mode, on the floor; note the saved values first,
the CFG panel shows them)

- [ ] The CFG panel fills when the tab opens.
- [ ] Strecke: 30 cm along the ruler, measure, the calculation shows old
      scale × 300 ÷ measured, **Übernehmen** gives the same number in CFG;
      a second drive lands closer to 300 mm.
- [ ] Geradeaus: 50 cm along the tape, offset and side, **Übernehmen**; the
      next run drifts less. Check the sign once: ending left of the line must
      give a positive change.
- [ ] Drehen: both full turns on the angle disc, errors entered, new track
      width in CFG; turns after that are closer to 360°.
- [ ] Mitte: **Mitte lernen** in a corridor (two spins), **In die Mitte**,
      **Ein Feld**, the observation and **Übernehmen** change KC in CFG.
- [ ] **Speichern** asks first, the robot freezes ~2 s, "Gespeichert ✓" and the
      CFG lines appear; after power off/on the banner says "Settings: loaded
      from flash" and CFG has the new values.
- [ ] **STOPP** during FWD, TURN and CELL stops the robot and unlocks the page.
- [ ] If the class must not keep the new values, restore them (type the old
      values, or `DEFAULTS` in `maze_event.html`, then SAVE).

**E. Page**

- [ ] English switch on every tab; a phone or tablet (where the browser
      offers Web Serial): tabs stack, STOPP stays reachable.

## What the firmware could add for a better workshop

Not implemented; ideas from building the page.

1. **A `MODE` command in every mode** (and a console in web-sim mode) that
   answers `Mode: …`. Today the page has to read the first line of HELP.
2. **A small receive queue instead of one unread line**, and STOP handled
   while a line is still waiting (or a single-byte emergency stop). Today a
   second line within ~10 ms is lost; the page works around it with STOP
   retries and spacing.
3. **A dead-man PWM for hold-to-run**: e.g. `PWM l r` that stops by itself
   unless repeated every ~300 ms. If Bluetooth drops while **Dreh!** is held,
   the wheels now run up to the 10 s limit.
4. **`[T]` lines during `JOG` and `SWEEP`** (or accept `ENC` while running), so
   the counter also runs live there.
5. **A configurable sweep**: `SWEEP <from> <to> <step>`, steps below 200 and
   a reverse sweep (both wheels reverse since 2026-11-07), so the start
   threshold is found more precisely and in both directions.
6. **Turn calibration per direction** (e.g. separate track widths or a turn
   trim for clockwise and anticlockwise); `TRACK` can only fix the mean, and
   left turns are known to run 1–2° over.
7. **A one-line, full-precision settings reply** (e.g. `CFG1 scale=1.14504
   trim=0.77 track=93.9 kcp=1.2 kcd=0.63`) next to the human CFG block, so
   wizards can verify without parsing six lines with rounded values.
8. **A confirmation line for every setting command** (`CALDIST ok: scale …`,
   `TRIM ok`, …) instead of only the CFG block, and `stopped` for STOP in the
   PID test like the other modes.
9. **A PID run summary** in `[EV] DONE` (overshoot, settle time, largest
   error), which the page now computes from the samples.

### Console replay on the robot (2026-11-11)

Before the first browser session, the motor-tab command sequence was replayed
over the USB console with the robot elevated in motor-test mode. Every reply
matched the mapping table: `ENC: reset`, `ENC: L=0 R=0`, `[T]` lines five
times a second during `PWM 450 0 2000` then `PWM done: moved L=3807 R=0
counts`, `PWM aborted: moved ...` after `STOP` during a held run,
`JOG result: L moved 3085, R moved 0 counts (target 3000, incl. overshoot)`,
and the SWEEP table (200 -> 0, 300 -> 930/930, ... 1010 -> 4134/3874 cps)
ending in `SWEEP done`. Observation worth teaching: `PWM 0 -300` did not
start the right wheel backwards (0 pulses) while +300 forward runs - the
start threshold differs by direction. Still to confirm by eye in the
browser: DIP drawing ON direction, wheel arrow directions; Kalibrieren tab not yet replayed (needs SW3 and the floor).

PID tab replayed the same way in PID-test mode (SW1+SW2): `GAINS:` reply,
each of `KP/KI/KD/KFF/KS` answered with the full `GAINS:` line (presets
"zu weich" and "Werkseinstellung" applied), `TEL 100` -> `telemetry every
100 ms`, `FWD 300` -> `[EV] START`, 36 `[P] t vt v e d` samples, `[EV] DONE
t=3608ms dist=300.000mm final err L=-12 R=-16 counts`. All as mapped.
