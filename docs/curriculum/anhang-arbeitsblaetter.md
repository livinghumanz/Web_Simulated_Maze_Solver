# Anhang – Arbeitsblätter zum Ausdrucken

Alle Kopiervorlagen, die die Stundenbilder nennen, liegen als druckfertige A4-Seiten in
`web/print/` (**verfügbar**, Stand November 2026). Übersicht im Browser: `web/print/index.html`.
Jedes Blatt hat ein oder zwei Seiten, ist schwarz-weiß lesbar (Wände als dicke Linien,
Tabellen mit Linien, keine Flächenfarben nötig) und braucht weder Internet noch Schriften aus
dem Netz.

## Drucken

1. Blatt in **Chrome oder Edge** öffnen (Doppelklick auf die Datei oder über `index.html`).
2. Oben auf **Drucken** klicken (oder Strg+P).
3. Papier **A4**, Ränder **Standard**, Skalierung **Standard / 100 %**.
   **Hintergrundgrafiken** sind nicht nötig. Kopf- und Fußzeilen des Browsers ausschalten.
4. Zweiseitige Blätter: Seite 2 ist bei *Rechte-Hand-Regel* und *Zahlenflut* die **Lösung** –
   für die Kinder nur Seite 1 drucken („Seiten: 1“).

Die Seitenzahlen unten sind mit Edge (Druck als PDF, A4, Standardränder) geprüft.

## Zuordnung Blatt → Stunde

| Blatt | Modul · Stunde | Datei | Seiten | Wofür |
|---|---|---|---|---|
| Befehlskarten: Mensch-Roboter-Spiel | 1 · Stunde 1 | `m1-befehlskarten.html` | 2 | 12 Karten zum Ausschneiden je Paar (6 × ▲ `fahre 1 Feld`, 3 × ↷ `drehe nach rechts`, 3 × ↶ `drehe nach links`), Spielregeln; Seite 2 die Stern-Karte A4 |
| Modus-Detektiv | 2 · Stunde 3 | `m2-modus-detektiv.html` | 1 | DIP-Bilder für Zahl 0–5, Spalten für die erste Zeile nach `HELP` und einen ausprobierten Befehl; Binär-Detektiv, Rad-Zähler (3 Messungen), Abhaken „zurück in den Labyrinth-Modus“ |
| Knopfkarte Fernsteuerung | 2 · Stunde 4 | `m2-knopfkarte.html` | 1 | Steuerkreuz und Tabelle Knopf → Befehl (`FWD 160`, `TURN ±90`, `VRUN`, `STOP`), Befehlskarte für Profis, Parcours-Protokoll |
| Block-Golf und Fahrzeit | 3 · Stunde 5, P1 | `m3-block-golf.html` | 2 | Eigene Rekorde (Bausteine, Felder, Drehungen, Fahrzeit-Punkte 10/8) für Aufgabe 1–5, Labyrinth-Post mit Erbauer-Rekord; Seite 2 die **Rekordtafel** der Klasse (auf A3 vergrößern) |
| Sensor-Labor: Wie weit sieht der Roboter? | 4 · Stunde 6 | `m4-sensor-labor.html` | 2 | Messprotokoll: 5/10/15/20 cm, Schwelle auf 1 cm eingrenzen, Stoff/schräg/Hand, Seitensensoren, Klassenvergleich der Schwellen |
| Rechte-Hand-Regel: Fahr den Weg nach | 5 · Stunde 7–8 | `m5-rechte-hand.html` | 2 | Regel in Worten und als 7-Baustein-Programm; die drei Labyrinthe aus Aufgabe 5/6 mit Bleistift abfahren, Felder × 10 + Drehungen × 8; Seite 2 **Lösung** (5/3/74, 5/3/74, 5/2/66) und der Stern auf der Insel |
| Turnier: Schiedsrichter-Bogen | 5 · Stunde 9–10 | `m5-turnierbogen.html` | 2 | Escape-Cup-Bogen je Labyrinth (raus 3, sonst 0, Bonus +1; Meldungen A/E/L), Seite 2 Golf-Duell-Turnierbaum für 8 Teams und Gesamtwertung – Regeln wie in [anhang-turnier.md](anhang-turnier.md) |
| Werkstatt: Pulse und PWM | 6 · Stunde 11 | `m6-pulse-pwm.html` | 2 | Motor-Test (nur SW2): `ENC0`/`ENC` dreimal, `JOG L 1000`, Anlauf-Schwelle mit `PWM … 0 2000`, Richtung mit `PWM -400 0 2000`, `SWEEP`-Tabelle mit Diagramm, Hörprobe `PWMFREQ`, Rechnen |
| Regeln: PID nach Gefühl | 6 · Stunde 12 | `m6-pid-gefuehl.html` | 2 | PID-Test (SW1 + SW2): `GAINS`, drei Drehknöpfe `KP`/`KI`/`KD` mit `FWD 300` und Endfehler aus `[EV] DONE … final err`; Seite 2 P/I/D zuordnen, `TEL 100`-Zeile lesen, „sanft“ und „sportlich“ |
| Winkelscheibe: Drehen messen | 6 · Plus-Stunde P3 | `m6-winkelscheibe.html` | 1 | Winkelscheibe 0–360° in 5°-Schritten mit Mittelpunkt (rechts herum = +), Messtabelle 3 Runden, Spurbreiten-Formel |
| Kartograf: Der Roboter merkt sich Wände | 7 · Stunde 13 | `m7-kartograf.html` | 2 | Kartograf-Spiel zu dritt: Zug-Protokoll, zwei Punkt-Raster (Wand / frei / unbekannt); Seite 2 Log-Detektiv mit den `[CELL]`-Zeilen und dem `MAP`-Ausdruck aus Modul 7, Speicher-Rechnung |
| Die Zahlenflut: Flut-Labyrinth A | 8 · Stunde 14 (15) | `m8-zahlenflut.html` | 2 | Regeln, Aufwärm-Beispiel 3 × 3, Flut-Labyrinth A groß zum Hineinschreiben, Vorhersage und Weg; Seite 2 **Lösung** mit allen Zahlen, Weg (6 Felder), Wettrennen Flut 100 gegen rechte Hand 172 Fahrzeit-Punkte |
| Entdeckerheft | jede Stunde | `entdeckerheft-seite.html` | 2 | Seite „Vorhersage – Beobachtung – Erklärung“ mit Skizzenfeld; Seite 2 „Simulation gegen echten Roboter“ (Unterschiede-Wand) und „Meine Rekorde“ – Vorlagen aus [anhang-entdeckerheft.md](anhang-entdeckerheft.md) |

Das Messprotokoll aus dem Entdeckerheft steckt in den Blättern *Sensor-Labor* und *Pulse und
PWM*. Die Karte „Drei Drehknöpfe“ (Modul 6) ist Teil von *PID nach Gefühl*, die Regel-Karte der
rechten Hand (Modul 5) Teil von *Rechte-Hand-Regel*.

## Was geprüft ist

- Block-Namen und Zeichen genau wie in RatRocket Code (`web/code-data.js`).
- Roboter-Befehle nur aus der Firmware: Labyrinth-Modus laut `docs/firmware.md`; Motor-Test
  (`PWM`, `JOG`, `SWEEP`, `PWMFREQ`, `ENC`/`ENC0`) und PID-Test (`KP`, `KI`, `KD`, `GAINS`,
  `FWD`, `TEL`) laut den Hilfetexten in `app_motor_test.c` und `app_pid_test.c`.
- Die Labyrinthe sind die aus den Modulen; Wege, Fahrzeit-Punkte und Flut-Zahlen wurden
  nachgerechnet (rechte Hand Aufgabe 5: 5 Felder, 3 Drehungen, 74; Flut-Labyrinth A: Start 6,
  Sackgasse 7, rechte Hand 10 Felder/9 Drehungen = 172).
- Lösungsseiten tragen oben rechts „Lösung“ statt der Namenszeilen.

Die Blätter sind statisches HTML mit einer gemeinsamen Stildatei `web/print/print.css`
(Seitenformat `@page` A4, Ränder 14/14/16 mm, Seitenumbruch je `<section class="sheet-page">`)
und einem kleinen Skript `web/print/print.js` (Drucken-Knopf; meldet sich in einem `iframe` dem
Selbsttest der Lernseite). Änderungen direkt in der jeweiligen Datei; danach die Seitenzahl
mit der Druckvorschau prüfen und hier und in `index.html` angleichen.

## English summary

`web/print/` holds 13 print-ready A4 worksheets for the RatRocket course (one or two pages
each, black-and-white friendly, offline, no web fonts required), listed by module in
`web/print/index.html`: command cards for the human-robot game (module 1), mode detective and
remote-control button card (module 2), block golf and the class record board (module 3), the
sensor lab log (module 4), the right-hand-rule trace sheet with answer key and the tournament
referee sheet, bracket and overall score (module 5), the pulses/PWM log, the PID-by-feel
record sheet and the angle disc (module 6), the map-maker sheet with the robot's real log
lines (module 7), the flood-fill worksheet "Flut-Labyrinth A" with answer key (module 8), and
the explorer journal templates. Print from Chrome or Edge at A4 with default margins;
background graphics are not needed. Block names match the editor exactly; robot commands come
from the firmware; maze paths and flood numbers were recomputed and checked against the
curriculum.
