# Modul 3 – Schleifen und Vorausdenken

**Woche 3 · Stunde 5 (+ Plus-Stunde P1) · ab 8 Jahren (Kern: 10–14) · Leiter-Sprosse 1**
**Software: verfügbar** (Aufgabe 3, Aufgabe 7 „Eigenes Labyrinth", Speichern/Öffnen)

Die Kinder entdecken Muster in langen Programmen und fassen sie mit `wiederhole … mal`
zusammen. Ab jetzt zählt nicht nur *ob*, sondern *wie gut* ein Programm ist: die
**Rekordtafel** (wenigste Bausteine, schnellste Fahrzeit) läuft bis zum Kursende mit.
Und sie bauen zum ersten Mal Labyrinthe füreinander.

## Lernziele

Die SuS können …

1. Wiederholungen in einer Befehlsfolge erkennen und mit `wiederhole … mal` zusammenfassen,
2. die nötige Anzahl Wiederholungen bestimmen und begründen,
3. Programme nach Länge (Bausteine) und Fahrzeit (Fahrzeit-Punkte) vergleichen und gezielt verbessern,
4. eine Aufgabe (Labyrinth) für andere entwerfen, als Datei speichern und eine fremde Aufgabe lösen,
5. (Knobel) Schleifen schachteln und begründen, warum eine Lösung nicht kürzer gehen kann.

## Zwei Werkzeuge, die ab jetzt immer gelten

**Rekordtafel:** ein Plakat mit einer Zeile je Aufgabe oder Klassen-Labyrinth: Rekord
(Bausteine), Name, Datum; zweite Spalte Fahrzeit-Rekord. Ein Rekord zählt, wenn er am
Beamer vorgeführt wurde. Vorlage in [anhang-turnier.md](anhang-turnier.md).

**Fahrzeit-Punkte:** jedes gefahrene Feld 10 Punkte, jede Drehung 8 Punkte (auch
`dreh dich um`). So rechnet auch die Simulation: Sie zeigt eine Drehung etwas kürzer als ein
Feld. Weniger Punkte = schneller. Am echten Roboter dauert `dreh dich um` etwa doppelt so lange
wie eine Vierteldrehung – ein Unterschied für die Unterschiede-Wand.

## Stunde 5 – Muster erkennen: `wiederhole`

**Material:** Laptops, Rekordtafel, Entdeckerheft, USB-Stick oder Schul-Plattform für
Dateien; optional ein Tisch-Labyrinth im Aufbau von Aufgabe 3 (vier Wandstücke rund um das
mittlere Feld und eines unten zwischen dem mittleren und dem rechten Feld).
**Simulation / Roboter:** Simulation; Roboter nur als Bonus-Station.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 7 | Tafel: eine lange Lösung für Aufgabe 3 ohne Schleife: `fahre 1 Feld`, `fahre 1 Feld`, `drehe nach rechts`, `fahre 1 Feld`, `fahre 1 Feld`, `drehe nach rechts`, `fahre 1 Feld`, `fahre 1 Feld` (8 Bausteine, 1 Stern). „Was fällt euch auf?" Das Muster „fahre, fahre, drehe nach rechts" kommt dreimal vor. Klatsch-Spiel: „zweimal stampfen, einmal drehen" – wiederholen. |
| Erarbeitung I | 15 | Aufgabe 3 in der Simulation. Neu: `wiederhole 3 mal` hat einen **Bauch**, in den Bausteine gezogen werden; die Zahl lässt sich von 1 bis 9 einstellen. Ziel: 3 Sterne (höchstens 4 Bausteine). Frage an jeden Tisch: „Warum reicht 3, obwohl …?" – Das Programm hält am Stern an, auch mitten in der Schleife. |
| Erarbeitung II | 15 | **Labyrinth-Post:** Aufgabe 7 öffnen, Größe 3 × 3 oder 4 × 4, Werkzeug **Wände** (Linien anklicken) und **Ziel** (Stern setzen). Regel: 1. selbst lösen (beweist: lösbar), Bausteinzahl notieren; 2. alle Bausteine in „Zum Löschen hierher ziehen"; 3. **Speichern**, Datei umbenennen in `team-name-post1.json`; 4. Datei zum Nachbarteam (Stick/Plattform), dort **Öffnen** – das Labyrinth kommt mit. Ziel: die Bausteinzahl der Erbauer schlagen. Ganz ohne Dateien geht es auch: Plätze tauschen. |
| Sicherung | 8 | Merksatz: *Eine Schleife wiederholt die Bausteine in ihrem Bauch. Kürzere Programme sind leichter zu lesen und zu prüfen.* Erste Einträge auf der Rekordtafel. Entdeckerheft. |

Aufgabe 3 „Immer im Kreis" (das Mittelfeld ist rundum zu, und unten trennt eine Wand das
mittlere vom rechten Feld – der einzige Weg zum Stern führt außen herum):

```
      0   1   2
    +---+---+---+
  2 |           |
    +   +---+   +
  1 |   |###|   |
    +   +---+   +
  0 | ^     | * |
    +---+---+---+
```

Erwartetes Programm (4 Bausteine, 3 Sterne):

```
wiederhole 3 mal
    fahre 1 Feld
    fahre 1 Feld
    drehe nach rechts
```

Ohne Schleife braucht der Weg außen herum 8 Bausteine (1 Stern) – die Schleife spart die
Hälfte. Die kurze Abkürzung unten entlang (`drehe nach rechts`, `fahre 1 Feld`,
`fahre 1 Feld`) endet seit November 2026 an der Wand unten: „Autsch …". Fahrzeit des
erwarteten Programms: 6 Felder, 2 Drehungen, **76 Fahrzeit-Punkte** (die Software zeigt die
Zahlen nach jedem Lauf an).

**Knobelaufgabe (wirklich schwer):**
- *Die Ecke im Großen:* Aufgabe 7, Größe 5 × 5, alle Wände weg (**Leeren**), Stern im Feld
  oben rechts, Start wie immer im Feld unten links mit Blick nach oben. Klassenrekord?
  *(4 Bausteine sind möglich, zum Beispiel:)*

  ```
  wiederhole 2 mal
      wiederhole 4 mal
          fahre 1 Feld
      drehe nach rechts
  ```

  *Für die Allerbesten:* Beweise, dass es mit 3 Bausteinen **nicht** geht. *(Beweisidee: Es
  braucht 8 Fahrten und mindestens eine Drehung. Drei einfache Bausteine fahren höchstens 3
  Felder. Eine Schleife mit zwei Bausteinen fährt entweder nur geradeaus (gegen die Wand) oder
  dreht sich im Kreis. Eine Schleife um ein `wenn` mit nur einem Baustein kann nicht fahren
  *und* drehen. Alle Fälle durchgehen!)*
- *Golf auf fremdem Labyrinth:* Schlage den Rekord der Erbauer bei der Labyrinth-Post.
- *Labyrinth-Architekt:* Baue ein 4 × 4-Labyrinth mit Stern, dessen kürzestes Programm
  mindestens 9 Bausteine braucht. Wer findet das „teuerste" Labyrinth der Klasse?

**Entdeckerheft:** Vorher schätzen: Wie viele Bausteine braucht das Nachbar-Labyrinth?
Nachher: Wie viele waren es?

## Plus-Stunde P1 – Golf und Fahrzeit (bei 3 Wochenstunden oder in der AG)

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Fahrzeit-Punkte erklären (Feld 10, Drehung 8). Beispiel Aufgabe 2: 4 Felder + 1 Drehung = 48 Punkte. |
| Erarbeitung I | 15 | Labyrinth-Post Runde 2: jedes Team bekommt zwei fremde Dateien. Wertung zweifach: wenigste Bausteine **und** wenigste Fahrzeit-Punkte. Sind das immer dieselben Programme? |
| Erarbeitung II | 15 | Roboter-Station: Aufgabe 3 am Tisch, Stoppuhr. Stimmt die Reihenfolge der Fahrzeit-Punkte mit der echten Stoppuhr überein? |
| Sicherung | 10 | Rekordtafel aktualisieren; Entdeckerheft: „Kurz geschrieben ist nicht immer schnell gefahren." |

**Knobelaufgabe:** Finde ein Labyrinth, in dem das Programm mit den wenigsten Bausteinen
**nicht** das mit den wenigsten Fahrzeit-Punkten ist. *(Tipp: Schleifen sparen Bausteine,
aber nicht Fahrten; ein Umweg ohne Kurven kann schneller sein als ein kurzer Weg mit vielen.)*

## Differenzierung

- **Unterstützung:** erst die lange Lösung bauen, dann die gleichen Bausteine in die Schleife
  ziehen; Zahl in der Schleife mit dem Finger am Weg abzählen; Labyrinth-Post in 3 × 3 mit
  höchstens drei Wänden.
- **Herausforderung:** Knobelaufgaben; Rekordtafel; Architekt:innen-Rolle.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Schleife läuft, aber der Roboter macht nur die Hälfte | Baustein liegt unter statt im Bauch der Schleife | Einrückung ansehen: Was im Bauch liegt, ist eingerückt |
| „Autsch …" beim letzten Durchgang | Zahl zu groß, oder ein Baustein zu viel im Bauch | mit **Schritt** zählen, wie oft der Bauch läuft |
| Kind setzt 4 statt 3 (vier Seiten!) | Zaunpfahl-Denken: Seiten und Ecken verwechselt | Weg aufmalen, Durchgänge nummerieren |
| Geöffnete Datei hat ein anderes Labyrinth | Datei aus Aufgabe 7 ersetzt beim Öffnen in Aufgabe 7 das Labyrinth | gewollt: so kommt die Post an. Eigenes Labyrinth vorher speichern |
| „Diese Datei kann ich nicht öffnen …" | keine RatRocket-Datei, oder die Datei wurde verändert | Datei neu speichern lassen |
| Dateien heißen alle `ratrocket-aufgabe7.json` | der Name ist fest | sofort nach dem Speichern umbenennen (Team + Nummer) |

## Bewertungsvorschlag

Abgabe von zwei Dateien: die eigene Lösung von Aufgabe 3 und ein Post-Labyrinth mit
notiertem Erbauer-Rekord. Kriterien: Schleife korrekt eingesetzt (grundlegend); fremdes
Labyrinth mit höchstens dem Erbauer-Rekord gelöst (erweitert); Knobelaufgabe mit
Begründung (vertieft). Mündlich: „Warum reicht `wiederhole 3 mal` in Aufgabe 3?"

## Für die Lehrkraft

Eine **Zählschleife** (`wiederhole n mal`) führt ihren Bauch eine feste Anzahl von Malen aus.
Sie macht Programme kürzer und – wichtiger – *veränderbar*: Ein längerer Gang braucht nur
eine andere Zahl, nicht mehr Bausteine. Das Optimieren nach Bausteinzahl („Golf") und nach
Fahrzeit sind zwei verschiedene Ziele; dass sie sich widersprechen können, ist eine echte
Ingenieurserfahrung. Bis November 2026 ließ sich Aufgabe 3 mit einer Abkürzung ohne Schleife
lösen; jetzt versperrt eine Wand unten den Weg. Die alte Lücke ist trotzdem ein Geschenk: In
Aufgabe 7 nachbauen (Mittelfeld zu, Stern unten rechts, keine Wand unten) und fragen: *Hat das
Programm die Aufgabe erfüllt – oder nur den Test bestanden?* Ein automatischer Test (Stern
erreicht) prüft weniger als die eigentliche Anforderung (außen herum) – ein Kernproblem der
Software-Entwicklung.
