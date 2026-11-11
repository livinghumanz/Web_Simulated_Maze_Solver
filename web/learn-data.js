/*
 * RatRocket Lernen - texts, topics and the Lexikon.
 *
 * Data only: learn.js turns this into the pages. Plain ASCII: umlauts and
 * symbols are \u escapes, so no editor or shell can garble them.
 *
 * A Lexikon entry is one object in LEX (see docs/learn-pages.md):
 *   id     short ascii id, used in the link #lexikon/<id>
 *   cat    one of the CATS ids
 *   term   { de, en }          the word
 *   text   { de, en }          1-3 short sentences, kid tone
 *   where  { de, en }          "Wo am Roboter?" - real facts from docs/
 *   links  [ids]               related entries
 *   topic  'pid'               (optional) the full explainer for this word
 *   status 'planned'           (optional) not on the robot yet
 *   act    'hbridge'           (optional) micro-interaction in learn.js
 *   alias  'words for search'  (optional)
 *   fig    function (L) -> SVG body for viewBox 0 0 200 110, L = 'de'|'en'
 */
(function (root) {
  'use strict';

  const tr = (L, de, en) => (L === 'en' ? en : de);
  const dc = (L, s) => (L === 'en' ? s.replace(/(\d),(\d)/g, '$1.$2') : s);

  /* ---------------- texts ---------------- */
  const TEXT = {
    de: {
      title: 'RatRocket Lernen',
      tagline: 'So funktioniert dein Roboter',
      lang: 'English',
      navTopics: 'Themen',
      navLex: 'Lexikon',
      toEditor: 'Zum Editor',
      homeTitle: 'Wie funktioniert dein Roboter?',
      homeLead: 'F\u00fcnf Experimente zum Ausprobieren. Schieb, klick und schau, was passiert.',
      go: 'Ausprobieren',
      lexCardTitle: 'Lexikon',
      lexCardSub: '{n} Begriffe von Strom bis Flood-Fill. Jeder mit Bild.',
      lexCardGo: 'Nachschlagen',
      back: 'Alle Themen',
      next: 'N\u00e4chstes Thema',
      tryTitle: 'Probier\u2019s am Roboter',
      soon: 'kommt bald',
      inEditor: 'Im Editor:',
      merk: 'Merk dir',
      inLex: 'Im Lexikon',
      play: 'Abspielen',
      pause: 'Pause',
      resume: 'Weiter',
      again: 'Nochmal',
      step: 'Schritt',
      rmNote: 'Bewegung ist auf diesem Ger\u00e4t ausgeschaltet. Du siehst gleich das Ergebnis.',
      rmTip: 'Bewegung ist ausgeschaltet (Einstellung am Ger\u00e4t). Nutze die Schritt-Kn\u00f6pfe.',
      topicNo: 'Thema {n}',

      /* ---- PID ---- */
      pid_lead: 'Der Roboter soll in der Mitte des Gangs fahren. Doch ein Motor ist etwas st\u00e4rker. Ohne Lenken zieht er zur Wand.',
      pid_p: 'Wie stark lenkt er?',
      pid_pHint: 'P: Je weiter weg von der Mitte, desto st\u00e4rker lenkt er zur\u00fcck.',
      pid_d: 'Wie vorausschauend?',
      pid_dHint: 'D: Kommt er schnell auf die Mitte zu, lenkt er schon vorher weniger.',
      pid_iOpen: 'Profi: I dazunehmen',
      pid_i: 'Wie gut merkt er sich alte Fehler?',
      pid_iHint: 'I: Sammelt kleine Fehler auf und lenkt sie weg. Der echte Roboter lenkt im Gang nur mit P und D.',
      pid_presets: 'Probier diese Einstellungen:',
      pid_weak: 'zu schwach',
      pid_zig: 'zu zackig',
      pid_good: 'genau richtig',
      pid_push: 'Schubs!',
      pid_err: 'Abstand zur Mitte',
      pid_bumps: 'Wand ber\u00fchrt',
      pid_curve: 'Abstand zur Mitte \u00fcber die Zeit',
      pid_mid: 'Mitte',
      pid_wall: 'Wand',
      pid_prev: 'vorher',
      pid_now: 'jetzt',
      pid_left: 'links',
      pid_right: 'rechts',
      pid_ouch: 'Autsch!',
      pid_st_start: 'Er f\u00e4hrt los \u2026',
      pid_st_wall: 'Autsch! Er klebt an der Wand. Er lenkt zu schwach.',
      pid_st_zig: 'Zickzack! Er lenkt zu hart und schie\u00dft \u00fcber die Mitte.',
      pid_st_off: 'Er bleibt neben der Mitte. Etwas mehr P?',
      pid_st_settle: 'Er findet zur Mitte \u2026',
      pid_st_good: 'Ruhig in der Mitte. Genau richtig!',
      pid_bridge: 'Genau diese Zahlen stellst du sp\u00e4ter am echten Roboter ein (Kp, Kd).',
      pid_merk: 'P lenkt zur Mitte zur\u00fcck. D bremst das Lenken rechtzeitig. Zusammen f\u00e4hrt er ruhig.',
      pid_try1: 'Labyrinth-Modus (nur SW3 an): {cmd} stellt P und D ein. Dann {cell} in einem langen Gang.',
      pid_try2: 'Schlingert er? P kleiner oder D gr\u00f6\u00dfer. Zieht er zur Wand? P gr\u00f6\u00dfer. Ab Werk: {def}.',
      pid_trySoon: 'Regler zum Schieben',
      pid_tipStage: 'Hier wird echt gerechnet, kein Film: 80 mm/s, Spurbreite 96 mm, Gang 160 mm breit. Der linke Motor zieht etwas nach rechts.',
      pid_tipCurve: 'Oben hei\u00dft links von der Mitte, unten rechts. Die roten Linien sind die W\u00e4nde. Die blasse Linie ist deine letzte Fahrt.',

      /* ---- Encoder ---- */
      enc_lead: 'Am Motor sitzt ein Z\u00e4hler. Er z\u00e4hlt bei jeder Radumdrehung 2874 Pulse. So wei\u00df der Roboter genau, wie weit er gefahren ist.',
      enc_speed: 'Wie schnell dreht das Rad?',
      enc_perSec: '{n} Pulse pro Sekunde',
      enc_stopped: 'steht still',
      enc_zero: 'Z\u00e4hler auf 0',
      enc_turn: '1 Umdrehung',
      enc_cell: '1 Feld fahren',
      enc_pulses: 'Pulse',
      enc_turns: 'Umdrehungen',
      enc_dist: 'Strecke',
      enc_lens: 'Lupe: 20-mal gr\u00f6\u00dfer',
      enc_hint: 'Dreh am Tempo-Regler \u2013 oder lass das Rad genau 1 Feld fahren.',
      enc_sensor: 'Sensor',
      enc_way: 'Weg am Boden',
      enc_cellN: 'Feld {n}',
      enc_doneTurn: 'Genau 1 Umdrehung: {n} Pulse.',
      enc_doneCell: 'Genau 1 Feld: {n} Pulse = 160 mm!',
      enc_calc: 'Der Rechenweg',
      enc_c1: '1 Umdrehung = {ppr} Pulse',
      enc_c2: 'Radumfang = \u03c0 \u00d7 34 mm = {circ} mm',
      enc_c3: '1 mm = {ppr} \u00f7 {circ} = {ppmm} Pulse',
      enc_c4: '1 Feld = 160 mm \u00d7 {ppmm} = {cell} Pulse',
      enc_merk: 'Eine Umdrehung sind 2874 Pulse. Z\u00e4hlen statt sch\u00e4tzen: Darum trifft \u201e1 Feld\u201c genau.',
      enc_try1: 'Motor-Test (nur SW2 an): {enc0}, dann das Rad von Hand genau einmal drehen, dann {enc}.',
      enc_try2: 'Labyrinth-Modus (nur SW3 an): {cell} f\u00e4hrt genau ein Feld \u2013 der Baustein \u201efahre 1 Feld\u201c im Editor auch.',
      enc_trySoon: 'Live-Pulsz\u00e4hler',
      enc_tipTicks: 'Jeder Strich am Rad ist ein Puls. Es sind 2874 \u2013 so dicht, dass sie wie ein grauer Ring aussehen. Die Lupe zeigt sie einzeln.',
      enc_tipStory: 'Wahre Geschichte: Zuerst wurde mit dem Auge gez\u00e4hlt, etwa 2510. Dann fuhr der Roboter nur 262 statt 300 mm. Nachgerechnet: 2510 \u00d7 300 \u00f7 262 \u2248 2874.',

      /* ---- PWM ---- */
      pwm_lead: 'Ein Motor-Schalter kennt nur an und aus. Halbe Kraft? Dann schaltet man ganz schnell an und aus \u2013 1000-mal pro Sekunde.',
      pwm_duty: 'Wie lange an?',
      pwm_dutyHint: 'Tastgrad: wie viel von jedem Takt der Schalter an ist.',
      pwm_rate: 'Wie oft schalten?',
      pwm_slow: '1-mal pro Sekunde',
      pwm_fast: '1000-mal pro Sekunde',
      pwm_dir: 'Richtung',
      pwm_cw: 'im Uhrzeigersinn',
      pwm_ccw: 'gegen den Uhrzeigersinn',
      pwm_on: 'an',
      pwm_off: 'aus',
      pwm_scope: 'Oszilloskop: so sieht das Signal aus',
      pwm_avg: 'Mittelwert',
      pwm_wheel: 'Rad-Tempo',
      pwm_force: 'Kraft',
      pwm_blur: 'zu schnell f\u00fcrs Auge',
      pwm_cycle: 'Ein Takt',
      pwm_cmdL: 'Befehl am Roboter',
      pwm_tipWheel: 'Ein Teil der Kraft geht an die Reibung. Darum dreht das Rad langsamer, als die Kraft vermuten l\u00e4sst. Unter etwa 25 % steht es ganz.',
      pwm_st_dead: 'Das Rad steht: zu wenig Kraft gegen die Reibung (Totzone).',
      pwm_st_jerk: 'Ruck, ruck! So langsam geschaltet, ruckelt das Rad.',
      pwm_st_smooth: 'Ganz ruhig: 1000-mal pro Sekunde f\u00fchlt sich an wie {d} Kraft.',
      pwm_st_off: 'Immer aus: kein Strom, das Rad rollt aus.',
      pwm_st_full: 'Immer an: volle Kraft.',
      pwm_pins: 'Wer pulst, bestimmt die Richtung: IN1 pulst = im Uhrzeigersinn, IN2 pulst = dagegen. Der andere bleibt LOW.',
      pwm_merk: 'PWM hei\u00dft: schnell an und aus. Der Anteil \u201ean\u201c bestimmt die Kraft. Welcher Eingang pulst, bestimmt die Richtung.',
      pwm_try1: 'Motor-Test (nur SW2 an, R\u00e4der in der Luft): {cmd} \u2013 linkes Rad, {pct}, zwei Sekunden.',
      pwm_try2: 'Mit Minus dreht es andersherum: {neg}. Der Tastgrad geht bis 1010.',
      pwm_trySoon: 'Motor-Panel mit Schieberegler',
      pwm_tipScope: 'Ein Oszilloskop malt die Spannung \u00fcber die Zeit. Oben ist HIGH (Schalter an), unten LOW. Mit Zoom siehst du mehr oder weniger Takte.',

      /* ---- Ultraschall ---- */
      us_lead: 'Der Roboter ruft ganz hoch \u2013 so hoch, dass du es nicht h\u00f6rst. Dann wartet er auf das Echo. Aus der Zeit rechnet er den Abstand.',
      us_dist: 'Wo steht die Wand?',
      us_wall: 'Die Wand ist \u2026',
      us_straight: 'gerade',
      us_slant: 'schr\u00e4g',
      us_gone: 'weg',
      us_ping: 'Ping!',
      us_auto: 'Immer wieder',
      us_slowmo: 'Zeitlupe: 250-mal langsamer',
      us_clock: 'Stoppuhr',
      us_time: 'Zeit hin und zur\u00fcck',
      us_way: 'Weg des Schalls',
      us_res: 'Abstand',
      us_wait: 'Ping! Warte auf das Echo \u2026',
      us_ready: 'Dr\u00fcck \u201ePing!\u201c oder zieh die Wand.',
      us_echo: 'Echo! Die Wand ist {d} weit weg.',
      us_none: 'Kein Echo! Nach 30 ms gibt der Roboter auf.',
      us_noneSlant: 'Der Schall prallt schr\u00e4g ab und fliegt weg. Kein Echo \u2013 der Roboter wei\u00df jetzt nicht, ob da eine Wand ist.',
      us_noneGone: 'Keine Wand: Der Schall kommt nie zur\u00fcck. Nach 30 ms gibt der Roboter auf.',
      us_far: 'Zu weit! \u00dcber 2 m glaubt der Roboter dem Echo nicht.',
      us_tooFar: 'zu weit',
      us_speed: 'Schall-Tempo',
      us_drag: 'Zieh mich!',
      us_merk: 'Zeit mal 343 m/s, dann durch 2 \u2013 das ist der Abstand. Kein Echo hei\u00dft \u201ewei\u00df nicht\u201c, nicht \u201ekeine Wand\u201c.',
      us_try1: 'Labyrinth-Modus (nur SW3 an): {us} zeigt alle drei Abst\u00e4nde in mm. {usw} misst immer wieder, {usw0} h\u00f6rt auf.',
      us_try2: 'Im Editor fragt der Baustein \u201ewenn vorne frei\u201c am echten Roboter genau diese Sensoren ({walls}).',
      us_trySoon: 'Abst\u00e4nde live anzeigen',
      us_tipSlow: 'Echter Schall ist viel zu schnell zum Zusehen. Die Stoppuhr zeigt die echte Zeit in Millisekunden.',

      /* ---- Flood-Fill ---- */
      ff_lead: 'Gie\u00df Wasser ins Ziel. Die Welle flie\u00dft Feld f\u00fcr Feld und schreibt Zahlen: so viele Schritte bis zum Ziel. Der Roboter l\u00e4uft dann immer bergab.',
      ff_flood: 'Fluten',
      ff_walk: 'Roboter los',
      ff_wall: 'Neue Mauer',
      ff_reset: 'Von vorn',
      ff_wave: 'Welle: Schritt {k} von {n}',
      ff_path: 'Weg zum Ziel: {n} Schritte',
      ff_hint: 'Klick auf eine Linie: Mauer an oder aus.',
      ff_st_ready: 'Bereit. Dr\u00fcck \u201eFluten\u201c.',
      ff_st_flooding: 'Das Wasser flie\u00dft \u2026',
      ff_st_done: 'Alles geflutet! Jede Zahl sagt: so viele Schritte bis zum Ziel.',
      ff_st_walk: 'Der Roboter geht bergab: immer zur kleineren Zahl.',
      ff_st_arrived: 'Am Ziel! {n} Schritte \u2013 der k\u00fcrzeste Weg.',
      ff_st_newWall: 'Neue Mauer! Der alte Weg ist zu. Also: neu fluten.',
      ff_st_noWall: 'Hier passt keine Mauer mehr, ohne Felder abzuschneiden.',
      ff_st_dry: 'Manche Felder bleiben trocken: Da kommt kein Wasser hin.',
      ff_st_edit: 'Mauer ge\u00e4ndert. Neu fluten!',
      ff_goal: 'Ziel',
      ff_waveL: 'Welle',
      ff_stepsL: 'Schritte bis zum Ziel',
      ff_r1: 'Das Ziel bekommt die 0.',
      ff_r2: 'Nachbar ohne Mauer: Zahl + 1.',
      ff_r3: 'Roboter: immer zur kleineren Zahl.',
      ff_bridge: 'Genau das macht der echte Roboter, wenn du ihm {go} schickst.',
      ff_merk: 'Wasser vom Ziel aus. Die Zahlen z\u00e4hlen die Schritte. Dann immer bergab. Neue Mauer? Neu fluten!',
      ff_try1: 'Labyrinth-Modus (nur SW3 an): {go} \u2013 er sucht das Ziel, sieht neue W\u00e4nde und flutet neu. {map} druckt seine Karte.',
      ff_try2: 'Auf der Besucher-Seite (maze_event.html) klickst du ein Feld an, und er f\u00e4hrt hin ({goto}).',
      ff_trySoon: 'Kartenansicht',

      /* ---- Lexikon ---- */
      lex_title: 'Lexikon',
      lex_lead: 'Alle Begriffe rund um deinen Roboter. Such ein Wort oder st\u00f6bere einfach.',
      lex_search: 'Suchen, z. B. Motor',
      lex_all: 'Alle',
      lex_count: '{n} Begriffe',
      lex_one: '1 Begriff',
      lex_none: 'Nichts gefunden. Versuch ein anderes Wort.',
      lex_where: 'Wo am Roboter?',
      lex_see: 'Siehe auch',
      lex_exp: 'Zum Experiment',
      lex_planned: 'geplant',
      lex_try: 'Probier mal!',
      lex_clear: 'L\u00f6schen',
      lex_link: 'Link zu diesem Begriff',

      hb_in: '{n}',
      hb_cw: 'IN1 HIGH, IN2 LOW: dreht im Uhrzeigersinn.',
      hb_ccw: 'IN1 LOW, IN2 HIGH: dreht gegen den Uhrzeigersinn.',
      hb_coast: 'Beide LOW: alle Schalter offen. Kein Strom \u2013 das Rad rollt aus.',
      hb_brake: 'Beide HIGH: die Motor-Enden werden verbunden. Der Motor bremst sich selbst.',
      dip_000: 'Alle aus: Web-Simulator',
      dip_100: 'SW1: Bluetooth-Test',
      dip_010: 'SW2: Motor-Test',
      dip_110: 'SW1 + SW2: PID-Test',
      dip_001: 'SW3: Labyrinth',
      dip_none: 'Kein Modus \u2013 die Motoren bleiben aus.',
      dip_note: 'Nach dem Umstellen: Reset dr\u00fccken.',
      led_on: 'LED an',
      led_off: 'LED aus',
      press_hold: 'Gedr\u00fcckt halten',
      press_on: 'gedr\u00fcckt: HIGH',
      press_off: 'los: LOW',
      dead_turns: 'Das Rad dreht.',
      dead_still: 'Das Rad steht.',
      dead_label: 'Kraft',
      cmd_pick: 'Tipp einen Befehl an:',
      cmd_example: '(Beispielwerte)',
    },

    en: {
      title: 'RatRocket Learn',
      tagline: 'How your robot works',
      lang: 'Deutsch',
      navTopics: 'Topics',
      navLex: 'Glossary',
      toEditor: 'To the editor',
      homeTitle: 'How does your robot work?',
      homeLead: 'Five experiments to try. Slide, click and watch what happens.',
      go: 'Try it',
      lexCardTitle: 'Glossary',
      lexCardSub: '{n} words from current to flood fill. Each with a picture.',
      lexCardGo: 'Look it up',
      back: 'All topics',
      next: 'Next topic',
      tryTitle: 'Try it on the robot',
      soon: 'coming soon',
      inEditor: 'In the editor:',
      merk: 'Remember',
      inLex: 'In the glossary',
      play: 'Play',
      pause: 'Pause',
      resume: 'Resume',
      again: 'Again',
      step: 'Step',
      rmNote: 'Motion is turned off on this device. You see the result straight away.',
      rmTip: 'Motion is turned off (device setting). Use the step buttons.',
      topicNo: 'Topic {n}',

      pid_lead: 'The robot should drive in the middle of the corridor. But one motor is a bit stronger. Without steering it pulls towards the wall.',
      pid_p: 'How hard does it steer?',
      pid_pHint: 'P: The further from the middle, the harder it steers back.',
      pid_d: 'How far does it look ahead?',
      pid_dHint: 'D: If it is heading for the middle fast, it eases off early.',
      pid_iOpen: 'Pro: add I',
      pid_i: 'How well does it remember old errors?',
      pid_iHint: 'I: Adds up small errors and steers them away. The real robot steers in the corridor with P and D only.',
      pid_presets: 'Try these settings:',
      pid_weak: 'too weak',
      pid_zig: 'too jumpy',
      pid_good: 'just right',
      pid_push: 'Push!',
      pid_err: 'Distance from the middle',
      pid_bumps: 'Wall touched',
      pid_curve: 'Distance from the middle over time',
      pid_mid: 'middle',
      pid_wall: 'wall',
      pid_prev: 'before',
      pid_now: 'now',
      pid_left: 'left',
      pid_right: 'right',
      pid_ouch: 'Ouch!',
      pid_st_start: 'Off it goes \u2026',
      pid_st_wall: 'Ouch! It is stuck on the wall. It steers too weakly.',
      pid_st_zig: 'Zigzag! It steers too hard and overshoots the middle.',
      pid_st_off: 'It stays beside the middle. A bit more P?',
      pid_st_settle: 'It is finding the middle \u2026',
      pid_st_good: 'Calm in the middle. Just right!',
      pid_bridge: 'You will set exactly these numbers on the real robot later (Kp, Kd).',
      pid_merk: 'P steers back to the middle. D eases off in time. Together it drives calmly.',
      pid_try1: 'Maze mode (only SW3 on): {cmd} sets P and D. Then {cell} in a long corridor.',
      pid_try2: 'Does it weave? Smaller P or bigger D. Does it pull to the wall? Bigger P. Factory setting: {def}.',
      pid_trySoon: 'Sliders to tune',
      pid_tipStage: 'This is computed for real, not a video: 80 mm/s, track 96 mm, corridor 160 mm wide. The left motor pulls slightly to the right.',
      pid_tipCurve: 'Up means left of the middle, down means right. The red lines are the walls. The faint line is your last run.',

      enc_lead: 'There is a counter on the motor. It counts 2874 pulses for every turn of the wheel. That is how the robot knows exactly how far it went.',
      enc_speed: 'How fast does the wheel turn?',
      enc_perSec: '{n} pulses per second',
      enc_stopped: 'standing still',
      enc_zero: 'Counter to 0',
      enc_turn: '1 turn',
      enc_cell: 'Drive 1 cell',
      enc_pulses: 'pulses',
      enc_turns: 'turns',
      enc_dist: 'distance',
      enc_lens: 'Magnifier: 20 times bigger',
      enc_hint: 'Turn the speed slider \u2013 or let the wheel drive exactly 1 cell.',
      enc_sensor: 'sensor',
      enc_way: 'Distance on the floor',
      enc_cellN: 'cell {n}',
      enc_doneTurn: 'Exactly 1 turn: {n} pulses.',
      enc_doneCell: 'Exactly 1 cell: {n} pulses = 160 mm!',
      enc_calc: 'How the maths works',
      enc_c1: '1 turn = {ppr} pulses',
      enc_c2: 'wheel round = \u03c0 \u00d7 34 mm = {circ} mm',
      enc_c3: '1 mm = {ppr} \u00f7 {circ} = {ppmm} pulses',
      enc_c4: '1 cell = 160 mm \u00d7 {ppmm} = {cell} pulses',
      enc_merk: 'One turn is 2874 pulses. Counting instead of guessing: that is why \u201c1 cell\u201d lands exactly.',
      enc_try1: 'Motor test (only SW2 on): {enc0}, then turn the wheel by hand exactly once, then {enc}.',
      enc_try2: 'Maze mode (only SW3 on): {cell} drives exactly one cell \u2013 so does the block \u201cmove 1 cell\u201d in the editor.',
      enc_trySoon: 'Live pulse counter',
      enc_tipTicks: 'Every line on the wheel is one pulse. There are 2874 \u2013 so close together that they look like a grey ring. The magnifier shows them one by one.',
      enc_tipStory: 'True story: first they counted by eye, about 2510. Then the robot drove only 262 mm instead of 300. Worked out again: 2510 \u00d7 300 \u00f7 262 \u2248 2874.',

      pwm_lead: 'A motor switch only knows on and off. Half power? Then you switch on and off very fast \u2013 1000 times a second.',
      pwm_duty: 'How long on?',
      pwm_dutyHint: 'Duty cycle: how much of each cycle the switch is on.',
      pwm_rate: 'How often to switch?',
      pwm_slow: 'once a second',
      pwm_fast: '1000 times a second',
      pwm_dir: 'Direction',
      pwm_cw: 'clockwise',
      pwm_ccw: 'anticlockwise',
      pwm_on: 'on',
      pwm_off: 'off',
      pwm_scope: 'Oscilloscope: what the signal looks like',
      pwm_avg: 'average',
      pwm_wheel: 'Wheel speed',
      pwm_force: 'power',
      pwm_blur: 'too fast for your eyes',
      pwm_cycle: 'One cycle',
      pwm_cmdL: 'Command on the robot',
      pwm_tipWheel: 'Part of the power goes into friction. That is why the wheel turns slower than the power suggests. Below about 25 % it stands still.',
      pwm_st_dead: 'The wheel stands still: not enough power against friction (dead band).',
      pwm_st_jerk: 'Jerk, jerk! Switched this slowly, the wheel stutters.',
      pwm_st_smooth: 'Nice and smooth: 1000 times a second feels like {d} power.',
      pwm_st_off: 'Always off: no current, the wheel rolls to a stop.',
      pwm_st_full: 'Always on: full power.',
      pwm_pins: 'Whoever pulses decides the direction: IN1 pulses = clockwise, IN2 pulses = the other way. The other one stays LOW.',
      pwm_merk: 'PWM means: on and off very fast. The share of \u201con\u201d sets the power. Which input pulses sets the direction.',
      pwm_try1: 'Motor test (only SW2 on, wheels in the air): {cmd} \u2013 left wheel, {pct}, two seconds.',
      pwm_try2: 'With a minus it turns the other way: {neg}. The duty goes up to 1010.',
      pwm_trySoon: 'Motor panel with a slider',
      pwm_tipScope: 'An oscilloscope draws the voltage over time. Up is HIGH (switch on), down is LOW. Zoom shows more or fewer cycles.',

      us_lead: 'The robot shouts very high \u2013 so high you cannot hear it. Then it waits for the echo. From the time it works out the distance.',
      us_dist: 'Where is the wall?',
      us_wall: 'The wall is \u2026',
      us_straight: 'straight',
      us_slant: 'slanted',
      us_gone: 'gone',
      us_ping: 'Ping!',
      us_auto: 'Again and again',
      us_slowmo: 'Slow motion: 250 times slower',
      us_clock: 'Stopwatch',
      us_time: 'Time there and back',
      us_way: 'Distance of the sound',
      us_res: 'Distance',
      us_wait: 'Ping! Waiting for the echo \u2026',
      us_ready: 'Press \u201cPing!\u201d or drag the wall.',
      us_echo: 'Echo! The wall is {d} away.',
      us_none: 'No echo! After 30 ms the robot gives up.',
      us_noneSlant: 'The sound bounces off at an angle and flies away. No echo \u2013 now the robot does not know whether there is a wall.',
      us_noneGone: 'No wall: the sound never comes back. After 30 ms the robot gives up.',
      us_far: 'Too far! Beyond 2 m the robot does not trust the echo.',
      us_tooFar: 'too far',
      us_speed: 'speed of sound',
      us_drag: 'Drag me!',
      us_merk: 'Time times 343 m/s, then halve it \u2013 that is the distance. No echo means \u201cdon\u2019t know\u201d, not \u201cno wall\u201d.',
      us_try1: 'Maze mode (only SW3 on): {us} shows all three distances in mm. {usw} keeps measuring, {usw0} stops.',
      us_try2: 'In the editor the block \u201cif front is free\u201d asks exactly these sensors on the real robot ({walls}).',
      us_trySoon: 'Show distances live',
      us_tipSlow: 'Real sound is far too fast to watch. The stopwatch shows the real time in milliseconds.',

      ff_lead: 'Pour water into the goal. The wave flows cell by cell and writes numbers: that many steps to the goal. Then the robot always walks downhill.',
      ff_flood: 'Flood',
      ff_walk: 'Go, robot',
      ff_wall: 'New wall',
      ff_reset: 'Start over',
      ff_wave: 'Wave: step {k} of {n}',
      ff_path: 'Way to the goal: {n} steps',
      ff_hint: 'Click a line: wall on or off.',
      ff_st_ready: 'Ready. Press \u201cFlood\u201d.',
      ff_st_flooding: 'The water is flowing \u2026',
      ff_st_done: 'All flooded! Each number says: that many steps to the goal.',
      ff_st_walk: 'The robot walks downhill: always to the smaller number.',
      ff_st_arrived: 'At the goal! {n} steps \u2013 the shortest way.',
      ff_st_newWall: 'New wall! The old way is blocked. So: flood again.',
      ff_st_noWall: 'No more wall fits here without cutting cells off.',
      ff_st_dry: 'Some cells stay dry: no water can get there.',
      ff_st_edit: 'Wall changed. Flood again!',
      ff_goal: 'goal',
      ff_waveL: 'Wave',
      ff_stepsL: 'Steps to the goal',
      ff_r1: 'The goal gets 0.',
      ff_r2: 'Neighbour without a wall: number + 1.',
      ff_r3: 'Robot: always to the smaller number.',
      ff_bridge: 'The real robot does exactly this when you send it {go}.',
      ff_merk: 'Water from the goal. The numbers count the steps. Then always downhill. New wall? Flood again!',
      ff_try1: 'Maze mode (only SW3 on): {go} \u2013 it looks for the goal, sees new walls and floods again. {map} prints its map.',
      ff_try2: 'On the visitor page (maze_event.html) you click a cell and it drives there ({goto}).',
      ff_trySoon: 'Map view',

      lex_title: 'Glossary',
      lex_lead: 'All the words around your robot. Search for a word or just browse.',
      lex_search: 'Search, e.g. motor',
      lex_all: 'All',
      lex_count: '{n} words',
      lex_one: '1 word',
      lex_none: 'Nothing found. Try another word.',
      lex_where: 'Where on the robot?',
      lex_see: 'See also',
      lex_exp: 'To the experiment',
      lex_planned: 'planned',
      lex_try: 'Try it!',
      lex_clear: 'Clear',
      lex_link: 'Link to this word',

      hb_in: '{n}',
      hb_cw: 'IN1 HIGH, IN2 LOW: turns clockwise.',
      hb_ccw: 'IN1 LOW, IN2 HIGH: turns anticlockwise.',
      hb_coast: 'Both LOW: all switches open. No current \u2013 the wheel rolls to a stop.',
      hb_brake: 'Both HIGH: the motor ends are joined. The motor brakes itself.',
      dip_000: 'All off: web simulator',
      dip_100: 'SW1: Bluetooth test',
      dip_010: 'SW2: motor test',
      dip_110: 'SW1 + SW2: PID test',
      dip_001: 'SW3: maze',
      dip_none: 'No mode \u2013 the motors stay off.',
      dip_note: 'After switching: press reset.',
      led_on: 'LED on',
      led_off: 'LED off',
      press_hold: 'Press and hold',
      press_on: 'pressed: HIGH',
      press_off: 'released: LOW',
      dead_turns: 'The wheel turns.',
      dead_still: 'The wheel stands still.',
      dead_label: 'power',
      cmd_pick: 'Tap a command:',
      cmd_example: '(example values)',
    },
  };

  /* ---------------- the five explainers ---------------- */
  const TOPICS = [
    { id: 'pid', tag: { de: 'Regeln', en: 'Control' },
      title: { de: 'Was ist PID?', en: 'What is PID?' },
      sub: { de: 'Wie der Roboter in der Mitte des Gangs bleibt.', en: 'How the robot stays in the middle of the corridor.' },
      lex: ['regelkreis', 'trim', 'kalibrierung', 'ultraschall'] },
    { id: 'encoder', tag: { de: 'Messen', en: 'Measuring' },
      title: { de: 'Pulse z\u00e4hlen \u2013 der Encoder', en: 'Counting pulses \u2013 the encoder' },
      sub: { de: 'Woher der Roboter wei\u00df, wie weit er gefahren ist.', en: 'How the robot knows how far it has gone.' },
      lex: ['odometrie', 'kalibrierung', 'drehzahl', 'getriebe'] },
    { id: 'pwm', tag: { de: 'Motoren', en: 'Motors' },
      title: { de: 'PWM \u2013 schnell an und aus', en: 'PWM \u2013 on and off, fast' },
      sub: { de: 'Wie man einen Motor halb so stark macht.', en: 'How to make a motor half as strong.' },
      lex: ['hbruecke', 'totzone', 'dcmotor', 'highlow'] },
    { id: 'ultraschall', tag: { de: 'Sensoren', en: 'Sensors' },
      title: { de: 'Ultraschall \u2013 sehen mit den Ohren', en: 'Ultrasound \u2013 seeing with your ears' },
      sub: { de: 'Wie ein Echo den Abstand verr\u00e4t.', en: 'How an echo gives away the distance.' },
      lex: ['infrarot', 'tof', 'bedingung', 'sensoraktor'] },
    { id: 'floodfill', tag: { de: 'Planen', en: 'Planning' },
      title: { de: 'Flood-Fill \u2013 die Wasserwelle', en: 'Flood fill \u2013 the water wave' },
      sub: { de: 'Wie der Roboter den k\u00fcrzesten Weg plant.', en: 'How the robot plans the shortest way.' },
      lex: ['algorithmus', 'rechtehand', 'variable', 'ultraschall'] },
  ];

  /* ---------------- Lexikon categories ---------------- */
  const CATS = [
    { id: 'elek', de: 'Elektronik-Grundlagen', en: 'Electronics basics' },
    { id: 'motor', de: 'Motor & Bewegung', en: 'Motor & movement' },
    { id: 'sens', de: 'Sensoren', en: 'Sensors' },
    { id: 'regel', de: 'Regeln & Kalibrieren', en: 'Control & calibration' },
    { id: 'soft', de: 'Verbindung & Software', en: 'Connection & software' },
    { id: 'algo', de: 'Denken & Algorithmen', en: 'Thinking & algorithms' },
  ];

  /* small drawing helpers for the figures (viewBox 0 0 200 110) */
  const arrowR = (x, y) => '<path d="M' + (x - 6) + ' ' + (y - 5) + ' L' + x + ' ' + y + ' L' + (x - 6) + ' ' + (y + 5) + '" class="k"/>';
  const arrowL = (x, y) => '<path d="M' + (x + 6) + ' ' + (y - 5) + ' L' + x + ' ' + y + ' L' + (x + 6) + ' ' + (y + 5) + '" class="k"/>';
  const bot = (x, y, deg, s) => '<use href="#bot" transform="translate(' + x + ' ' + y + ') rotate(' + deg + ') scale(' + s + ')"/>';
  const legs = (x0, y0, n, dx, dy, len, horiz) => {
    let d = '';
    for (let i = 0; i < n; i++) {
      const x = x0 + i * dx, y = y0 + i * dy;
      d += horiz ? 'M' + x + ' ' + y + 'h' + len : 'M' + x + ' ' + y + 'v' + len;
    }
    return '<path d="' + d + '" class="k1"/>';
  };
  const wave = (x0, y0, w, h, per, duty, n) => {
    let d = 'M' + x0 + ' ' + y0;
    for (let i = 0; i < n; i++) d += ' v' + (-h) + ' h' + (per * duty) + ' v' + h + ' h' + (per * (1 - duty));
    return d;
  };

  /* ---------------- Lexikon entries ---------------- */
  const LEX = [
    /* ===== Elektronik-Grundlagen ===== */
    {
      id: 'strom', cat: 'elek',
      term: { de: 'Strom & Spannung', en: 'Current & voltage' },
      alias: 'Volt Ampere Akku battery',
      text: { de: 'Spannung ist der Druck, Strom ist das Flie\u00dfen. Wie Wasser im Schlauch: mehr Druck, mehr Fluss.',
              en: 'Voltage is the push, current is the flow. Like water in a hose: more push, more flow.' },
      where: { de: 'Zwei Akku-Zellen liefern bis 8,4 V. Daraus macht die Platine 5 V und 3,3 V.',
               en: 'Two battery cells give up to 8.4 V. The board turns that into 5 V and 3.3 V.' },
      links: ['highlow', 'batterie', 'widerstand'],
      fig: (L) =>
        '<rect x="12" y="32" width="42" height="52" rx="7" class="mf k"/><rect x="25" y="26" width="16" height="6" rx="1.5" class="kf"/>' +
        '<text x="33" y="58" text-anchor="middle" class="tb">' + dc(L, '8,4 V') + '</text>' +
        '<text x="33" y="72" text-anchor="middle" class="ts">' + tr(L, 'Akku', 'battery') + '</text>' +
        '<path d="M33 26 V12 H152 V40 M152 70 V98 H33 V84" class="k"/>' +
        '<path d="M33 26 V12 H152 V40 M152 70 V98 H33 V84" class="g a-flow" stroke-width="3.2" stroke-dasharray="2 10"/>' +
        '<circle cx="152" cy="55" r="22" class="gf a-glow"/>' +
        '<path d="M142 70 V52 a10 10 0 0 1 20 0 V70 Z" class="rf"/><path d="M137 70 H167" class="k"/>' +
        '<text x="93" y="30" text-anchor="middle" class="ts">' + tr(L, 'Strom flie\u00dft', 'current flows') + '</text>' + arrowR(112, 12),
    },
    {
      id: 'highlow', cat: 'elek',
      term: { de: 'HIGH & LOW', en: 'HIGH & LOW' },
      alias: 'digital 1 0 an aus on off',
      text: { de: 'Ein digitaler Pin kennt nur zwei Zust\u00e4nde. HIGH hei\u00dft Spannung an, LOW hei\u00dft 0 Volt. Mehr braucht ein Computer nicht.',
              en: 'A digital pin knows only two states. HIGH means voltage on, LOW means 0 volts. A computer needs nothing more.' },
      where: { de: 'Am Mikrocontroller ist HIGH 3,3 V. Der Start-Taster PB2 liest HIGH, solange du dr\u00fcckst.',
               en: 'On the microcontroller HIGH is 3.3 V. The start button PB2 reads HIGH while you press it.' },
      links: ['pin', 'pwm', 'taster'],
      fig: (L) =>
        '<path d="M44 14 V92 H192" class="k1 m"/>' +
        '<text x="40" y="34" text-anchor="end" class="tb">HIGH</text><text x="40" y="46" text-anchor="end" class="ts">' + dc(L, '3,3 V') + '</text>' +
        '<text x="40" y="84" text-anchor="end" class="tb">LOW</text><text x="40" y="96" text-anchor="end" class="ts">0 V</text>' +
        '<path d="M44 30 H192" class="m k1" stroke-dasharray="3 4"/>' +
        '<path d="M46 88 H66 V30 H104 V88 H124 V30 H160 V88 H190" class="r" stroke-width="3"/>' +
        '<path d="M46 88 H66 V30 H104 V88 H124 V30 H160 V88 H190" class="g a-flow" stroke-width="3" stroke-dasharray="3 12"/>' +
        '<text x="85" y="24" text-anchor="middle" class="ts">1</text><text x="114" y="82" text-anchor="middle" class="ts">0</text>',
    },
    {
      id: 'pin', cat: 'elek',
      term: { de: 'Pin / GPIO', en: 'Pin / GPIO' },
      alias: 'Beinchen Anschluss Eingang Ausgang input output',
      text: { de: 'Ein Pin ist ein Beinchen am Chip. GPIO hei\u00dft: Das Programm entscheidet, ob er misst (Eingang) oder schaltet (Ausgang).',
              en: 'A pin is a leg on the chip. GPIO means: the program decides whether it measures (input) or switches (output).' },
      where: { de: 'Der STM32 hat 64 Pins. PA6 und PA7 steuern das rechte Rad, PB2 ist der Start-Taster.',
               en: 'The STM32 has 64 pins. PA6 and PA7 drive the right wheel, PB2 is the start button.' },
      links: ['highlow', 'mcu', 'led'],
      fig: () =>
        '<rect x="62" y="22" width="70" height="66" rx="5" class="df"/>' +
        legs(50, 30, 6, 0, 10, 12, true) + legs(132, 30, 6, 0, 10, 12, true) +
        legs(70, 10, 6, 11, 0, 12, false) + legs(70, 88, 6, 11, 0, 12, false) +
        '<path d="M132 50 H156" class="r" stroke-width="3.5"/><circle cx="159" cy="50" r="4" class="rf"/>' +
        '<text x="167" y="54" class="tb">PB2</text>' +
        '<circle cx="71" cy="31" r="2.6" class="mf"/>' +
        '<text x="97" y="59" text-anchor="middle" class="tw">STM32</text>',
    },
    {
      id: 'widerstand', cat: 'elek',
      term: { de: 'Widerstand', en: 'Resistor' },
      alias: 'Ohm resistance',
      text: { de: 'Ein Widerstand bremst den Strom. Ohne ihn w\u00fcrde eine LED zu viel Strom bekommen und durchbrennen.',
              en: 'A resistor slows the current down. Without it an LED would get too much current and burn out.' },
      where: { de: 'Vor jeder Farbe der RGB-LED sitzen 470 \u03a9.',
               en: 'Each colour of the RGB LED has 470 \u03a9 in front of it.' },
      links: ['led', 'strom', 'batterie'],
      fig: () =>
        '<path d="M12 38 H54 M146 38 H188" class="k"/>' +
        '<rect x="52" y="26" width="96" height="24" rx="12" class="sand k1"/>' +
        '<rect x="68" y="26" width="7" height="24" style="fill:#e3c22b"/><rect x="82" y="26" width="7" height="24" style="fill:#7b4bc9"/>' +
        '<rect x="96" y="26" width="7" height="24" style="fill:#7a4a24"/><rect x="124" y="26" width="5" height="24" class="gf"/>' +
        '<path d="M24 82 H72 M128 82 H176" class="k"/><rect x="72" y="73" width="56" height="18" class="wf k"/>' +
        '<text x="100" y="106" text-anchor="middle" class="tb">470 \u03a9</text>',
    },
    {
      id: 'led', cat: 'elek', act: 'led',
      term: { de: 'LED', en: 'LED' },
      alias: 'Leuchtdiode light diode RGB',
      text: { de: 'Eine LED leuchtet, wenn Strom in die richtige Richtung flie\u00dft. Sie braucht wenig Strom und wird kaum warm.',
              en: 'An LED lights up when current flows the right way through it. It needs little current and hardly gets warm.' },
      where: { de: 'Die RGB-LED: Rot an PC8, Gr\u00fcn an PC9, Blau an PB5. Blau leuchtet im Update-Modus.',
               en: 'The RGB LED: red on PC8, green on PC9, blue on PB5. Blue lights up in update mode.' },
      links: ['widerstand', 'pin', 'bootloader'],
      fig: () =>
        '<circle cx="66" cy="50" r="34" class="gf lx-glow"/>' +
        '<path d="M52 76 V46 a14 14 0 0 1 28 0 V76 Z" class="rf lx-ledbody"/><path d="M47 77 H85" class="k"/>' +
        '<path d="M60 78 V102 M72 78 V96" class="k1"/>' +
        '<path d="M112 60 H136 M158 60 H184" class="k"/><path d="M136 48 L158 60 L136 72 Z" class="wf k"/><path d="M158 48 V72" class="k"/>' +
        '<path d="M146 42 L156 30 M158 44 L168 32" class="k1"/><path d="M151 30 H156 V35 M163 32 H168 V37" class="k1"/>',
    },
    {
      id: 'kondensator', cat: 'elek',
      term: { de: 'Kondensator', en: 'Capacitor' },
      alias: 'Speicher Elko',
      text: { de: 'Ein Kondensator ist ein winziger Strom-Speicher. Er f\u00e4ngt kurze Dellen in der Spannung ab, zum Beispiel wenn ein Motor anl\u00e4uft.',
              en: 'A capacitor is a tiny store for electricity. It smooths out short dips in the voltage, for example when a motor starts.' },
      where: { de: 'Die Bauteile mit einem C im Namen (C1, C2 \u2026) auf der Platine sind Kondensatoren.',
               en: 'The parts with a C in their name (C1, C2 \u2026) on the board are capacitors.' },
      links: ['strom', 'platine', 'dcmotor'],
      fig: (L) =>
        '<path d="M14 50 H86 M114 50 H186" class="k"/><path d="M86 24 V76 M114 24 V76" class="k" stroke-width="5"/>' +
        '<g class="a-blink2"><text x="74" y="36" class="tb r0">+</text><text x="74" y="56" class="tb r0">+</text><text x="74" y="76" class="tb r0">+</text>' +
        '<text x="119" y="36" class="tb b0">\u2212</text><text x="119" y="56" class="tb b0">\u2212</text><text x="119" y="76" class="tb b0">\u2212</text></g>' +
        '<rect x="56" y="90" width="88" height="9" rx="4.5" class="mf"/><rect x="56" y="90" width="88" height="9" rx="4.5" class="gf a-fill"/>' +
        '<text x="100" y="14" text-anchor="middle" class="ts">' + tr(L, 'l\u00e4dt \u2026 und gibt wieder ab', 'charges \u2026 and lets go again') + '</text>',
    },
    {
      id: 'taster', cat: 'elek', act: 'press',
      term: { de: 'Taster & Schalter', en: 'Button & switch' },
      alias: 'Knopf button switch PB2 S1',
      text: { de: 'Ein Taster ist nur an, solange du dr\u00fcckst. Ein Schalter bleibt, wie du ihn stellst.',
              en: 'A button is only on while you press it. A switch stays the way you set it.' },
      where: { de: 'Taster PB2 startet die Fahrt, 1 s nach dem Loslassen. Schalter S1 schaltet den Akku ein.',
               en: 'Button PB2 starts a run, 1 s after you let go. Switch S1 turns the battery on.' },
      links: ['dip', 'highlow', 'pin'],
      fig: () =>
        '<rect x="30" y="72" width="76" height="14" rx="3" class="df"/>' +
        '<g class="lx-cap"><rect x="68" y="60" width="10" height="14" class="kf"/><rect x="50" y="42" width="46" height="20" rx="7" class="rf"/></g>' +
        '<text x="68" y="102" text-anchor="middle" class="ts">PB2</text>' +
        '<path d="M106 79 H142" class="k1"/><circle cx="152" cy="79" r="9" class="mf k1 lx-lamp"/>' +
        '<rect x="128" y="20" width="48" height="20" rx="10" class="mf k1"/><circle cx="166" cy="30" r="7" class="grf"/>' +
        '<text x="152" y="54" text-anchor="middle" class="ts">S1</text>',
    },
    {
      id: 'dip', cat: 'elek', act: 'dip',
      term: { de: 'DIP-Schalter', en: 'DIP switch' },
      alias: 'Modus mode SW1 SW2 SW3',
      text: { de: 'Mini-Schalter auf der Platine. Der Roboter liest sie einmal beim Einschalten und w\u00e4hlt damit seinen Modus.',
              en: 'Tiny switches on the board. The robot reads them once at power-up and picks its mode with them.' },
      where: { de: 'SW1 bis SW3 (einer der vier geht nicht). Nur SW3 an = Labyrinth.',
               en: 'SW1 to SW3 (one of the four does not work). Only SW3 on = maze.' },
      links: ['taster', 'firmware'],
      fig: () => {
        let s = '<rect x="38" y="24" width="124" height="62" rx="6" class="bf"/><text x="44" y="18" class="ts">ON \u2191</text>';
        for (let i = 0; i < 4; i++) {
          const x = 50 + i * 28;
          s += '<rect x="' + x + '" y="34" width="20" height="42" rx="3" class="df"/>' +
               '<rect class="lx-dip' + (i === 3 ? ' lx-dead' : '') + '" data-i="' + i + '" x="' + (x + 3) + '" y="57" width="14" height="16" rx="2.5"/>' +
               '<text x="' + (x + 10) + '" y="100" text-anchor="middle" class="ts">' + (i + 1) + '</text>';
        }
        return s + '<path d="M138 30 L158 80 M158 30 L138 80" class="r" opacity=".55"/>';
      },
    },
    {
      id: 'platine', cat: 'elek',
      term: { de: 'Platine', en: 'Circuit board' },
      alias: 'PCB Leiterplatte board',
      text: { de: 'Auf einer Platine sind die Kabel schon eingebaut: d\u00fcnne Kupferbahnen. Die Bauteile werden daraufgel\u00f6tet.',
              en: 'On a circuit board the wires are built in: thin copper tracks. The parts are soldered on top.' },
      where: { de: 'Die rote Platine ist der K\u00f6rper deines Roboters: rund, mit zwei Motoren unten dran.',
               en: 'The red board is your robot\u2019s body: round, with two motors underneath.' },
      links: ['loeten', 'mcu', 'kondensator'],
      fig: () =>
        '<rect x="22" y="62" width="16" height="38" rx="5" class="df"/><rect x="162" y="62" width="16" height="38" rx="5" class="df"/>' +
        '<path d="M40 102 V56 A60 48 0 0 1 160 56 V102 Z" class="rf"/>' +
        '<path d="M58 96 V76 H86 M142 96 V78 H114 M100 18 V48 M64 60 H86 M136 60 H114 M100 78 V100" class="g" stroke-width="1.6"/>' +
        '<rect x="86" y="48" width="28" height="30" rx="2" class="df"/>' +
        '<circle cx="58" cy="96" r="3" class="gf"/><circle cx="142" cy="96" r="3" class="gf"/><circle cx="100" cy="18" r="3" class="gf"/><circle cx="64" cy="60" r="3" class="gf"/><circle cx="136" cy="60" r="3" class="gf"/>',
    },
    {
      id: 'mcu', cat: 'elek',
      term: { de: 'Mikrocontroller', en: 'Microcontroller' },
      alias: 'STM32 Chip Prozessor MCU',
      text: { de: 'Ein ganzer kleiner Computer in einem Chip. Er liest Sensoren, rechnet und schaltet Motoren \u2013 ohne Pause.',
              en: 'A whole little computer in one chip. It reads sensors, does sums and switches motors \u2013 without a break.' },
      where: { de: 'Der schwarze Chip in der Mitte: ein STM32F411. Er tickt 40 Millionen Mal pro Sekunde (40 MHz).',
               en: 'The black chip in the middle: an STM32F411. It ticks 40 million times a second (40 MHz).' },
      links: ['pin', 'firmware', 'programm'],
      fig: () =>
        '<rect x="30" y="22" width="66" height="66" rx="4" class="df"/>' +
        legs(18, 30, 6, 0, 10, 12, true) + legs(96, 30, 6, 0, 10, 12, true) +
        legs(38, 10, 6, 10, 0, 12, false) + legs(38, 88, 6, 10, 0, 12, false) +
        '<text x="63" y="54" text-anchor="middle" class="tw">STM32</text><text x="63" y="68" text-anchor="middle" class="tw ts0">F411</text>' +
        '<path d="' + wave(118, 62, 0, 20, 12, 0.5, 6) + '" class="g" stroke-width="2.2"/>' +
        '<text x="154" y="88" text-anchor="middle" class="tb">40 MHz</text>',
    },
    {
      id: 'loeten', cat: 'elek',
      term: { de: 'L\u00f6ten', en: 'Soldering' },
      alias: 'Loetkolben Zinn solder iron',
      text: { de: 'Ein hei\u00dfer L\u00f6tkolben schmilzt Zinn. Das Zinn verbindet Bauteil und Platine fest, und Strom kann flie\u00dfen.',
              en: 'A hot soldering iron melts solder. The solder joins part and board firmly, and current can flow.' },
      where: { de: 'Eine L\u00f6tstelle zum Motortreiber war kaputt: Das linke Rad konnte nicht r\u00fcckw\u00e4rts. Neu gel\u00f6tet \u2013 geht wieder.',
               en: 'A joint to the motor driver was broken: the left wheel could not reverse. Soldered again \u2013 works again.' },
      links: ['platine', 'hbruecke'],
      fig: () =>
        '<path d="M14 88 H186" class="r" stroke-width="9"/>' +
        '<path d="M100 36 V86" class="k1"/><rect x="90" y="22" width="20" height="16" rx="3" class="bf"/>' +
        '<path d="M88 86 Q100 66 112 86 Z" class="mf k1"/>' +
        '<path d="M180 14 L132 54" class="k" stroke-width="9"/><path d="M134 52 L116 70" class="k" stroke-width="3"/><path d="M180 14 L156 34" class="r" stroke-width="10"/>' +
        '<path class="a-rise" d="M104 60 q-5 -8 0 -16 q5 -8 0 -16" style="fill:none;stroke:#9aa4b3;stroke-width:1.6"/>' +
        '<path class="a-rise d2" d="M96 62 q-5 -8 0 -16 q5 -8 0 -16" style="fill:none;stroke:#9aa4b3;stroke-width:1.6"/>',
    },
    {
      id: 'sensoraktor', cat: 'elek',
      term: { de: 'Sensor & Aktor', en: 'Sensor & actuator' },
      alias: 'messen bewegen input output',
      text: { de: 'Sensoren messen die Welt, wie Augen und Ohren. Aktoren bewegen etwas, wie Muskeln. Dazwischen entscheidet das Programm.',
              en: 'Sensors measure the world, like eyes and ears. Actuators move something, like muscles. In between, the program decides.' },
      where: { de: 'Sensoren: 3 Ultraschall, 2 Encoder, die Akku-Messung. Aktoren: 2 Motoren und die LED.',
               en: 'Sensors: 3 ultrasonic, 2 encoders, the battery check. Actuators: 2 motors and the LED.' },
      links: ['ultraschall', 'encoder', 'dcmotor'],
      fig: (L) =>
        '<rect x="4" y="34" width="54" height="40" rx="8" class="bf"/><text x="31" y="58" text-anchor="middle" class="tw">Sensor</text>' +
        '<rect x="70" y="34" width="60" height="40" rx="6" class="df"/><text x="100" y="58" text-anchor="middle" class="tw ts0">' + tr(L, 'Programm', 'program') + '</text>' +
        '<rect x="142" y="34" width="54" height="40" rx="8" class="rf"/><text x="169" y="58" text-anchor="middle" class="tw ts0">' + tr(L, 'Aktor', 'actuator') + '</text>' +
        '<path d="M58 54 H70 M130 54 H142" class="k"/>' + arrowR(70, 54) + arrowR(142, 54) +
        '<path d="M22 22 a8 8 0 0 1 0 -10 M28 24 a13 13 0 0 1 0 -14 M34 26 a18 18 0 0 1 0 -18" class="b"/>' +
        '<g class="a-spin"><circle cx="169" cy="92" r="10" class="k1" style="fill:none;stroke-width:5;stroke-dasharray:3.9 3.9"/></g>',
    },

    /* ===== Motor & Bewegung ===== */
    {
      id: 'dcmotor', cat: 'motor',
      term: { de: 'Gleichstrom-Motor', en: 'DC motor' },
      alias: 'Motor N20 Getriebemotor',
      text: { de: 'Flie\u00dft Strom durch den Motor, dreht er sich. Andersherum angeschlossen, dreht er andersherum.',
              en: 'When current flows through the motor, it turns. Connected the other way round, it turns the other way.' },
      where: { de: 'Zwei N20-Getriebemotoren, einer f\u00fcr jedes Rad.',
               en: 'Two N20 gear motors, one for each wheel.' },
      links: ['hbruecke', 'getriebe', 'pwm'],
      fig: () =>
        '<path d="M34 46 H14 M34 66 H14" class="k1"/><text x="8" y="50" class="tb">+</text><text x="7" y="70" class="tb">\u2212</text>' +
        '<rect x="34" y="38" width="10" height="36" rx="3" class="df"/>' +
        '<rect x="42" y="30" width="82" height="52" rx="10" class="mf k"/><text x="83" y="61" text-anchor="middle" class="tb">N20</text>' +
        '<path d="M124 56 H150" class="k" stroke-width="4"/>' +
        '<g class="a-spin"><circle cx="162" cy="56" r="20" class="wf k"/><path d="M162 38 V74 M144 56 H180" class="r" stroke-width="3"/></g>',
    },
    {
      id: 'hbruecke', cat: 'motor', act: 'hbridge',
      term: { de: 'Wie dreht der Motor? (H-Br\u00fccke)', en: 'Which way does the motor turn? (H-bridge)' },
      alias: 'H-Bruecke Motortreiber DRV8833 IN1 IN2 Richtung brake coast bremsen ausrollen',
      text: { de: 'Vier Schalter um den Motor, wie ein H. Zwei Eing\u00e4nge, IN1 und IN2, sagen dem Treiber, welche Schalter zugehen. Probier alle vier!',
              en: 'Four switches around the motor, like an H. Two inputs, IN1 and IN2, tell the driver which switches close. Try all four!' },
      where: { de: 'Motortreiber DRV8833: rechtes Rad an PA6/PA7, linkes an PB0/PB1. Beide LOW = ausrollen, beide HIGH = bremsen.',
               en: 'Motor driver DRV8833: right wheel on PA6/PA7, left on PB0/PB1. Both LOW = coast, both HIGH = brake.' },
      links: ['dcmotor', 'pwm', 'highlow'],
      fig: () =>
        '<path d="M34 12 H166" class="k"/><path d="M34 98 H166" class="k"/>' +
        '<text x="4" y="16" class="ts">V+</text><text x="4" y="102" class="ts">GND</text>' +
        '<path class="hb-flow hb-f-cw" d="M52 12 V55 H148 V98"/>' +
        '<path class="hb-flow hb-f-ccw" d="M148 12 V55 H52 V98"/>' +
        '<path class="hb-flow hb-f-brake" d="M52 55 V98 H148 V55 Z"/>' +
        '<path d="M52 12 V22 M52 44 V66 M52 88 V98 M148 12 V22 M148 44 V66 M148 88 V98 M52 55 H84 M116 55 H148" class="k"/>' +
        '<line class="hb-sw" data-sw="hl" x1="52" y1="44" x2="52" y2="22"/><line class="hb-sw" data-sw="ll" x1="52" y1="88" x2="52" y2="66"/>' +
        '<line class="hb-sw" data-sw="hr" x1="148" y1="44" x2="148" y2="22"/><line class="hb-sw" data-sw="lr" x1="148" y1="88" x2="148" y2="66"/>' +
        '<circle cx="52" cy="22" r="2.6" class="kf"/><circle cx="52" cy="66" r="2.6" class="kf"/><circle cx="148" cy="22" r="2.6" class="kf"/><circle cx="148" cy="66" r="2.6" class="kf"/>' +
        '<circle cx="100" cy="55" r="16" class="wf k"/><text x="100" y="60" text-anchor="middle" class="tb">M</text>' +
        '<g class="hb-arr hb-a-cw"><path d="M86 34 A24 24 0 0 1 122 40" class="r" stroke-width="3"/><path d="M114 36 L122 40 L120 31" class="r" stroke-width="3"/></g>' +
        '<g class="hb-arr hb-a-ccw"><path d="M114 34 A24 24 0 0 0 78 40" class="r" stroke-width="3"/><path d="M86 36 L78 40 L80 31" class="r" stroke-width="3"/></g>' +
        '<g class="hb-arr hb-a-brake"><rect x="88" y="27" width="24" height="7" rx="2" class="rf"/></g>' +
        '<g class="hb-arr hb-a-coast"><path d="M86 34 A24 24 0 0 1 122 40" class="m" stroke-width="2.4" stroke-dasharray="2 5"/></g>' +
        '<text x="26" y="58" class="tb hb-in1">IN1</text><text x="156" y="58" class="tb hb-in2">IN2</text>',
    },
    {
      id: 'getriebe', cat: 'motor',
      term: { de: 'Getriebe & \u00dcbersetzung', en: 'Gearbox & gear ratio' },
      alias: 'Zahnrad gear',
      text: { de: 'Ein kleines Zahnrad treibt ein gro\u00dfes an. Das gro\u00dfe dreht langsamer, aber mit viel mehr Kraft.',
              en: 'A small gear drives a big one. The big one turns more slowly, but with much more force.' },
      where: { de: 'In jedem N20-Motor steckt ein Getriebe: Der Motor dreht schnell, das Rad langsam und kr\u00e4ftig.',
               en: 'Every N20 motor has a gearbox inside: the motor spins fast, the wheel slowly and strongly.' },
      links: ['drehmoment', 'drehzahl', 'dcmotor'],
      fig: (L) =>
        '<g class="a-spin a-fast"><circle cx="40" cy="56" r="18" class="gear"/><circle cx="40" cy="56" r="12" class="mf k1"/><path d="M40 46 V66" class="r"/></g>' +
        '<g class="a-spin a-slow a-rev"><circle cx="98" cy="56" r="38" class="gear"/><circle cx="98" cy="56" r="31" class="mf k1"/><path d="M98 28 V84" class="r"/></g>' +
        '<text x="40" y="100" text-anchor="middle" class="ts">' + tr(L, 'schnell', 'fast') + '</text>' +
        '<text x="170" y="52" text-anchor="middle" class="ts">' + tr(L, 'langsam,', 'slow,') + '</text>' +
        '<text x="170" y="65" text-anchor="middle" class="ts">' + tr(L, 'kr\u00e4ftig', 'strong') + '</text>',
    },
    {
      id: 'drehzahl', cat: 'motor',
      term: { de: 'Drehzahl', en: 'Rotational speed' },
      alias: 'Umdrehungen rpm Tempo speed',
      text: { de: 'Wie viele Umdrehungen in einer bestimmten Zeit? Beim Auto z\u00e4hlt man pro Minute. Der Roboter z\u00e4hlt Encoder-Pulse pro Sekunde.',
              en: 'How many turns in a certain time? A car counts per minute. The robot counts encoder pulses per second.' },
      where: { de: 'Der Motor-Test SWEEP druckt eine Tabelle: Tastgrad und Pulse pro Sekunde.',
               en: 'The motor test SWEEP prints a table: duty cycle and pulses per second.' },
      links: ['encoder', 'getriebe', 'pwm'],
      fig: (L) =>
        '<path d="M36 86 A64 64 0 0 1 164 86" class="mf" style="fill:none;stroke-width:12"/>' +
        '<path d="M36 86 A64 64 0 0 1 132 31" class="g" style="stroke-width:12"/>' +
        '<g class="a-needle"><path d="M100 86 L100 34" class="r" stroke-width="3.4"/></g><circle cx="100" cy="86" r="6" class="kf"/>' +
        '<text x="100" y="106" text-anchor="middle" class="ts">' + tr(L, 'Pulse pro Sekunde', 'pulses per second') + '</text>',
    },
    {
      id: 'drehmoment', cat: 'motor',
      term: { de: 'Drehmoment', en: 'Torque' },
      alias: 'Kraft Hebel force lever',
      text: { de: 'Drehmoment ist Dreh-Kraft. Ein langer Schraubenschl\u00fcssel macht mehr davon als ein kurzer.',
              en: 'Torque is turning force. A long spanner makes more of it than a short one.' },
      where: { de: 'Unter etwa 250 von 1010 PWM reicht das Drehmoment nicht gegen die Reibung: Das Rad steht.',
               en: 'Below about 250 of 1010 PWM the torque cannot beat friction: the wheel stands still.' },
      links: ['totzone', 'getriebe'],
      fig: (L) =>
        '<path d="M40 56 m-14 0 l7 -12 h14 l7 12 l-7 12 h-14 z" class="df"/>' +
        '<path d="M40 56 H172" class="k" stroke-width="9"/><circle cx="40" cy="56" r="17" class="k" style="fill:none;stroke-width:6"/>' +
        '<path d="M172 22 V48" class="r" stroke-width="3.2"/><path d="M166 41 L172 49 L178 41" class="r" stroke-width="3.2"/>' +
        '<text x="164" y="30" text-anchor="end" class="ts">' + tr(L, 'Kraft', 'force') + '</text>' +
        '<path d="M58 78 H170" class="m k1"/><text x="114" y="92" text-anchor="middle" class="ts">' + tr(L, 'Hebel', 'lever') + '</text>' +
        '<path d="M20 30 A28 28 0 0 1 60 26" class="b" stroke-width="2.4"/><path d="M54 21 L61 26 L54 31" class="b" stroke-width="2.4"/>',
    },
    {
      id: 'encoder', cat: 'motor', topic: 'encoder',
      term: { de: 'Encoder', en: 'Encoder' },
      alias: 'Drehgeber Zaehler Pulse counts',
      text: { de: 'Ein Z\u00e4hler am Motor. Ein Magnet dreht sich an einem Sensor vorbei. Jeder Puls ist ein winziges St\u00fcck Weg.',
              en: 'A counter on the motor. A magnet spins past a sensor. Every pulse is a tiny piece of the way.' },
      where: { de: 'Magnet-Encoder an beiden N20-Motoren: etwa 2874 Pulse pro Radumdrehung.',
               en: 'Magnetic encoders on both N20 motors: about 2874 pulses per wheel turn.' },
      links: ['odometrie', 'drehzahl', 'kalibrierung'],
      fig: () =>
        '<g class="a-spin"><circle cx="54" cy="55" r="27" style="fill:none;stroke:#2f6fd0;stroke-width:20"/>' +
        '<circle cx="54" cy="55" r="27" style="fill:none;stroke:#d22b1e;stroke-width:20;stroke-dasharray:21.2 21.2"/></g>' +
        '<circle cx="54" cy="55" r="6" class="kf"/>' +
        '<rect x="88" y="45" width="12" height="20" rx="2" class="df"/><path d="M100 55 H112" class="k1"/>' +
        '<path d="' + wave(116, 72, 0, 32, 12, 0.5, 6) + '" class="g" stroke-width="2.2"/>' +
        '<path d="' + wave(116, 72, 0, 32, 12, 0.5, 6) + '" class="r a-flow" stroke-width="2.2" stroke-dasharray="4 14"/>',
    },
    {
      id: 'odometrie', cat: 'motor',
      term: { de: 'Odometrie', en: 'Odometry' },
      alias: 'Weg berechnen Spurbreite track',
      text: { de: 'Den Weg aus den Rad-Umdrehungen berechnen. Drehen beide R\u00e4der gleich, f\u00e4hrt er geradeaus. Sonst f\u00e4hrt er eine Kurve.',
              en: 'Working out the way from the wheel turns. If both wheels turn the same, it drives straight. Otherwise it drives a curve.' },
      where: { de: 'Spurbreite 96 mm: Daraus rechnet er, wie weit jedes Rad f\u00fcr eine Drehung fahren muss.',
               en: 'Track width 96 mm: from that it works out how far each wheel must go for a turn.' },
      links: ['encoder', 'trim', 'kalibrierung'],
      fig: (L) =>
        '<path d="M22 84 H104 Q150 84 150 40 V14" class="g" stroke-width="3" stroke-dasharray="5 6"/>' +
        '<path d="M22 92 V76 M62 92 V76 M102 92 V76" class="k1"/>' +
        '<text x="22" y="104" text-anchor="middle" class="ts">0</text><text x="62" y="104" text-anchor="middle" class="ts">80</text><text x="102" y="104" text-anchor="middle" class="ts">160 mm</text>' +
        bot(150, 52, 0, 0.3) +
        '<text x="10" y="22" class="ts">' + tr(L, 'L = R: geradeaus', 'L = R: straight') + '</text>' +
        '<text x="10" y="36" class="ts">' + tr(L, 'L > R: Kurve', 'L > R: curve') + '</text>',
    },
    {
      id: 'pwm', cat: 'motor', topic: 'pwm',
      term: { de: 'PWM', en: 'PWM' },
      alias: 'Pulsweitenmodulation Tastgrad duty cycle',
      text: { de: 'Schnell an und aus statt halb an. Der Anteil \u201ean\u201c hei\u00dft Tastgrad und bestimmt die Kraft.',
              en: 'On and off very fast instead of half on. The share of \u201con\u201d is the duty cycle and sets the power.' },
      where: { de: 'Etwa 1000-mal pro Sekunde. Der Tastgrad geht von 0 bis 1010.',
               en: 'About 1000 times a second. The duty goes from 0 to 1010.' },
      links: ['totzone', 'hbruecke', 'highlow'],
      fig: (L) =>
        '<svg x="10" y="14" width="180" height="70" viewBox="0 0 180 70" overflow="hidden"><g class="a-march">' +
        '<path d="' + wave(0, 62, 0, 50, 30, 0.5, 13) + '" class="r" stroke-width="3"/></g></svg>' +
        '<path d="M10 51 H190" class="g" stroke-width="2" stroke-dasharray="5 4"/>' +
        '<text x="100" y="102" text-anchor="middle" class="ts">' + tr(L, 'Mittelwert = halbe Kraft', 'average = half power') + '</text>',
    },
    {
      id: 'totzone', cat: 'motor', act: 'dead',
      term: { de: 'Totzone', en: 'Dead band' },
      alias: 'Anlauf Schwelle Reibung friction threshold',
      text: { de: 'Bei wenig Kraft passiert gar nichts: Die Reibung h\u00e4lt das Rad fest. Erst \u00fcber einer Schwelle l\u00e4uft es an.',
              en: 'With little power nothing happens: friction holds the wheel. It only starts above a threshold.' },
      where: { de: 'Bei 1000 Hz etwa 250 von 1010. Das linke Rad braucht etwa 110 mehr als das rechte.',
               en: 'At 1000 Hz about 250 of 1010. The left wheel needs about 110 more than the right.' },
      links: ['pwm', 'drehmoment', 'kalibrierung'],
      fig: (L) =>
        '<rect x="30" y="16" width="37" height="74" class="lx-zone"/>' +
        '<path d="M30 12 V90 H186" class="k1 m"/>' +
        '<path d="M30 90 H67 L180 20" class="r" stroke-width="3"/>' +
        '<circle class="lx-dot" cx="30" cy="90" r="6"/>' +
        '<text x="48" y="50" text-anchor="middle" class="ts">' + tr(L, 'Totzone', 'dead band') + '</text>' +
        '<text x="186" y="104" text-anchor="end" class="ts">' + tr(L, 'Kraft \u2192', 'power \u2192') + '</text>' +
        '<text x="36" y="10" class="ts">' + tr(L, 'Tempo', 'speed') + '</text>',
    },

    /* ===== Sensoren ===== */
    {
      id: 'ultraschall', cat: 'sens', topic: 'ultraschall',
      term: { de: 'Ultraschall', en: 'Ultrasound' },
      alias: 'HC-SR04 Echo Abstand distance sonar',
      text: { de: 'Ein Ton, zu hoch f\u00fcr deine Ohren. Aus der Zeit bis zum Echo rechnet der Roboter den Abstand.',
              en: 'A sound too high for your ears. From the time until the echo, the robot works out the distance.' },
      where: { de: 'Drei HC-SR04: US1 vorne, US2 links, US3 rechts.',
               en: 'Three HC-SR04: US1 front, US2 left, US3 right.' },
      links: ['infrarot', 'tof', 'sensoraktor'],
      fig: () =>
        bot(40, 55, 90, 0.42) +
        '<rect x="172" y="12" width="12" height="86" rx="2" class="rf"/>' +
        '<g class="a-ping"><path d="M78 38 A22 22 0 0 1 78 72" class="b" stroke-width="3"/></g>' +
        '<g class="a-ping d2"><path d="M78 38 A22 22 0 0 1 78 72" class="b" stroke-width="3"/></g>' +
        '<g class="a-echo"><path d="M168 38 A22 22 0 0 0 168 72" class="g" stroke-width="3"/></g>',
    },
    {
      id: 'infrarot', cat: 'sens',
      term: { de: 'Infrarot', en: 'Infrared' },
      alias: 'IR Licht light',
      text: { de: 'Licht, das du nicht sehen kannst. Eine IR-LED leuchtet, ein Empf\u00e4nger misst, wie viel davon von der Wand zur\u00fcckkommt.',
              en: 'Light you cannot see. An IR LED shines, and a receiver measures how much of it comes back from the wall.' },
      where: { de: 'Es gibt eine Steckplatine mit 5 IR-Empf\u00e4ngern. Dein Roboter f\u00e4hrt zurzeit mit Ultraschall.',
               en: 'There is a plug-in board with 5 IR receivers. Your robot currently drives with ultrasound.' },
      links: ['ultraschall', 'tof', 'led'],
      fig: (L) =>
        '<rect x="14" y="30" width="22" height="16" rx="3" class="rf"/><rect x="14" y="64" width="22" height="16" rx="3" class="df"/>' +
        '<text x="40" y="26" class="ts">' + tr(L, 'Sender', 'emitter') + '</text><text x="40" y="96" class="ts">' + tr(L, 'Empf\u00e4nger', 'receiver') + '</text>' +
        '<rect x="170" y="12" width="12" height="86" rx="2" class="rf"/>' +
        '<path d="M36 38 L170 55 L36 72" class="ir a-flow" stroke-width="3" stroke-dasharray="6 6"/>',
    },
    {
      id: 'tof', cat: 'sens',
      term: { de: 'Laser / Time-of-Flight', en: 'Laser / time of flight' },
      alias: 'ToF VL53L0X Licht Laufzeit',
      text: { de: 'Wie Ultraschall, nur mit Licht. Licht schafft 30 cm in einer Milliardstel Sekunde \u2013 der Sensor muss sehr schnell z\u00e4hlen.',
              en: 'Like ultrasound, but with light. Light covers 30 cm in a billionth of a second \u2013 the sensor has to count very fast.' },
      where: { de: 'Steckplatine \u201eModul 1-2\u201c: bis zu 5 Sensoren VL53L0X. Deine Firmware nutzt sie noch nicht.',
               en: 'Plug-in board \u201cmodule 1-2\u201d: up to 5 VL53L0X sensors. Your firmware does not use them yet.' },
      links: ['ultraschall', 'infrarot'],
      fig: (L) =>
        '<rect x="12" y="44" width="28" height="22" rx="3" class="df"/><circle cx="34" cy="55" r="3.5" class="rf"/>' +
        '<rect x="172" y="12" width="12" height="86" rx="2" class="rf"/>' +
        '<path d="M38 52 H172 M172 58 H38" class="r a-flow" stroke-width="2" stroke-dasharray="10 6"/>' +
        '<text x="105" y="40" text-anchor="middle" class="ts">' + tr(L, '30 cm in 1 ns', '30 cm in 1 ns') + '</text>',
    },
    {
      id: 'imu', cat: 'sens', status: 'planned',
      term: { de: 'Gyroskop & IMU', en: 'Gyroscope & IMU' },
      alias: 'Drehung Beschleunigung MPU6050 gyro',
      text: { de: 'Ein Gyroskop sp\u00fcrt Drehungen, ein Beschleunigungs-Sensor sp\u00fcrt Schubsen. Zusammen hei\u00dfen sie IMU.',
              en: 'A gyroscope feels turning, an accelerometer feels pushing. Together they are called an IMU.' },
      where: { de: 'Steckplatz H2 ist f\u00fcr eine IMU (MPU6050) vorbereitet. Drehungen damit messen ist geplant.',
               en: 'Header H2 is ready for an IMU (MPU6050). Measuring turns with it is planned.' },
      links: ['odometrie', 'kalibrierung'],
      fig: () =>
        '<path d="M70 44 L100 30 L130 44 L100 58 Z" class="mf k1"/><path d="M70 44 V76 L100 90 V58 Z" class="sand k1"/><path d="M130 44 V76 L100 90 V58 Z" class="wf k1"/>' +
        '<path d="M100 58 V12" class="r" stroke-width="2.6"/><path d="M95 18 L100 10 L105 18" class="r" stroke-width="2.6"/>' +
        '<path d="M100 72 L160 98" class="gr" stroke-width="2.6"/><path d="M151 98 L161 99 L155 91" class="gr" stroke-width="2.6"/>' +
        '<path d="M100 72 L40 98" class="b" stroke-width="2.6"/><path d="M45 91 L39 99 L49 98" class="b" stroke-width="2.6"/>' +
        '<g class="a-spin a-slow"><path d="M84 18 A18 7 0 1 0 116 18" class="g" stroke-width="2.4" style="fill:none"/></g>',
    },
    {
      id: 'batterie', cat: 'sens',
      term: { de: 'Batterie messen', en: 'Measuring the battery' },
      alias: 'Akku Spannung BAT mV voltage',
      text: { de: 'Zwei Widerst\u00e4nde teilen die Akku-Spannung in eine kleine Spannung. Die kann der Chip messen.',
              en: 'Two resistors divide the battery voltage into a small voltage. The chip can measure that.' },
      where: { de: 'Pin PA0 misst. Der Befehl BAT zeigt die Spannung in Millivolt.',
               en: 'Pin PA0 measures. The command BAT shows the voltage in millivolts.' },
      links: ['strom', 'widerstand', 'pin'],
      fig: () =>
        '<rect x="14" y="28" width="38" height="58" rx="6" class="mf k"/><rect x="25" y="22" width="16" height="6" rx="1.5" class="kf"/>' +
        '<rect x="18" y="58" width="30" height="24" rx="3" class="grf a-fill-y"/>' +
        '<path d="M33 22 V12 H100 V24 M100 52 V64 M100 92 V100 H33 V86" class="k"/>' +
        '<rect x="92" y="24" width="16" height="28" class="wf k"/><rect x="92" y="64" width="16" height="28" class="wf k"/>' +
        '<path d="M100 58 H140" class="k"/><circle cx="100" cy="58" r="3" class="kf"/>' +
        '<rect x="140" y="46" width="48" height="24" rx="4" class="df"/><text x="164" y="62" text-anchor="middle" class="tw">PA0</text>',
    },

    /* ===== Regeln & Kalibrieren ===== */
    {
      id: 'regelkreis', cat: 'regel',
      term: { de: 'Regelkreis', en: 'Control loop' },
      alias: 'Feedback Rueckkopplung',
      text: { de: 'Messen, vergleichen, nachstellen \u2013 und wieder von vorn. So bleibt etwas auf Kurs, auch wenn etwas st\u00f6rt.',
              en: 'Measure, compare, adjust \u2013 and round again. That keeps something on course, even when something gets in the way.' },
      where: { de: 'Die Rad-Regelung dreht diese Runde 1000-mal pro Sekunde.',
               en: 'The wheel control goes round this loop 1000 times a second.' },
      links: ['pid', 'encoder', 'sensoraktor'],
      fig: (L) =>
        '<path d="M6 40 H34" class="k"/>' + arrowR(34, 40) + '<text x="6" y="32" class="ts">' + tr(L, 'Ziel', 'goal') + '</text>' +
        '<circle cx="42" cy="40" r="8" class="wf k"/><text x="42" y="44" text-anchor="middle" class="tb">\u2212</text>' +
        '<path d="M50 40 H68 M118 40 H134 M174 40 H192 M154 52 V88 H120 M82 88 H42 V48" class="k"/>' + arrowR(68, 40) + arrowR(134, 40) +
        '<rect x="68" y="28" width="50" height="24" rx="5" class="bf"/><text x="93" y="44" text-anchor="middle" class="tw ts0">' + tr(L, 'Regler', 'controller') + '</text>' +
        '<rect x="134" y="28" width="40" height="24" rx="5" class="rf"/><text x="154" y="44" text-anchor="middle" class="tw ts0">Motor</text>' +
        '<rect x="82" y="76" width="38" height="24" rx="5" class="df"/><text x="101" y="92" text-anchor="middle" class="tw ts0">Sensor</text>' +
        '<path d="M50 40 H174 M154 52 V88 H42 V48" class="g a-tour" style="--to:-338" stroke-width="5" stroke-dasharray="8 330"/>',
    },
    {
      id: 'pid', cat: 'regel', topic: 'pid',
      term: { de: 'PID-Regler', en: 'PID controller' },
      alias: 'Kp Ki Kd KC proportional integral derivative',
      text: { de: 'P lenkt nach dem Fehler jetzt. I lenkt nach den alten Fehlern. D lenkt nach dem, was gleich passiert.',
              en: 'P steers by the error now. I steers by the old errors. D steers by what is about to happen.' },
      where: { de: 'Rad-Regler: KP 3, KI 6, KD 0,05. Lenkung im Gang: KC 1.5 0.5.',
               en: 'Wheel control: KP 3, KI 6, KD 0.05. Steering in the corridor: KC 1.5 0.5.' },
      links: ['regelkreis', 'kalibrierung', 'trim'],
      fig: (L) =>
        '<path d="M14 55 H190" class="m k1" stroke-dasharray="3 4"/>' +
        '<path d="M14 18 C40 18 44 92 70 86 S96 44 112 52 S140 60 152 55 H190" class="g" stroke-width="3" opacity=".28"/>' +
        '<path d="M14 18 C40 18 44 92 70 86 S96 44 112 52 S140 60 152 55 H190" class="g a-draw" stroke-width="3" style="--len:260"/>' +
        '<text x="190" y="50" text-anchor="end" class="ts">' + tr(L, 'Mitte', 'middle') + '</text>' +
        '<text x="22" y="104" class="tb r0">P</text><text x="40" y="104" class="tb b0">I</text><text x="54" y="104" class="tb g0">D</text>',
    },
    {
      id: 'kalibrierung', cat: 'regel',
      term: { de: 'Kalibrierung', en: 'Calibration' },
      alias: 'CALDIST Dreisatz messen',
      text: { de: 'Messen, wie es wirklich ist, und die Zahl im Roboter richtigstellen. Meist reicht der Dreisatz.',
              en: 'Measure how it really is and put the number in the robot right. Usually the rule of three is enough.' },
      where: { de: 'FWD 300 am Lineal, er f\u00e4hrt nur 262 mm. Dann CALDIST 300 262 \u2013 jetzt stimmt es.',
               en: 'FWD 300 along a ruler, it only drives 262 mm. Then CALDIST 300 262 \u2013 now it is right.' },
      links: ['encoder', 'trim', 'odometrie'],
      fig: (L) => {
        let s = '<rect x="14" y="58" width="172" height="22" rx="3" class="sand k1"/>';
        for (let i = 0; i <= 30; i++) s += '<path d="M' + (20 + i * 5.33) + ' 58 v' + (i % 5 ? 6 : 11) + '" class="k1" style="stroke-width:1"/>';
        return s + '<path d="M180 58 V20" class="gr" stroke-width="2.4"/><path d="M180 20 h-16 l5 6 l-5 6 h16" class="grf"/>' +
          '<path d="M159.7 58 V34" class="r" stroke-width="2.4"/><circle cx="159.7" cy="34" r="5" class="rf"/>' +
          '<text x="180" y="96" text-anchor="middle" class="tb">300</text><text x="152" y="96" text-anchor="middle" class="tb r0">262</text>' +
          '<text x="14" y="30" class="ts">' + tr(L, 'Soll / Ist', 'target / real') + '</text>';
      },
    },
    {
      id: 'trim', cat: 'regel',
      term: { de: 'Trim', en: 'Trim' },
      alias: 'schief gerade curve straight TRIM',
      text: { de: 'Zieht der Roboter immer leicht zur Seite, gleicht Trim das aus. Ein Rad dreht dann ein paar Prozent mehr.',
              en: 'If the robot always pulls slightly to one side, trim fixes it. One wheel then turns a few percent more.' },
      where: { de: 'TRIM mit Prozent, von \u221215 bis 15. Plus, wenn er nach links zieht.',
               en: 'TRIM with a percent value, from \u221215 to 15. Plus if it pulls to the left.' },
      links: ['kalibrierung', 'odometrie', 'pid'],
      fig: () =>
        '<path d="M80 92 Q76 40 40 12" class="r" stroke-width="2.6" stroke-dasharray="5 5"/>' +
        '<path d="M80 92 V12" class="gr" stroke-width="2.6"/>' +
        bot(80, 92, 0, 0.32) +
        '<text x="120" y="52" class="tb">TRIM</text><text x="120" y="68" class="tb gr0">+ 2 %</text>',
    },

    /* ===== Verbindung & Software ===== */
    {
      id: 'uart', cat: 'soft',
      term: { de: 'UART / seriell', en: 'UART / serial' },
      alias: 'Baud Baudrate seriell serial COM',
      text: { de: 'Bits kommen nacheinander \u00fcber eine Leitung, wie Perlen an einer Schnur. Beide Seiten brauchen dasselbe Tempo: die Baudrate.',
              en: 'Bits travel one after another down a wire, like beads on a string. Both sides need the same speed: the baud rate.' },
      where: { de: 'Das Bluetooth-Modul spricht mit 9600 Baud, das Kabel an USART1 mit 115200.',
               en: 'The Bluetooth module talks at 9600 baud, the cable on USART1 at 115200.' },
      links: ['bluetooth', 'usb', 'kommando'],
      fig: () => {
        let bits = '';
        const b = '0110100101101001';
        for (let i = 0; i < b.length; i++) bits += '<rect x="' + (i * 18) + '" y="0" width="14" height="18" rx="3" class="' + (b[i] === '1' ? 'gf' : 'mf') + '"/><text x="' + (i * 18 + 7) + '" y="13" text-anchor="middle" class="ts0 tb">' + b[i] + '</text>';
        return '<rect x="6" y="38" width="34" height="34" rx="5" class="df"/><text x="23" y="59" text-anchor="middle" class="tw ts0">TX</text>' +
          '<rect x="160" y="38" width="34" height="34" rx="5" class="df"/><text x="177" y="59" text-anchor="middle" class="tw ts0">RX</text>' +
          '<path d="M40 55 H160" class="k1"/>' +
          '<svg x="44" y="24" width="112" height="22" viewBox="0 0 112 22" overflow="hidden"><g class="a-march-bits">' + bits + '</g></svg>' +
          '<text x="100" y="92" text-anchor="middle" class="tb">9600 Baud</text>';
      },
    },
    {
      id: 'bluetooth', cat: 'soft',
      term: { de: 'Bluetooth', en: 'Bluetooth' },
      alias: 'Funk HC-05 radio wireless',
      text: { de: 'Funk f\u00fcr kurze Strecken. F\u00fcr den Computer sieht es aus wie ein Kabel.',
              en: 'Radio for short distances. To the computer it looks like a cable.' },
      where: { de: 'Modul HC-05, Name RatRocket, PIN 1234.',
               en: 'Module HC-05, name RatRocket, PIN 1234.' },
      links: ['uart', 'kommando', 'usb'],
      fig: () =>
        '<rect x="10" y="34" width="56" height="36" rx="4" class="df"/><rect x="15" y="39" width="46" height="26" rx="2" class="bf"/><path d="M4 74 H72" class="k" stroke-width="4"/>' +
        bot(160, 70, 0, 0.42) +
        '<g class="a-ping"><path d="M80 40 A22 22 0 0 1 80 70" class="b" stroke-width="2.6"/></g>' +
        '<g class="a-ping d2"><path d="M80 40 A22 22 0 0 1 80 70" class="b" stroke-width="2.6"/></g>' +
        '<path d="M100 12 L112 22 L100 32 V4 L112 14 L100 24" class="b" stroke-width="2.2"/>',
    },
    {
      id: 'usb', cat: 'soft',
      term: { de: 'USB', en: 'USB' },
      alias: 'USB-C Kabel cable COM',
      text: { de: 'Ein Kabel f\u00fcr Strom und Daten. Dein Roboter meldet sich als serielles Ger\u00e4t \u2013 ganz ohne Treiber.',
              en: 'One cable for power and data. Your robot shows up as a serial device \u2013 no driver needed.' },
      where: { de: 'Die USB-C-Buchse hinten. Am PC erscheint ein COM-Port. Nur am Kabel sind die Motoren schwach.',
               en: 'The USB-C socket at the back. A COM port appears on the PC. On the cable alone the motors are weak.' },
      links: ['bootloader', 'uart', 'strom'],
      fig: () =>
        '<rect x="10" y="30" width="56" height="38" rx="4" class="df"/><rect x="15" y="35" width="46" height="28" rx="2" class="bf"/><path d="M4 72 H72" class="k" stroke-width="4"/>' +
        '<text x="38" y="53" text-anchor="middle" class="tw ts0">COM</text>' +
        '<path d="M72 72 C110 72 100 40 140 40" class="k" stroke-width="4"/>' +
        '<path d="M72 72 C110 72 100 40 140 40" class="g a-flow" stroke-width="2" stroke-dasharray="3 7"/>' +
        '<rect x="140" y="32" width="30" height="16" rx="3" class="mf k1"/><rect x="170" y="35" width="16" height="10" rx="4" class="k1" style="fill:#c8cdd6"/>',
    },
    {
      id: 'firmware', cat: 'soft',
      term: { de: 'Firmware', en: 'Firmware' },
      alias: 'Software Programm im Chip',
      text: { de: 'Das Programm, das fest im Roboter wohnt. Es startet beim Einschalten und l\u00e4uft, bis der Strom weg ist.',
              en: 'The program that lives inside the robot. It starts at power-up and runs until the power is gone.' },
      where: { de: 'Beim Start liest sie die DIP-Schalter und w\u00e4hlt einen Modus, zum Beispiel Labyrinth.',
               en: 'At start-up it reads the DIP switches and picks a mode, for example maze.' },
      links: ['bootloader', 'dip', 'programm'],
      fig: () =>
        '<path d="M22 14 H64 L78 28 V82 H22 Z" class="wf k"/><path d="M64 14 V28 H78" class="k1"/>' +
        '<path d="M32 40 H66 M32 52 H58 M32 64 H68" class="b" stroke-width="3"/>' +
        '<path d="M86 50 H118" class="k"/>' + arrowR(118, 50) +
        '<g class="a-drop"><rect x="98" y="44" width="10" height="12" rx="2" class="gf"/></g>' +
        '<rect x="128" y="22" width="56" height="56" rx="4" class="df"/>' + legs(134, 16, 6, 9, 0, 6, false) + legs(134, 78, 6, 9, 0, 6, false) +
        '<text x="156" y="54" text-anchor="middle" class="tw ts0">STM32</text>',
    },
    {
      id: 'bootloader', cat: 'soft',
      term: { de: 'Bootloader & UF2', en: 'Bootloader & UF2' },
      alias: 'Update flashen RATROCKET DFU',
      text: { de: 'Ein kleines Start-Programm, das neue Firmware aufspielen kann. Bei deinem Roboter geht das wie Datei-Kopieren.',
              en: 'A small start-up program that can install new firmware. On your robot it works like copying a file.' },
      where: { de: 'Reset zweimal schnell dr\u00fccken (oder UPDATE): Ein Laufwerk RATROCKET erscheint. ratrocket.uf2 draufziehen \u2013 fertig.',
               en: 'Press reset twice quickly (or UPDATE): a drive called RATROCKET appears. Drop ratrocket.uf2 onto it \u2013 done.' },
      links: ['firmware', 'usb', 'led'],
      fig: () =>
        '<g class="a-slide"><path d="M18 22 H44 L54 32 V64 H18 Z" class="wf k"/><text x="36" y="52" text-anchor="middle" class="tb ts0">.uf2</text></g>' +
        '<rect x="104" y="36" width="84" height="44" rx="6" class="mf k"/><rect x="104" y="64" width="84" height="16" rx="0" class="k1" style="fill:#c8cdd6"/>' +
        '<circle cx="176" cy="72" r="3" class="bf a-blink"/>' +
        '<text x="146" y="56" text-anchor="middle" class="tb ts0">RATROCKET</text>',
    },
    {
      id: 'kommando', cat: 'soft', act: 'cmd',
      term: { de: 'Kommando & Protokoll', en: 'Command & protocol' },
      alias: 'Befehl command Konsole PING HELP',
      text: { de: 'Ein Kommando ist ein Befehl als Textzeile. Das Protokoll ist die Abmachung, wie Frage und Antwort aussehen.',
              en: 'A command is an instruction as a line of text. The protocol is the agreement on what question and answer look like.' },
      where: { de: 'Eine Zeile pro Befehl, zum Beispiel PING, Antwort PONG. HELP zeigt alle Befehle des Modus.',
               en: 'One line per command, for example PING, answer PONG. HELP lists all commands of the mode.' },
      links: ['uart', 'bluetooth', 'firmware'],
      fig: () =>
        '<rect x="8" y="10" width="184" height="90" rx="8" class="df"/>' +
        '<text x="20" y="38" class="term lx-q">&gt; PING</text>' +
        '<text x="20" y="62" class="term term-a lx-a">PONG</text>' +
        '<rect x="20" y="74" width="8" height="12" class="gf a-blink"/>',
    },
    {
      id: 'simreal', cat: 'soft',
      term: { de: 'Simulation & Wirklichkeit', en: 'Simulation & reality' },
      alias: 'echt real Unterschied difference',
      text: { de: 'In der Simulation ist alles perfekt. In echt rutschen R\u00e4der, Sensoren irren sich, Felder sind ungleich gro\u00df.',
              en: 'In the simulation everything is perfect. In reality wheels slip, sensors get it wrong, cells differ in size.' },
      where: { de: 'Im Editor schaltest du mit \u201eEchter Roboter\u201c zwischen beidem um.',
               en: 'In the editor you switch between the two with \u201cReal robot\u201d.' },
      links: ['kalibrierung', 'programm', 'pid'],
      fig: (L) =>
        '<text x="8" y="22" class="ts">' + tr(L, 'Simulation', 'simulation') + '</text><text x="8" y="72" class="ts">' + tr(L, 'Echt', 'real') + '</text>' +
        '<path d="M30 38 H176" class="b" stroke-width="2.6"/>' +
        '<path d="M30 88 C50 80 60 96 80 88 S110 80 126 90 S160 84 176 92" class="r" stroke-width="2.6"/>' +
        '<path d="M178 30 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" class="gf"/>' +
        '<path d="M178 80 l3 6 7 1 -5 5 1 7 -6 -3 -6 3 1 -7 -5 -5 7 -1 z" class="gf"/>',
    },

    /* ===== Denken & Algorithmen ===== */
    {
      id: 'programm', cat: 'algo',
      term: { de: 'Programm', en: 'Program' },
      alias: 'Code Befehle Bausteine blocks',
      text: { de: 'Eine Liste von Befehlen, die der Reihe nach ausgef\u00fchrt werden. Der Computer macht genau, was dasteht \u2013 nicht, was du meinst.',
              en: 'A list of instructions carried out one after another. The computer does exactly what is written \u2013 not what you mean.' },
      where: { de: 'In RatRocket Code baust du Programme aus Bausteinen.',
               en: 'In RatRocket Code you build programs from blocks.' },
      links: ['schleife', 'bedingung', 'algorithmus'],
      fig: (L) =>
        '<rect x="40" y="12" width="120" height="24" rx="7" class="blk-m"/><text x="54" y="29" class="tw">\u25b2 ' + tr(L, 'fahre 1 Feld', 'move 1 cell') + '</text>' +
        '<rect x="40" y="42" width="120" height="24" rx="7" class="blk-m"/><text x="54" y="59" class="tw">\u21b7 ' + tr(L, 'drehe rechts', 'turn right') + '</text>' +
        '<rect x="40" y="72" width="120" height="24" rx="7" class="blk-m"/><text x="54" y="89" class="tw">\u25b2 ' + tr(L, 'fahre 1 Feld', 'move 1 cell') + '</text>' +
        '<path d="M24 16 V90" class="k1 m"/>' + '<path d="M19 84 L24 92 L29 84" class="k1 m"/>',
    },
    {
      id: 'schleife', cat: 'algo',
      term: { de: 'Schleife', en: 'Loop' },
      alias: 'wiederhole repeat Wiederholung',
      text: { de: 'Etwas wiederholen, ohne es mehrmals hinzuschreiben. Mit einem Z\u00e4hler oder bis etwas passiert.',
              en: 'Repeating something without writing it down several times. With a counter or until something happens.' },
      where: { de: 'Bausteine \u201ewiederhole n mal\u201c und \u201ewiederhole, bis du drau\u00dfen bist\u201c.',
               en: 'Blocks \u201crepeat n times\u201d and \u201crepeat until you are out\u201d.' },
      links: ['programm', 'bedingung', 'regelkreis'],
      fig: (L) =>
        '<path d="M30 14 H146 a7 7 0 0 1 7 7 V30 H52 V64 H153 V74 a7 7 0 0 1 -7 7 H30 Z" class="blk-l"/>' +
        '<text x="40" y="28" class="tw">\u21ba ' + tr(L, 'wiederhole 3 mal', 'repeat 3 times') + '</text>' +
        '<rect x="56" y="36" width="96" height="22" rx="6" class="blk-m"/><text x="66" y="51" class="tw ts0">\u25b2 ' + tr(L, 'fahre 1 Feld', 'move 1 cell') + '</text>' +
        '<g class="a-spin"><path d="M178 38 A14 14 0 1 1 164 52" class="gr" stroke-width="3" style="fill:none"/><path d="M160 46 L164 53 L171 49" class="gr" stroke-width="3"/></g>',
    },
    {
      id: 'bedingung', cat: 'algo',
      term: { de: 'Bedingung', en: 'Condition' },
      alias: 'wenn sonst if else Entscheidung',
      text: { de: 'Eine Frage mit Ja oder Nein. Je nach Antwort macht das Programm etwas anderes.',
              en: 'A question with yes or no. Depending on the answer, the program does something different.' },
      where: { de: 'Baustein \u201ewenn \u2026 sonst\u201c mit Fragen wie \u201evorne frei\u201c. Am echten Roboter antwortet der Ultraschall.',
               en: 'Block \u201cif \u2026 else\u201d with questions like \u201cfront is free\u201d. On the real robot the ultrasound answers.' },
      links: ['programm', 'ultraschall', 'rechtehand'],
      fig: (L) =>
        '<path d="M100 8 L148 36 L100 64 L52 36 Z" class="blk-d"/><text x="100" y="40" text-anchor="middle" class="tw ts0">' + tr(L, 'vorne frei?', 'front free?') + '</text>' +
        '<path d="M52 36 H24 V80 M148 36 H176 V80" class="k"/>' +
        '<text x="34" y="30" class="ts">' + tr(L, 'ja', 'yes') + '</text><text x="152" y="30" class="ts">' + tr(L, 'nein', 'no') + '</text>' +
        '<rect x="4" y="80" width="56" height="22" rx="6" class="blk-m"/><text x="32" y="95" text-anchor="middle" class="tw ts0">\u25b2 ' + tr(L, 'fahre', 'move') + '</text>' +
        '<rect x="140" y="80" width="56" height="22" rx="6" class="blk-m"/><text x="168" y="95" text-anchor="middle" class="tw ts0">\u21b7 ' + tr(L, 'drehe', 'turn') + '</text>',
    },
    {
      id: 'variable', cat: 'algo',
      term: { de: 'Variable', en: 'Variable' },
      alias: 'Speicher merken Wert value',
      text: { de: 'Ein Kasten mit Namen, in dem eine Zahl liegt. Die Zahl darf sich \u00e4ndern, der Name bleibt.',
              en: 'A box with a name that holds a number. The number may change, the name stays.' },
      where: { de: 'Der Roboter merkt sich zum Beispiel, wo er ist: x, y und die Richtung (Befehl WHERE).',
               en: 'The robot remembers, for example, where it is: x, y and its heading (command WHERE).' },
      links: ['programm', 'floodfill'],
      fig: () =>
        '<path d="M40 40 L60 26 H160 L140 40 Z" class="sand k1"/><rect x="40" y="40" width="100" height="56" class="mf k"/><path d="M140 40 L160 26 V82 L140 96 Z" class="sand k1"/>' +
        '<rect x="58" y="10" width="34" height="20" rx="4" class="bf"/><text x="75" y="25" text-anchor="middle" class="tw">x</text>' +
        '<text x="90" y="80" text-anchor="middle" class="big a-cyc c1">0</text><text x="90" y="80" text-anchor="middle" class="big a-cyc c2">1</text><text x="90" y="80" text-anchor="middle" class="big a-cyc c3">2</text>',
    },
    {
      id: 'algorithmus', cat: 'algo',
      term: { de: 'Algorithmus', en: 'Algorithm' },
      alias: 'Rezept Verfahren recipe',
      text: { de: 'Ein genaues Rezept, das sicher zum Ziel f\u00fchrt. Jeder Schritt ist klar, nichts muss man raten.',
              en: 'An exact recipe that surely gets you to the goal. Every step is clear, nothing has to be guessed.' },
      where: { de: 'Im Roboter stecken zwei: die Rechte-Hand-Regel (ESCAPE) und Flood-Fill (GO).',
               en: 'Two live in the robot: the right-hand rule (ESCAPE) and flood fill (GO).' },
      links: ['rechtehand', 'floodfill', 'programm'],
      fig: () =>
        '<rect x="30" y="8" width="104" height="96" rx="6" class="wf k"/>' +
        '<circle cx="46" cy="30" r="8" class="bf"/><text x="46" y="34" text-anchor="middle" class="tw ts0">1</text><path d="M60 30 H120" class="m" stroke-width="4"/>' +
        '<circle cx="46" cy="56" r="8" class="bf"/><text x="46" y="60" text-anchor="middle" class="tw ts0">2</text><path d="M60 56 H112" class="m" stroke-width="4"/>' +
        '<circle cx="46" cy="82" r="8" class="bf"/><text x="46" y="86" text-anchor="middle" class="tw ts0">3</text><path d="M60 82 H116" class="m" stroke-width="4"/>' +
        '<path d="M140 56 H160" class="k"/>' + arrowR(160, 56) +
        '<path d="M176 42 l4 9 9 1 -7 6 2 9 -8 -5 -8 5 2 -9 -7 -6 9 -1 z" class="gf"/>',
    },
    {
      id: 'rechtehand', cat: 'algo',
      term: { de: 'Rechte-Hand-Regel', en: 'Right-hand rule' },
      alias: 'Wandfolger wall follower ESCAPE',
      text: { de: 'Halte die rechte Hand immer an der Wand. So findest du aus vielen Labyrinthen hinaus \u2013 ganz ohne Karte.',
              en: 'Always keep your right hand on the wall. That gets you out of many mazes \u2013 without any map.' },
      where: { de: 'ESCAPE: rechts, wenn frei; sonst geradeaus; sonst links; sonst umdrehen.',
               en: 'ESCAPE: right if free; else straight; else left; else turn round.' },
      links: ['algorithmus', 'floodfill', 'bedingung'],
      fig: () =>
        '<rect x="56" y="8" width="90" height="90" class="df"/>' +
        '<path d="M56 8 H146 V68 M146 98 H56 V8 M86 98 V68 M86 38 H116 V68" class="r" stroke-width="4"/>' +
        '<path d="M71 83 V23 H131 V53 H101 V83 H131 L160 83" class="g a-tour" style="--to:-270" stroke-width="5" stroke-dasharray="10 260"/>' +
        '<path d="M71 83 V23 H131 V53 H101 V83 H131 L160 83" class="g" stroke-width="1.6" stroke-dasharray="2 4" opacity=".7"/>',
    },
    {
      id: 'floodfill', cat: 'algo', topic: 'floodfill',
      term: { de: 'Flood-Fill', en: 'Flood fill' },
      alias: 'Wasserwelle Fluten kuerzester Weg shortest path GO',
      text: { de: 'Wasser ins Ziel gie\u00dfen und z\u00e4hlen, wie viele Schritte es bis zu jedem Feld braucht. Dann immer bergab laufen.',
              en: 'Pour water into the goal and count how many steps it takes to reach every cell. Then always walk downhill.' },
      where: { de: 'Befehl GO im Labyrinth-Modus. Sieht er eine neue Wand, flutet er neu.',
               en: 'Command GO in maze mode. When it sees a new wall, it floods again.' },
      links: ['algorithmus', 'rechtehand', 'variable'],
      fig: () => {
        const v = [[3, 2, 3, 4], [2, 1, 2, 5], [1, 0, 3, 4], [2, 1, 2, 3]];
        let s = '';
        for (let r = 0; r < 4; r++) for (let c = 0; c < 4; c++) {
          const n = v[r][c];
          s += '<rect x="' + (52 + c * 24) + '" y="' + (6 + r * 24) + '" width="24" height="24" style="fill:hsl(208 70% ' + (34 + n * 9) + '%);--d:' + n + '" class="a-wave"/>' +
            '<text x="' + (64 + c * 24) + '" y="' + (23 + r * 24) + '" text-anchor="middle" class="tw ts0">' + n + '</text>';
        }
        return s + '<path d="M52 6 H148 V102 H52 Z M100 30 V54 M76 78 H124" class="r" stroke-width="3" style="fill:none"/>';
      },
    },
  ];

  root.RLData = { TEXT, TOPICS, CATS, LEX };
})(typeof window !== 'undefined' ? window : globalThis);
