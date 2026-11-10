# Modul 10 – Wettbewerb und Forschung (Anschluss: Oberstufe, AG, Hochschule)

**Nach dem 8-Wochen-Kurs · Projekt mit 6–10 Doppelstunden · ab etwa 15 Jahren bis Hochschule · Bogen H**
**Software:**
- Klassen-Micromouse mit der eingebauten Zahlenflut (`GO`, `GOTO`, Einstellbefehle) – **verfügbar**
  über das Befehlsfeld der Testseite `web/maze_event.html` oder ein serielles Terminal.
- Eigene Algorithmen im C-Code der Firmware, bauen, per USB-C aufspielen (UF2) – **verfügbar**
  (braucht die ARM-Toolchain, siehe `README.md` im Repository).
- **Geplant – Stand November 2026:** Textprogrammierung im Editor („eigener Algorithmus: erst
  Simulator, dann Hardware" ohne C-Toolchain) und Programme, die auf dem Roboter gespeichert
  werden.

Hier wird aus dem Klassenroboter ein Forschungsgerät. Drei Wege, die sich kombinieren lassen:
ein Wettbewerb nach Micromouse-Vorbild mit den Bordmitteln, eigene Algorithmen im Code und
offene Forschungsfragen mit Messungen.

## Lernziele

Die SuS bzw. Studierenden können …

1. einen Wettbewerb nach Regeln vorbereiten: kalibrieren, Parameter abwägen (Tempo gegen
   Sicherheit), Strategie wählen (wie viel erkunden vor dem Schnelllauf?),
2. fremden Quellcode lesen, Algorithmus und Datenstrukturen benennen (Breitensuche,
   Warteschlange, Karte mit drei Zuständen) und gezielt ändern,
3. eine Änderung erst gegen ein Modell (Simulation, Papier) und dann auf der Hardware testen
   und die Abweichung erklären,
4. eine Forschungsfrage mit messbarer Größe formulieren, ein Experiment mit Wiederholungen
   durchführen und die Ergebnisse darstellen.

## Weg H1 – Klassen-Micromouse (verfügbar)

**Aufbau:** Tisch- oder Bodenlabyrinth 5 × 5 Felder à 16 cm, Ziel ist das Mittelfeld (2,2),
Start ist das Feld unten links mit Blick nach oben. Das Turnier-Labyrinth wird hinter einem
Sichtschutz gebaut und erst zum Wettbewerb gezeigt.

**Einstellen** (Befehlsfeld, Labyrinth-Modus): `SIZE 5`, `GOAL 2 2`, `CFG` zeigt alles.
Tempo `VRUN <mm/s>` (Standard 80) und `VTURN <mm/s>` (Standard 50), Zentrieren `KC <p> <d>`,
Kalibrierung `CALDIST`, `TRACK`, `TRIM`, Feldgröße `PITCH <mm>`. `SAVE` speichert dauerhaft –
im Projekt erlaubt, aber nur nach Absprache.

**Ablauf je Team (10 Minuten am Turnier-Labyrinth):**
1. **Erkundungslauf:** `GO` – der Roboter sucht das Ziel ohne Karte, fährt nach Hause und druckt
   seine Karte.
2. Optional weitere Erkundung mit `GOTO x y` zu Feldern, deren Wände noch unbekannt sind.
3. **Schnelllauf:** Der Roboter steht nach dem Erkundungslauf wieder auf dem Start und kennt
   seine Blickrichtung – nicht anfassen (wer ihn umsetzt, muss mit `POSE 0 0 N` sagen, wo er
   steht). Dann `GOTO 2 2` – jetzt mit der gelernten Karte. Zeit von der Eingabe bis
   `[MAZE] ARRIVED` (Stoppuhr).

**Wertung:** bester Schnelllauf. Berühren des Roboters während eines Laufs macht den Lauf
ungültig. Zweite Wertung: wenigste Felder im Erkundungslauf.

**Strategie-Fragen, die den Wettbewerb spannend machen:** Lohnt mehr Erkundung? Wie schnell
darf `VRUN` sein, bevor Drehungen ungenau werden und der Roboter Wände falsch sieht? Was kostet
eine schlechte Kalibrierung?

## Weg H2 – Algorithmen im C-Code (verfügbar, Oberstufe/Hochschule)

**Code-Rundgang** (alle Dateien in `Core/Src/`):

| Datei | Was man dort findet |
|---|---|
| `costAlgorithm.c` | `propagateCost` – die Zahlenflut als Breitensuche mit Warteschlange; `smallestNextNeighbourCell` – wählt den Nachbarn mit kleinster Zahl, bei Gleichstand geradeaus |
| `maze.c` | Karte (`WALLS`), drei Wand-Zustände, `initWalls`, `isCellAccessible` |
| `maze_run.c` | `run_to`: messen → Karte eintragen → fluten → wählen → drehen → ein Feld fahren; `Maze_Escape`: die Rechte-Hand-Regel; `set_wall`: eine bekannte Wand ändert sich erst nach zwei widersprechenden Messungen |
| `motion.c` | 1-kHz-Regelung je Rad (PID, Vorsteuerung, Anlauf-Zuschlag) |
| `ultrasonic.c` | Ultraschall-Treiber, Median mehrerer Messungen |

**Bauen und aufspielen:** Bauen mit CMake (siehe `README.md` und `docs/firmware.md`); jeder
Build schreibt `ratrocket.uf2`. Zum Aufspielen den Roboter per USB-C anschließen, `UPDATE`
senden (oder laut `docs/firmware.md` zweimal schnell Reset drücken – am eigenen Roboter vorab
ausprobieren): Es erscheint ein USB-Laufwerk **RATROCKET**; die Datei darauf kopieren, nach
etwa 2 Sekunden startet das neue Programm. Gespeicherte Einstellungen bleiben erhalten. Die
Wiederherstellung mit ST-Link bleibt Sache der Lehrkraft bzw. des Makerspace.

**Aufgaben (aufsteigend):**
1. Beim Gleichstand lieber die Richtung mit **weniger Drehungen** wählen. Messen: Felder und
   Zeit im Schnelllauf vorher/nachher.
2. **Gewichtete Flut:** Eine Drehung kostet extra (wie die Fahrzeit-Punkte im Kurs). Aus der
   Breitensuche wird ein Verfahren mit Prioritäten (Dijkstra).
3. **Erkunden gegen Schnelllauf:** Im Erkundungslauf gilt „unbekannt = frei" (optimistisch),
   für den Schnelllauf wäre „unbekannt = Wand" sicherer. Achtung: Die Namen in `maze.h`
   (`MASK_TREAT_AS_PRESENT`, `MASK_TREAT_AS_ABSENT`) sind irreführend – mit der derzeitigen
   Bitmaske werden ungesehene Wände tatsächlich als *frei* behandelt. Sauberen Umschalter
   bauen und beide Läufe vergleichen.
4. **Vollständige Erkundung:** Erst alle erreichbaren Felder besuchen, dann schnell fahren.
   Lohnt sich das in 5 × 5?
5. **Robustheit:** Wie viele falsche Sensor-Messungen verträgt die Karte? Fehler absichtlich
   einbauen (z. B. jede zehnte Messung kippen) und die Zwei-Messungen-Regel bewerten.

**Erst Modell, dann Hardware:** Jede Änderung zuerst auf Papier (Zahlenflut von Hand) oder im
firmware-eigenen Simulationsmodus prüfen (`simulator.c` mit fest eingebautem Labyrinth,
Compile-Schalter `ENABLE_SIMULATION`) – dieser Modus ist vorhanden, aber für den Unterricht
nicht aufbereitet. **Geplant:** dieselbe Arbeit als Textprogramm im Editor, mit Simulator und
anschließend unverändert auf dem Roboter – ohne C-Toolchain.

## Weg H3 – Offene Forschungsfragen (verfügbar)

- Wie genau sind 10 Felder geradeaus – vor und nach `CALDIST`? (Mittelwert, Streuung, 10 Läufe)
- Ab welchem `VRUN` steigt die Fehlerquote im Escape-Lauf? (Erfolgsquote gegen Tempo)
- Warum ergeben sich in der Luft rund 2500 Pulse pro Umdrehung, auf dem Boden 2874?
  (Hypothesen trennen: Reifen, Schlupf, Zählfehler – siehe Modul 6)
- Rechte Hand gegen Zahlenflut auf 20 **Zufall**-Labyrinthen in Aufgabe 7: Felder bis zum Ziel,
  Verteilung, Ausreißer.
- Welche Wandmaterialien „sieht" der Ultraschall zuverlässig? (Holz, Pappe, Schaum, Stoff;
  Winkel 0–45°)
- Wie gut hält der Roboter die Mitte des Ganges? (`KC` variieren, seitliche Abweichung messen)

## Stundenskizze (6 Doppelstunden, anpassbar)

| DS | Inhalt |
|---|---|
| 1 | Wettbewerbsregeln, Kalibrier-Checkliste aus `docs/firmware.md` durchgehen, erste `GO`-Läufe |
| 2 | Code-Rundgang, Zahlenflut im Code wiederfinden, Protokollzeilen dem Code zuordnen |
| 3 | Erste Code-Änderung (Aufgabe 1), bauen, aufspielen, messen |
| 4 | Eigene Aufgabe oder Forschungsfrage: Plan, Messreihe |
| 5 | Messen, auswerten, verbessern |
| 6 | Klassen-Micromouse-Turnier und Poster-Präsentation |

## Differenzierung

- **Unterstützung:** nur Weg H1 (Parameter statt Code); feste Messvorlagen; Tandems aus
  Programmier- und Mess-Expertinnen.
- **Herausforderung:** H2 Aufgaben 2–5; größere Labyrinthe (die Firmware kann heute bis 5 × 5;
  mehr Felder erfordern eine Änderung von `MAZE_DIMENSIONS_MAX`); Vergleich mit den Regeln echter
  Micromouse-Wettbewerbe.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| `GO` meldet `goal outside the maze` | `GOAL` passt nicht zu `SIZE` | erst `SIZE`, dann `GOAL` |
| Nach dem Ausschalten sind alle Einstellungen weg | nicht gespeichert | `SAVE` (nach Absprache) |
| Schnelllauf langsamer als erwartet | Karte unvollständig, der Roboter plant unterwegs um | mehr erkunden (`GOTO`) oder Karte mit `MAP` prüfen |
| `[MISMATCH] …` im Log | Messung widerspricht einer bekannten Wand | schräger Blick, Fuge; die Zwei-Messungen-Regel greift |
| Neue Firmware startet nicht | Fehler im Programm | Update-Modus (`UPDATE` bzw. Reset doppelt) und alte `ratrocket.uf2` aufspielen |
| Roboter wird nach `DEFAULTS` ungenau | Kalibrierung gelöscht | Kalibrier-Checkliste neu durchlaufen |

## Bewertungsvorschlag

Forschungs- oder Projektbericht (4–6 Seiten) bzw. wissenschaftliches Poster: Fragestellung,
Methode, Messdaten mit Wiederholungen, Auswertung, Grenzen. Bei Code-Änderungen zusätzlich:
lesbarer Diff mit Begründung, Vorher-Nachher-Messung. Eignet sich als Grundlage für eine
Facharbeit oder Seminarkurs-Arbeit.

## Für die Lehrkraft

Micromouse ist ein Robotik-Wettbewerb, den es seit Ende der 1970er-Jahre gibt: Ein autonomer
Roboter muss in einem unbekannten Labyrinth (klassisch 16 × 16 Felder à 18 cm) den Weg ins
Ziel aus vier Feldern in der Mitte finden – erst erkunden, dann so schnell wie möglich fahren.
RatRocket bildet das im Klassenformat nach (bis 5 × 5, 16 cm). Im deutschen Schulumfeld liegt
der Wettbewerb **RoboCup Junior** mit der Disziplin *Rescue Maze* nahe, in der Roboter
ebenfalls Labyrinthe erkunden. Der wissenschaftliche Kern dieses Moduls ist die Kette **Modell –
Vorhersage – Messung – Erklärung**: Jede Änderung wird erst am Modell durchdacht und dann an
der Hardware gemessen, und Abweichungen sind keine Niederlage, sondern Daten.
