# RatRocket im Unterricht – Curriculum

Für Lehrkräfte und für das RatRocket-Team. Stand: November 2026.

RatRocket ist ein Klassen-Roboter (offener Bausatz, gebaut mit dem KoLab Makerspace Koblenz)
mit der Browser-Software **RatRocket Code** (`web/code.html`, Chrome oder Edge, offline). Das
Kernversprechen: **Erst simulieren, dann fahren.** Ein Programm wird in der Simulation
getestet und läuft danach *unverändert* auf dem echten Roboter – dort entscheiden seine
Sensoren.

## Auf einen Blick

- **8 Wochen, 16 Stunden à 45 Minuten** (zwei Einzelstunden oder eine Doppelstunde pro Woche).
  Mit drei Wochenstunden oder in der AG kommen die **Plus-Stunden** P1–P4 dazu.
- **Wochen 1–5 sind vollständig mit der heutigen Software unterrichtbar.** Wochen 6–8 auch –
  aber teils mit getippten Roboter-Befehlen auf einer englischen Testseite, unplugged oder als
  Lehrkraft-Demo. Mit den **geplanten** Funktionen werden diese Wochen zu Hands-on-Stunden und
  der Kurs wächst um den **Ausbau** P5–P9 auf etwa 11 Wochen.
- **Alter:** Kern 10–14 (Blockebene). Module 1–3 funktionieren ab 8. Modul 10 führt bis in die
  Oberstufe und Hochschule (Micromouse, C-Firmware).
- **Für schnelle Köpfe:** Jede Stunde hat eine *wirklich schwere* Knobelaufgabe; dazu laufen
  eine Rekordtafel, ein Turnier und das Entdeckerheft durch den ganzen Kurs.

## Die Leiter: Vom ersten Baustein zum eigenen Spielzeug

```
 Sprosse                                  wo                Roboter-Seite   Oberfläche
 6  Eigenes Spielzeug                     Woche 8 (+11)     verfügbar       freies Baufenster: geplant
 5  Regeln: PID nach Gefühl, dann benannt Woche 6           verfügbar       PID-Panel: geplant
 4  Motoren: Umdrehung, Pulse, PWM        Woche 6           verfügbar       Motor-Panel: geplant
    ... die Bausteine werden mächtiger:   Woche 3-8         verfügbar       Variablen: verfügbar; Listen: geplant
        Schleifen, Sensoren, Wandfolger,
        Turnier, Karten, Zahlenflut
 3  Bluetooth einstecken, fernsteuern     Woche 2           verfügbar       verfügbar (Fernsteuerung)
 2  Der Roboter als Maschine: Modi        Woche 2           verfügbar       Testseite (englisch)
 1  Bausteine, Drehen, Reihenfolge        Woche 1           verfügbar       verfügbar (Aufgaben 1-9)
```

| Sprosse | Die Kinder … | Roboter-Seite | Oberfläche |
|---|---|---|---|
| 1 | bauen Programme aus Bausteinen, testen sie in der Simulation, fahren sie echt | verfügbar (`CELL`, `TURN`, `WALLS`) | verfügbar: RatRocket Code |
| 2 | legen DIP-Schalter um, starten neu und erkennen den Modus | verfügbar (5 Modi, Start-Meldung, `DIP` live) | heute Testseite; deutsche Roboter-Info **geplant** |
| 3 | stecken das Bluetooth-Modul selbst ein und steuern den Roboter fern | verfügbar (`FWD`, `TURN`, `STOP`, `SPD`) | verfügbar: Fernsteuerung `web/drive.html` (Steuerkreuz) |
| 4 | messen Pulse pro Umdrehung, stellen PWM ein, ändern die Drehrichtung | verfügbar (Motor-Test: `PWM`, `JOG`, `SWEEP`, `ENC`) | heute Befehle tippen; Motor-Panel **geplant** |
| 5 | stellen Regler erst nach Gefühl, dann mit P, I, D und Schwellen ein | verfügbar (PID-Test: `KP`, `KI`, `KD`, `TEL`; `THR`) | heute Befehle tippen; PID-Panel/Werkstatt **geplant** |
| 6 | erfinden ein Spielzeug für andere und zeigen es auf einer Mini-Messe | verfügbar, was Fahren und Sensoren angeht | heute Aufgabe 7; freies Baufenster **geplant** |

## Modulkarte

| Nr. | Modul | Bogen / Sprosse | Alter | Stunden | Woche | Software |
|---|---|---|---|---|---|---|
| 1 | [Erste Schritte](modul-1-erste-schritte.md) | A · 1 | 8–12 | 2 | 1 | verfügbar |
| 2 | [Der Roboter als Maschine](modul-2-roboter-als-maschine.md) | 2 · 3 | 9–14 | 2 | 2 | verfügbar (Fernsteuerung `web/drive.html`) |
| 3 | [Schleifen und Vorausdenken](modul-3-schleifen.md) | B · 1 | 8–13 | 1 (+P1) | 3 | verfügbar |
| 4 | [Sensoren und Entscheidungen](modul-4-sensoren.md) | C · 1 | 9–14 | 1 (+P2) | 3 | verfügbar |
| 5 | [Raus hier! Wandfolger und Turnierwoche](modul-5-raus-hier.md) | D · 1 | 10–14 | 4 | 4–5 | verfügbar |
| 6 | [Werkstatt: Motoren, Messen, Regeln](modul-6-werkstatt.md) | E · 4 · 5 | 11–16 | 2 (+P3) | 6 | Roboter verfügbar; Werkstatt, Panels, parametrische Bausteine, Gyro geplant |
| 7 | [Karten und Gedächtnis](modul-7-karten-und-gedaechtnis.md) | F | 11–15 | 1 (+P4) | 7 | Unplugged, Roboter-Karte und Variablen (Aufgabe 8, 9) verfügbar; Listen geplant |
| 8 | [Flood-Fill: der kürzeste Weg](modul-8-flood-fill.md) | G | 11–18 | 2 (+P5–P7) | 7–8 (+9–10) | Unplugged und `GO`/`GOTO` verfügbar; selbst bauen geplant |
| 9 | [Dein eigenes Spielzeug](modul-9-eigenes-spielzeug.md) | 6 | 10–16 | 1 (+P8–P9) | 8 (+11) | heute mit Aufgabe 7; freies Baufenster, Programme auf dem Roboter geplant |
| 10 | [Wettbewerb und Forschung](modul-10-wettbewerb-und-forschung.md) | H | 15–Hochschule | Projekt, 6–10 Doppelstunden | Anschluss | Klassen-Micromouse und C-Firmware verfügbar; Textprogrammierung geplant |

## Wochenplan

| Woche | Stunde | Thema | Software, Aufgabe | Roboter | Stand |
|---|---|---|---|---|---|
| 1 | 1 | Roboter tun genau, was man sagt | unplugged, Aufgabe 1 | Lehrkraft-Demo | verfügbar |
| 1 | 2 | Um die Ecke – und dann in echt | Aufgabe 2 | jedes Team (USB-C) | verfügbar |
| 2 | 3 | Schalter, Modi, Neustart | Testseite | jedes Team | verfügbar |
| 2 | 4 | Bluetooth einstecken und fernsteuern | Fernsteuerung (`web/drive.html`) | jedes Team | verfügbar |
| 3 | 5 | Muster erkennen: `wiederhole`; Labyrinth-Post | Aufgabe 3, 7 | optional | verfügbar |
| 3 | 6 | Die Augen des Roboters, Sensor-Labor | Aufgabe 4 | Stationen | verfügbar |
| 4 | 7 | Die rechte Hand an der Wand | Aufgabe 5 | Station | verfügbar |
| 4 | 8 | Ein Programm für alle Labyrinthe | Aufgabe 6, 7 (Zufall, Insel) | Station, umgebaut | verfügbar |
| 5 | 9 | Turnier I: Bauen und Qualifizieren | Aufgabe 7, Dateien | – | verfügbar |
| 5 | 10 | Turnier II: Escape-Cup, Golf-Duell, Finale | Aufgabe 5, 7 | Finale | verfügbar |
| 6 | 11 | Motoren: Umdrehung, Pulse, PWM | Motor-Test, Testseite | jedes Team | Roboter verfügbar, Panel geplant |
| 6 | 12 | Regeln: PID nach Gefühl, dann mit Namen | PID-Test, Testseite | jedes Team | Roboter verfügbar, Panel geplant |
| 7 | 13 | Der Roboter als Kartograf | unplugged, `GO` | Lehrkraft-Demo | verfügbar |
| 7 | 14 | Die Zahlenflut | unplugged | – | verfügbar |
| 8 | 15 | Der Roboter rechnet selbst | Aufgabe 7, `GO`/`GOTO` | Demo | verfügbar |
| 8 | 16 | Spielzeug-Werkstatt und Mini-Messe | Aufgabe 7, Befehle | Teams | verfügbar; Baufenster geplant |
| Plus | P1–P4 | Golf und Fahrzeit · Sensoren entscheiden · Drehen kalibrieren · Brotkrumen, Variablen | Aufgabe 3, 4, 7, 8, 9 | ja | verfügbar (P4-Listen geplant) |
| Ausbau | P5–P9 | Flut selbst bauen · Projekt im freien Baufenster | – | ja | **geplant** |

**Kürzen auf 12 Stunden:** Stunde 3+4, 9+10, 11+12 und 13+14 jeweils zu einer Stunde
zusammenlegen (Modi als 10-Minuten-Demo, Turnier nur Escape-Cup, Werkstatt nur Pulse und das
PID-Spiel, Kartograf als Einstieg der Zahlenflut). **Doppelstunden:** die Paare 3+4, 9+10, 11+12
und 15+16 sind als 90 Minuten am stärksten.

## Die neun Aufgaben im Kurs

| Aufgabe | Name | Konzept | wo | echter Roboter |
|---|---|---|---|---|
| 1 | Geradeaus | Reihenfolge | Stunde 1 | Demo; ab Stunde 2 jedes Team |
| 2 | Um die Ecke | Drehen | Stunde 2 | jedes Team |
| 3 | Immer im Kreis | Zählschleife | Stunde 5, P1; Drehmessung in P3 | Station |
| 4 | Schau nach vorne | Verzweigung, Sensor | Stunde 6, P2 | Sensor-Labor |
| 5 | Raus hier! | bedingte Schleife, Wandfolger | Stunde 7–10, Finale | Station, Turnier-Finale |
| 6 | Drei Labyrinthe | ein Programm für alle | Stunde 8, Turnier-Qualifikation | Station; nach jedem Labyrinth wartet die Software auf **Weiter** (umbauen) |
| 7 | Eigenes Labyrinth | Entwerfen, Testen, Tauschen | Stunde 5, 8, 9–10, 15, 16 und viele Knobelaufgaben | bis 5 × 5 |
| 8 | Zähl mit! | Variable: mitzählen | P4 (Woche 7) | Station |
| 9 | Genau 5 | Variable steuert die Schleife (`wiederhole bis`) | P4 (Woche 7) | Station; wartet wie Aufgabe 6 auf **Weiter** |

Wer die neun Aufgaben an einem Tag knackt, ist nicht fertig: Ab Stunde 5 messen sich alle an
**Rekorden** (wenigste Bausteine, wenigste Fahrzeit-Punkte), lösen **Knobelaufgaben** mit
Beweis-Charakter (z. B. „Warum geht die Ecke im Großen nicht mit 3 Bausteinen?"), entwerfen
**Labyrinthe für andere** (Labyrinth-Post, Schurken-Preis) und treten im **Turnier** gegen
unbekannte Labyrinthe an.

## Drei Fäden durch alle Wochen

1. **Knobelaufgaben** in jeder Stunde – Block-Golf, Blindflug (erst Programm, dann einmal
   ansehen), „Programm fest, Labyrinth gesucht", Beweise, Messrätsel. Bestwerte stehen in
   [anhang-turnier.md](anhang-turnier.md).
2. **Entdeckerheft:** jede Stunde Vorhersage – Beobachtung – Erklärung. Unterschiede zwischen
   Simulation und echtem Roboter sind *Funde*: Sie wandern an die **Unterschiede-Wand** und
   werden in Woche 6 zur Tagesordnung der Werkstatt. Vorlagen: [anhang-entdeckerheft.md](anhang-entdeckerheft.md).
3. **Turniere:** Labyrinthe und Programme werden als Dateien getauscht (**Speichern**/**Öffnen**).
   Escape-Cup, Golf-Duell im K.-o.-System, Schurken-Preis, Finale am echten Roboter hinter dem
   Sichtschutz – Regeln und Bögen in [anhang-turnier.md](anhang-turnier.md).

## Ausstattung und Annahmen

- **Je Team (2–4 Kinder):** ein Roboter, ein Laptop oder Chromebook mit **Chrome oder Edge**,
  ein HC-05-Bluetooth-Modul (wird in Stunde 4 eingesteckt), ein USB-C-Kabel, Strom für den
  Roboter (Akku oder Powerbank, je nach Bausatz), ein Klötzchen (Räder in der Luft).
- **Je Klasse:** mindestens zwei Tisch-Labyrinthe, 3 × 3 bis 5 × 5 Felder à **16 cm**, mit losen
  Wandstücken (fest, gerade, höher als die Sensoren); nicht bündig an die Tischkante.
  Malerkrepp für ein Boden-Raster, Lineal/Maßband, Winkelscheibe (Kopie), Pappschirm, Stoppuhr,
  USB-Stick oder Schul-Plattform für Dateien.
- **Software:** `web/code.html` (RatRocket Code), `web/drive.html` (Fernsteuerung) und
  `web/maze_event.html` (Testseite, englisch) – offline vom USB-Stick lauffähig. Als Beamer- und Stationsmaterial die **Erklär-Seiten**
  `web/learn.html` zu PID, Pulsen/Encoder, PWM, Ultraschall und Flood-Fill (**im Aufbau – Stand
  November 2026**).
- **Kopien:** Befehlskarten, Entdeckerheft-Seiten, Arbeitsblatt Flut-Labyrinth A, Turnierbögen.

## Technik-Check vor dem Kurs (Makerspace oder Lehrkraft, einmalig)

1. Jeden Roboter kalibrieren und speichern (Checkliste in `docs/firmware.md`, Abschnitt
   *Calibration checklist*; danach `SAVE`).
2. Jedem Roboter einen **eigenen Bluetooth-Namen** geben und einen Aufkleber mit demselben Namen
   aufkleben (sonst heißen alle „RatRocket").
3. Labyrinth-Modus einstellen: **SW3 an, SW1 und SW2 aus**, Reset.
4. `web/code.html?selftest=1` im Schul-Browser öffnen: Der Fenstertitel muss `SELFTEST PASS` zeigen.
5. Je eine Testfahrt Aufgabe 1 per USB-C und per Bluetooth. Auf Chromebooks ist USB-C der
   sichere Weg; Bluetooth bitte vorab ausprobieren.

## Kennzeichnung und Software-Stand

- **verfügbar** – heute im Repository vorhanden und erprobt.
- **geplant – Stand November 2026** – noch nicht gebaut: Werkstatt (Kalibrier-Werkstätten
  Strecke, Drehung, PID, Gyro), parametrische Bausteine (cm, Grad, Tempo), Listen und eigene
  Funktionen, Textprogrammierung, Programme auf dem Roboter, freies Baufenster, Motor- und
  PID-Panel, deutsche Roboter-Info. (Variablen und die Fernsteuerung sind inzwischen
  **verfügbar**.)
- **im Aufbau – Stand November 2026** – die Erklär-Seiten `web/learn.html`.
- Geprüft gegen den Software-Stand vom 11.11.2026: Alle Aufgaben starten im Feld unten links
  mit Blick nach oben; Aufgabe 7 hat die Werkzeuge **Wände**, **Start**, **Ziel**, **Größe**
  (Simulation bis 32 × 32, echter Roboter bis 5 × 5), **Leeren** und **Zufall**. Die Übungen
  sagen immer ausdrücklich, wo der Roboter startet. Wo die Software von diesem Text abweicht,
  gilt die Software; die technische Beschreibung steht in `docs/code-editor.md`.
- Koordinaten wie in Software und Firmware: Feld (x, y), (0,0) unten links, x nach rechts,
  y nach oben; „oben" am Bildschirm ist Norden.

## Bezug zu Bildungsstandards

Der Kurs passt zum Kompetenzbereich **5.5 „Algorithmen erkennen und formulieren"** der
KMK-Strategie *Bildung in der digitalen Welt* und zu den **GI-Bildungsstandards Informatik**
(Inhaltsbereiche *Algorithmen* und *Informatiksysteme*; Prozessbereiche *Modellieren und
Implementieren* sowie *Begründen und Bewerten*). Die Werkstatt-Wochen verbinden das mit
Mathematik (Kreisumfang, Dreisatz, Mittelwert) und Physik (Schall, Reibung, Regelung).

## Für das RatRocket-Team: was den Kurs am meisten erweitert

1. **Listen und eigene Funktionen** (ein günstiger erster Schritt: Karten-Bausteine wie
   „Zahl vorne") – macht Woche 7 ganz zur Hands-on-Woche und schaltet den Ausbau P5–P7 frei
   (etwa **+2 Wochen**); ohne sie können Kinder unter 15 die Zahlenflut nicht selbst bauen.
   **Variablen sind erledigt** (November 2026): `setze`, `ändere`, `zeige`, Vergleiche in
   `wenn` und `wiederhole bis`, Aufgaben 8 und 9.
2. **Freies Baufenster und Programme auf dem Roboter** – schaltet P8–P9 frei (**+1–2 Wochen**)
   und macht das Abschlussprojekt und die Klassen-Micromouse autonom.
3. **Werkstatt-Oberfläche mit Motor-Panel und PID-Panel** (Roboter-Seite existiert) – macht
   Woche 6 für 11- bis 13-Jährige ohne Tippen machbar; + Gyro-Werkstatt (braucht Hardware).
4. **Deutsche Roboter-Konsole/Kartenansicht im Editor** (`GO`, `GOTO`, Karte, Modus-Info) –
   ersetzt die englische Testseite in Stunde 3, 13 und 15.
5. ~~Fernsteuer-Seite~~ – **erledigt** (November 2026): `web/drive.html` „Fernsteuerung";
   Stunde 4 nutzt sie.
6. **Textprogrammierung** – öffnet Modul 10 für Schulen ohne C-Toolchain.
7. ~~Kleinigkeiten mit großer Wirkung~~ – **erledigt** (November 2026): Felder-/Drehungen-Zähler
   nach jedem Lauf (Turnier-Wertung), Aufgabe 6 wartet im Roboter-Modus auf **Weiter**, eigene
   Meldung „Der Roboter antwortet nicht – Verbindung prüfen.", Aufgabe 3 lässt die Abkürzung
   ohne Schleife nicht mehr gewinnen.

## Dateien in diesem Ordner

| Datei | Inhalt |
|---|---|
| `README.md` | diese Übersicht |
| `modul-1-erste-schritte.md` … `modul-10-wettbewerb-und-forschung.md` | je ein Modul mit Lernzielen, Stundenbildern, Knobelaufgaben, Differenzierung, Fehlern, Bewertung, Hintergrund |
| `anhang-turnier.md` | Turnierformate, Regeln, Bögen, Turnierbaum, Rekordtafel, Bestwerte |
| `anhang-entdeckerheft.md` | Vorlagen und Impulse für das Entdeckerheft, Bewertungsraster |
| `anhang-begriffe.md` | Glossar Deutsch – Englisch mit kindgerechten Erklärungen |

## English summary

This folder holds the teaching curriculum for RatRocket, an open-core classroom robot built
with KoLab Makerspace Koblenz. The core promise is *simulate first, then drive*: pupils build a
block program in RatRocket Code (`web/code.html`), test it in the simulator, then run the
identical program on the real robot, where its ultrasonic sensors decide. The curriculum is an
8-week course (16 lessons of 45 minutes, ages 10–14, with entry from age 8 and an upper track
to sixth form and university) organised as a learning ladder "from the first block to your own
toy": sequences, the robot as a machine (DIP modes, Bluetooth, remote control), loops, sensors,
the right-hand wall follower with a file-based class tournament, a workshop on motors, PWM and
PID, maps and memory, flood fill (unplugged, then the robot's built-in solver via `GO`/`GOTO`),
and a final toy project. Weeks 1–5 run entirely on today's software; weeks 6–8 run today with
typed robot commands, unplugged activities and teacher demos, and become hands-on once the
planned features land (Werkstatt, motor/PID panels, lists and own functions, free-build window,
programs stored on the robot). Variables (tasks 8 and 9) and the remote-control page
(`web/drive.html`) are already available. Every lesson has a genuinely hard challenge tier, an explorer
journal entry and a record board, so fast learners stay engaged for the full eight weeks.
Everything not yet built is labelled "geplant – Stand November 2026".
