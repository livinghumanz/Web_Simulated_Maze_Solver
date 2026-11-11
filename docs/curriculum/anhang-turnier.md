# Anhang – Turniere, Rekordtafel und Bewertungsbögen

Für die Turnierwoche (Woche 5, Modul 5) und für alles, was danach weiterläuft. Alles hier
funktioniert mit der heutigen Software (**verfügbar**): Aufgabe 5 und 7, **Zufall**,
Speichern/Öffnen, echter Roboter. Grundidee: RatRocket Code ist „mehrspielerfähig über
Dateien" – Labyrinthe und Programme werden als Dateien getauscht.

## Grundregeln

1. **Labyrinthe** werden in **Aufgabe 7** gebaut und mit **leerem Programm** gespeichert
   (vorher alle Bausteine in „Zum Löschen hierher ziehen"). So verrät die Datei keine Lösung.
2. **Programme** werden in **Aufgabe 5** gespeichert. Eine Programm-Datei aus Aufgabe 7 würde
   beim Öffnen in Aufgabe 7 das Labyrinth ersetzen – das wäre beim Schiedsrichtern fatal.
3. Jede Datei sofort umbenennen: `<team>-escape.json`, `<team>-golf.json`, `<team>-programm.json`
   (die Software nennt alles `ratrocket-aufgabe7.json` bzw. `ratrocket-aufgabe5.json`).
4. Austausch über USB-Stick oder die Schul-Plattform; die Lehrkraft sammelt alles in einem Ordner.
5. **Reihenfolge beim Schiedsrichtern:** erst Aufgabe 7 öffnen, dann die **Labyrinth**-Datei
   öffnen (das Labyrinth erscheint), dann die **Programm**-Datei öffnen (Meldung „Programm aus
   Aufgabe 5 geladen."), dann **Los!**. Tempo-Regler ganz rechts spart Zeit.
6. Ein Labyrinth ist nur gültig, wenn das **Referenz-Programm** es schafft (unten).
7. Fair Play: Wer ein fremdes Labyrinth vorab ansieht oder ein Programm nach der Abgabe ändert,
   scheidet aus der jeweiligen Runde aus.

## Referenz-Programm (Lehrkraft)

Die Rechte-Hand-Regel aus Aufgabe 5, 7 Bausteine:

```
wiederhole, bis du draußen bist
    wenn rechts frei
        drehe nach rechts
        fahre 1 Feld
    sonst
        wenn vorne frei
            fahre 1 Feld
        sonst
            drehe nach links
```

Mit Start im Feld unten links findet sie aus jedem Labyrinth heraus, dessen Ausgang in der
Außenwand liegt – also aus jedem gültigen Escape-Labyrinth. (Wer den Start mitten ins Labyrinth
neben einen freistehenden Block setzt, kann sie zum Kreisen bringen – das ist für Turnier-
Labyrinthe deshalb nicht erlaubt.)

## Fahrzeit-Punkte

Jedes gefahrene Feld **10**, jede Drehung **8** (`drehe nach rechts`, `drehe nach links` und
`dreh dich um` zählen gleich). Das entspricht dem Takt der Simulation. Das Protokoll-Kind führt
beim Zuschauen eine Strichliste „Felder | Drehungen" (Tempo-Regler dafür in die Mitte).

## Die Rekordtafel (läuft ab Woche 3 bis Kursende)

Plakat, eine Zeile je Aufgabe oder Klassen-Labyrinth. Ein Rekord zählt, wenn er am Beamer
vorgeführt wurde.

| Aufgabe / Labyrinth | Rekord Bausteine | von | Rekord Fahrzeit-Punkte | von | Datum |
|---|---|---|---|---|---|
| Aufgabe 1 Geradeaus | | | | | |
| Aufgabe 2 Um die Ecke | | | | | |
| Aufgabe 3 Immer im Kreis (außen herum!) | | | | | |
| Aufgabe 4 Schau nach vorne | | | | | |
| Aufgabe 5 Raus hier! | | | | | |
| Die Ecke im Großen (5 × 5, leer) | | | | | |
| Spirale (wenigste Wände, alle 25 Felder) | | | | | |
| Längster Weg (5 × 5, Referenz-Programm) | | | | | |
| Flut-Labyrinth A | | | | | |
| … eigene Klassen-Labyrinthe | | | | | |

**Bekannte Bestwerte – nur für die Lehrkraft:** Aufgabe 1: 2 · Aufgabe 2: 5 · Aufgabe 3: 4
(76 Fahrzeit-Punkte; die frühere Abkürzung ist seit November 2026 zugemauert) · Aufgabe 4: 4 · Aufgabe 5: **5** Bausteine
(sicher, aber 122 Fahrzeit-Punkte) bzw. 74 Fahrzeit-Punkte mit 6 oder 7 Bausteinen · Die Ecke
im Großen: 4 · Spirale: 5 Wände · Flut-Labyrinth A: 11 Bausteine, 100 Fahrzeit-Punkte. Wer einen
dieser Werte schlägt, hat etwas entdeckt, das wir nicht kannten – bitte melden!

## Format A – Escape-Cup (Liga: alle Programme gegen alle Labyrinthe)

**Vorbereitung (Stunde 9):** Jedes Team baut ein Escape-Labyrinth (Aufgabe 7, Größe von der
Lehrkraft, z. B. 4 × 4 oder 5 × 5; Start unten links mit Blick nach oben; ohne Stern; **genau
eine** Öffnung als Ausgang) und gibt ein Turnier-Programm ab, das alle drei Labyrinthe von
Aufgabe 6 schafft (Qualifikation). Die Lehrkraft erzeugt zusätzlich drei Labyrinthe mit
**Zufall** (vorher den Stern entfernen; dann gibt es genau einen Ausgang, möglichst weit vom
Start) und speichert sie ebenfalls.

**Durchführung (Stunde 10):** Jedes Team schiedsrichtert sein eigenes Labyrinth gegen alle
Programme; die Zufall-Labyrinthe übernimmt die Lehrkraft oder ein freies Team.

**Punkte je Lauf:** herausgefunden **3** · „Autsch …", „Das Programm ist zu Ende …" oder
„Das Programm läuft zu lange …" **0**. Bonus **+1** für die wenigsten Fahrzeit-Punkte auf
diesem Labyrinth (optional, wenn Zeit ist). Gleichstand in der Summe: weniger Bausteine gewinnt.

**Schiedsrichter-Bogen** (Kopiervorlage, ein Bogen je Labyrinth):

```
Labyrinth von Team: ______________   Größe: ___ x ___   Referenz-Programm raus? ja / nein

| Programm von Team | raus? | Meldung, falls nicht  | Felder | Drehungen | Fahrzeit-P. | Punkte |
|-------------------|-------|-----------------------|--------|-----------|-------------|--------|
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |
|                   |       |                       |        |           |             |        |

Programme, die hier gescheitert sind (für den Schurken-Preis): ____
Unterschrift Schiedsrichter:in: ______________
```

## Format B – Golf-Duell (K.-o.-System)

Jedes Team baut ein Golf-Labyrinth (Aufgabe 7, 4 × 4, mit Stern) und gibt der Lehrkraft auf
einem Zettel seinen eigenen Bestwert (Bausteine) – den **Architekten-Rekord**. Im Duell tauschen
zwei Teams ihre Golf-Dateien und haben **8 Minuten**. Gewonnen hat, wer das fremde Labyrinth
mit weniger Bausteinen löst; bei Gleichstand entscheiden die Fahrzeit-Punkte, dann der
schnellere Abgabezeitpunkt. Wer den Architekten-Rekord des Gegners schlägt, erhält zusätzlich
den Titel **Rekordjäger** (+1 in der Gesamtwertung).

Viertelfinale in Stunde 10, Halbfinale und Finale als 5-Minuten-Einstieg in den Wochen 6 und 7 –
so bleibt das Turnier über Wochen lebendig. Bei 6 Teams bekommen die zwei Besten der
Qualifikation ein Freilos.

```
Viertelfinale         Halbfinale          Finale            Sieger
Team ________ --+
                +-- ________ --+
Team ________ --+              |
                               +-- ________ --+
Team ________ --+              |              |
                +-- ________ --+              |
Team ________ --+                             +-- ________
                                              |
Team ________ --+                             |
                +-- ________ --+              |
Team ________ --+              |              |
                               +-- ________ --+
Team ________ --+              |
                +-- ________ --+
Team ________ --+
```

## Format C – Schurken-Preis (für Labyrinth-Architekt:innen)

Für jedes gültige Escape-Labyrinth gibt es **+1 je Turnier-Programm, das daran scheitert**.
Gültig heißt: Das Referenz-Programm schafft es. Gute Schurken-Labyrinthe nutzen typische
Programmfehler aus: Sackgassen (gegen die 6-Baustein-Version), lange gerade Gänge mit
Abzweigungen auf der rechten Seite (gegen Programme, die nach dem Drehen nicht fahren), oder
Ausgänge auf der „falschen" Seite (gegen Programme, die nur für Aufgabe 5 gebaut sind).

## Format D – Finale am echten Roboter

Die Lehrkraft baut hinter einem Pappschirm ein Tisch-Labyrinth (3 × 3 oder bis 5 × 5; Start im
Feld unten links mit Blick nach oben, ein Ausgang irgendwo am Rand, nicht zur Tischkante). Die
zwei (oder vier) besten Programme des Escape-Cups fahren nacheinander mit **demselben** Roboter:

- 3 × 3: Aufgabe 5 öffnen, Programm-Datei öffnen, **Echter Roboter**, **Los!**.
- 4 × 4 oder 5 × 5: Aufgabe 7 in dieser Größe ohne Stern und mit irgendeiner Öffnung am Rand,
  Programm-Datei öffnen (das gezeichnete Labyrinth ist sonst egal, nur Größe und Start müssen
  stimmen – die Sensoren entscheiden).

Wertung: herausgefunden, dann Zeit (Stoppuhr von **Los!** bis zur Meldung). Danach wird der
Schirm entfernt und gemeinsam erklärt, warum welches Programm wie fuhr.

## Format E – Blindflug-Runde (jederzeit als Einstieg)

Die Lehrkraft zeigt ein neues Labyrinth 60 Sekunden am Beamer. Die Teams schreiben ihr
Programm auf Papier (Baustein-Namen wie in der Software), tippen es ein und haben **einen**
Versuch. Richtig: 2 Punkte; zusätzlich 1 Punkt für die wenigsten Bausteine.

## Gesamtwertung

```
| Team | Escape-Cup | Schurken-Preis | Golf-Duell (Runde erreicht) | Rekordjäger | Finale | Blindflug | Summe |
|------|------------|----------------|-----------------------------|-------------|--------|-----------|-------|
|      |            |                |                             |             |        |           |       |
```

Golf-Duell: Viertelfinale 1 Punkt, Halbfinale 2, Finale 3, Sieg 4. Finale am Roboter: Teilnahme
2, Sieg 4.

## Ablaufpläne

| Variante | Ablauf |
|---|---|
| 2 × 45 min | Stunde 9 Bauen und Qualifizieren; Stunde 10 Escape-Cup, Golf-Viertelfinale, Finale am Roboter |
| 90 min | 35 Bauen, 5 Pause/Abgabe, 25 Escape-Cup, 15 Golf, 10 Finale |
| verteilt | Escape-Cup in Woche 5; Golf-Duell als Einstiegsritual in Woche 6–7; Blindflug jederzeit |

## Weitere Turniere für später

- **Zufall-Cup:** ein Programm, zehn Zufall-Labyrinthe in 8 × 8 – wer hat die wenigsten
  Fahrzeit-Punkte insgesamt? (Rechte oder linke Hand – man weiß vorher nicht, was besser ist.)
- **Spiral-Cup:** Programm fest (Modul 4), wer erreicht mit den wenigsten Wänden die meisten Felder?
- **Flut-Rennen:** Flut-Weg gegen rechte Hand auf Labyrinthen der Klasse (Modul 8).
- **Klassen-Micromouse:** für Ältere mit Erkundungs- und Schnelllauf (Modul 10).
