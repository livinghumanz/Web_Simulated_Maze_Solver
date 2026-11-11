# Modul 8 – Flood-Fill: Die Zahlenflut findet den kürzesten Weg

**Woche 7–8 · Stunde 14–15 (+ Ausbau P5–P7) · ab 11 Jahren (Kern: 11–15, bis Oberstufe) · Bogen G**
**Software:** Unplugged, Vergleich in Aufgabe 7 und die eingebaute Zahlenflut des Roboters
(`GO`, `GOTO`) **verfügbar**; die Roboter-Demo läuft heute über die englische Testseite
`web/maze_event.html`.
**Verfügbar** (seit November 2026): die Zahlenflut selbst bauen – mit Karten-Bausteinen, Listen,
Variablen und eigenen Bausteinen in Aufgabe 7 (Ausbau P5–P7). **Geplant – Stand November 2026:**
dieselbe Flut für Ältere als Textprogramm.

Wie findet ein Roboter den **kürzesten** Weg – auch zum Stern in der Mitte, an dem die rechte
Hand scheitert? Mit einer Idee, die Kinder ohne Computer ausführen können: Man gießt
„Wasser" ins Ziel und schreibt in jedes Feld, nach wie vielen Schritten es nass wird. Dann
geht man vom Start immer bergab. Der echte Roboter macht genau das – bei jedem Schritt neu.

## Lernziele

Die SuS können …

1. die Zahlenflut (Flood-Fill) für ein Labyrinth auf Papier fehlerfrei ausführen,
2. aus den Zahlen einen kürzesten Weg ablesen und begründen, warum er der kürzeste ist,
3. Sonderfälle erklären: Sackgassen (große Zahlen), unerreichbare Felder (keine Zahl),
   Gleichstand (mehrere kürzeste Wege),
4. den Weg der Zahlenflut mit dem der rechten Hand vergleichen (Felder, Fahrzeit-Punkte,
   Gedächtnis nötig?),
5. vorhersagen, wie der echte Roboter in einem unbekannten Labyrinth erkundet, und die
   Vorhersage mit seinem Protokoll prüfen.

## Stunde 14 – Die Zahlenflut (unplugged)

**Material:** Arbeitsblatt „Flut-Labyrinth A" (unten, A4-Kopie, Felder groß genug zum
Hineinschreiben), Buntstift blau, Tafel mit dem 3 × 3-Beispiel, Entdeckerheft.
**Beamer/Station:** Erklär-Seite „Flood-Fill" (Schritt-für-Schritt-Animation) in
`web/learn.html` (im Aufbau – Stand November 2026).
**Simulation / Roboter:** keine.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Bild: „Wir gießen Wasser in das Ziel. Es fließt in jedem Takt ein Feld weiter – aber nie durch eine Wand." Frage: Welche Felder sind nach einem Takt nass? Nach zwei? |
| Erarbeitung I | 10 | Lehrkraft an der Tafel, 3 × 3-Beispiel (Labyrinth aus Aufgabe 5, Ausgang zu, Ziel in der Mitte): **0** ins Ziel. **1** in jedes Nachbarfeld, das durch eine Lücke erreichbar ist. **2** in die Nachbarn der Einsen, die noch leer sind – und so weiter. Drei Felder bleiben leer: Dort kommt das Wasser nie an. |
| Erarbeitung II | 20 | Paare: Flut-Labyrinth A. Regeln an der Tafel (unten). Danach den Weg vom Start einzeichnen: immer in ein Nachbarfeld mit der **nächstkleineren** Zahl. Kontrolle mit dem Lösungsblatt. |
| Sicherung | 10 | Merksätze: *Die Zahl in einem Feld sagt, wie viele Felder es bis zum Ziel sind. Der kürzeste Weg geht immer bergab. Sackgassen bekommen große Zahlen; unerreichbare Felder bleiben leer.* Entdeckerheft. |

**Regeln der Zahlenflut**

1. Schreibe **0** ins Ziel.
2. Suche alle Felder mit der höchsten Zahl, die du schon geschrieben hast (zuerst die 0).
3. Schreibe in jedes **leere** Nachbarfeld, das durch eine **Lücke** (keine Wand) verbunden
   ist, diese Zahl **plus 1**. Nur waagerecht und senkrecht, nie schräg.
4. Wiederhole 2 und 3, bis keine neue Zahl mehr dazukommt.
5. Weg: vom Start immer in ein Nachbarfeld mit der nächstkleineren Zahl, bis zur 0.

Tafelbeispiel (Aufgabe-5-Labyrinth, Ausgang geschlossen, Ziel Mitte; `-` = unerreichbar):

```
      0   1   2
    +---+---+---+
  2 | - | 1   2 |
    +---+   +---+
  1 | 1   0 | - |
    +---+   +---+
  0 | 2   1 | - |
    +---+---+---+
```

**Arbeitsblatt Flut-Labyrinth A** (S = Start, Z = Ziel):

```
      0   1   2   3
    +---+---+---+---+
  3 |           |   |
    +   +---+   +   +
  2 |   |   | Z     |
    +   +   +---+   +
  1 |       |       |
    +---+   +   +---+
  0 | S             |
    +---+---+---+---+
```

**Lösung:**

```
      0   1   2   3
    +---+---+---+---+
  3 | 3   2   1 | 2 |
    +   +---+   +   +
  2 | 4 | 7 | 0   1 |
    +   +   +---+   +
  1 | 5   6 | 3   2 |
    +---+   +   +---+
  0 | 6   5   4   5 |
    +---+---+---+---+
```

Kürzester Weg: S (6) → rechts (5) → rechts (4) → hoch (3) → rechts (2) → hoch (1) → links ins
Ziel (0): **6 Felder**. Das Feld mit der 7 ist eine Sackgasse; der Weg links hoch und oben
herum ist 8 Felder lang.

**Knobelaufgabe (wirklich schwer):**
- *Längster kürzester Weg:* Baue ein 4 × 4-Labyrinth, in dem der Start (unten links) die
  **größtmögliche** Zahl bekommt. Wie groß kann sie werden? *(15 – eine Schlangenlinie durch
  alle 16 Felder: unten nach rechts, hoch, nach links, hoch, nach rechts, hoch, nach links;
  Ziel oben links.)*
- *Wie viele kürzeste Wege?* Leeres 4 × 4, Start unten links, Ziel oben rechts. Zweite Flut,
  diesmal vom Start aus: In jedes Feld kommt die **Summe** der Zahlen seiner Nachbarn, die einen
  Schritt näher am Start sind (Start = 1). Was steht im Ziel? *(20 – das ist das Pascalsche
  Dreieck.)* Wie ändert sich die Zahl, wenn du eine Wand einbaust?
- *Vier Ziele:* Im echten Micromouse-Wettbewerb besteht das Ziel aus den vier Feldern in der
  Mitte. Wie startet man die Flut dann? *(Vier Nullen.)*
- *Kurven kosten:* Erfinde eine Flut, bei der eine Drehung extra kostet (wie die
  Fahrzeit-Punkte: Feld 10, Drehung 8). Findet sie in Flut-Labyrinth A einen anderen Weg?

**Entdeckerheft:** „Vorhersage: Wie viele Felder? – Ergebnis der Flut".

## Stunde 15 – Der Roboter rechnet selbst

**Material:** Laptops; Tisch-Labyrinth (3 × 3 im Aufbau von Aufgabe 5, Ausgang geschlossen;
oder 4 × 4 wie Flut-Labyrinth A), Roboter im Labyrinth-Modus per Bluetooth,
Testseite am Beamer, Arbeitsblatt aus Stunde 14, Entdeckerheft.
**Simulation / Roboter:** Wettrennen in der Simulation; Roboter als Demo.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | „Der Roboter rechnet die Flut bei jedem Feld neu – in Bruchteilen einer Sekunde." Heute: Wer ist schneller, die rechte Hand oder die Flut? |
| Erarbeitung I | 15 | **Wettrennen in Aufgabe 7:** Größe 4 × 4, **Leeren**, dann die 8 Wände von Flut-Labyrinth A setzen, den Stern ins Ziel (Feld 2,2); der Start bleibt unten links mit Blick nach oben – genau das Feld S des Arbeitsblatts. Team „Hand" startet das 7-Baustein-Programm aus Aufgabe 5, Team „Flut" baut aus seinen Zahlen ein Programm. Fahrzeit-Punkte zählen. |
| Erarbeitung II | 15 | **Demo am Roboter**, zwei Teile. (a) *Unbekanntes Labyrinth:* Roboter in das Feld unten links, Blick nach oben, Befehl `GO`. Vorher vorhersagen: Er nimmt an, dass überall frei ist, wo er noch nicht hingeschaut hat. Im 3 × 3-Labyrinth: erst nach rechts, dann nach links ins Ziel; zurück mit Umdrehen und Rechtsabbiegen. (b) *Bekanntes Labyrinth:* auf der Testseite das Tisch-Labyrinth nachzeichnen (Werkzeug **Walls**), Roboter auf Feld 0,0 mit Blick Norden, Werkzeug **Goal**, Zielfeld anklicken – der Roboter fährt mit `GOTO` den kürzesten Weg. Stimmt er mit euren Zahlen überein? |
| Sicherung | 10 | Tabelle an der Tafel: *rechte Hand* gegen *Zahlenflut* – braucht Gedächtnis? findet die Mitte? kürzester Weg? muss die Karte kennen? Entdeckerheft. |

Die acht Wände für Aufgabe 7 (jeweils die Linie zwischen den beiden Feldern anklicken;
Feld = (x, y), unten links ist (0,0)): (2,3)|(3,3) · (1,3)|(1,2) · (0,2)|(1,2) · (1,2)|(2,2) ·
(2,2)|(2,1) · (1,1)|(2,1) · (0,1)|(0,0) · (3,1)|(3,0).

Programm „Flut-Weg" (11 Bausteine):

```
drehe nach rechts
fahre 1 Feld
fahre 1 Feld
drehe nach links
fahre 1 Feld
drehe nach rechts
fahre 1 Feld
drehe nach links
fahre 1 Feld
drehe nach links
fahre 1 Feld
```

Ergebnis des Rennens: **Flut** 6 Felder und 5 Drehungen = **100 Fahrzeit-Punkte**;
**rechte Hand** 10 Felder und 9 Drehungen = **172 Fahrzeit-Punkte** (sie läuft erst in die
Sackgasse unten rechts und oben rechts). Aber: Das Flut-Programm passt nur zu *diesem*
Labyrinth, die rechte Hand zu jedem. Der echte Roboter verbindet beides: Er rechnet die Flut
in jedem Feld aus dem, was er bisher gesehen hat.

**Knobelaufgabe (wirklich schwer):**
- *Der Optimist:* Sage für ein umgebautes Tisch-Labyrinth jede `[CELL]`-Zeile von `GO`
  voraus (Feld, Blickrichtung, gesehene Wände, nächster Schritt). Regel des Roboters: Wo er
  noch nicht war, nimmt er „frei" an; bei Gleichstand fährt er lieber geradeaus.
- *Optimisten-Falle:* Baue ein Labyrinth, in dem der erkundende Roboter einen großen Umweg
  fährt, weil er eine Wand zu spät sieht. Findest du eines, in dem die rechte Hand **schneller**
  am Ziel ist als die Erkundung mit der Flut?
- *Und andersherum?* Was würde passieren, wenn der Roboter überall „Wand" annähme, wo er
  noch nicht war? *(Er fände am Anfang gar keinen Weg.)*
- *Für Neugierige:* Der Knopf **Zufall** in Aufgabe 7 legt den Stern (oder ohne Stern den
  Ausgang) mit genau dieser Zahlenflut auf das Feld, das am weitesten vom Start entfernt ist –
  gemessen in Schritten durch das Labyrinth.

## Ausbau P5–P7 – Bau die Flut selbst

**Verfügbar (Aufgabe 7, seit November 2026).** Die Kinder programmieren die Zahlenflut selbst und
fahren denselben Weg erst in der Simulation, dann auf dem Roboter (Labyrinth bis 5 × 5). Dafür hat
Aufgabe 7 die **Karten-Bausteine** (Gruppe **Karte**: `merke Wände hier`, `lösche alle Zahlen`,
`setze Zahl von Feld x y auf n`, `setze … auf Zahl von Feld x y`, die Bedingungen
`vorne/rechts/links offen laut Karte` und `Feld x y nach r offen`, die Werte `mein x`, `mein y`,
`meine Richtung`, `Stern x`, `Stern y`), dazu **Listen** und **eigene Bausteine**. Jede Zahl, die
das Programm schreibt, erscheint blass im Feld des Labyrinths. Richtungen sind Zahlen: 1 Norden,
2 Osten, 3 Süden, 4 Westen; „leer" ist −1; eine Wand, die der Roboter noch nicht gesehen hat, gilt
als offen – wie bei `GO`.

**Stufe 1 (ab etwa 11):** Die Lehrkraft baut die eigenen Bausteine **Flut** und **Nachbar** einmal
vor (Stufe 2), speichert die Datei und gibt sie aus (**Öffnen** in Aufgabe 7; die acht
`füge`-Bausteine für die Listen DX = 0, 1, 0, −1 und DY = 1, 0, −1, 0 sind mit drin). Die Kinder
bauen das Bergab-Fahren:

```
wiederhole bis H < 0
    merke Wände hier
    Flut
    setze FX auf mein x
    setze FY auf mein y
    setze H auf Zahl von Feld FX FY
    setze R auf 1
    wiederhole 4 mal                       ← Z: die Richtung, in der es am tiefsten bergab geht
        wenn Feld FX FY nach R offen
            Nachbar
            wenn N < H
                setze H auf N
                setze Z auf R
        ändere R um 1
    wiederhole bis Z = meine Richtung
        drehe nach rechts
    fahre 1 Feld
```

Am Stern ist der Lauf gewonnen und zu Ende; `H < 0` hält nur an, wenn es keinen Weg gibt.

**Stufe 2 (ab etwa 13):** Die Kinder bauen **Flut** selbst – mit einer Warteschlange: zwei Listen
QX, QY für die Felder und eine Variable I, die zeigt, welches Feld als Nächstes drankommt (vorne
wegnehmen heißt: I um 1 weiterzählen):

```
definiere Flut
    lösche alle Zahlen
    setze Zahl von Feld Stern x Stern y auf 0
    lösche alles aus QX
    lösche alles aus QY
    füge Stern x zu QX hinzu
    füge Stern y zu QY hinzu
    setze I auf 1
    wiederhole bis I > Länge von QX
        setze FX auf Element I von QX
        setze FY auf Element I von QY
        setze D auf Zahl von Feld FX FY
        ändere D um 1
        setze R auf 1
        wiederhole 4 mal                       ← für jede Richtung
            wenn Feld FX FY nach R offen
                Nachbar                        ← NX, NY und seine Zahl N
                wenn N = −1                    ← noch leer
                    setze Zahl von Feld NX NY auf D
                    füge NX zu QX hinzu
                    füge NY zu QY hinzu
            ändere R um 1
        ändere I um 1

definiere Nachbar
    setze NX auf Element R von DX
    ändere NX um FX
    setze NY auf Element R von DY
    ändere NY um FY
    setze N auf Zahl von Feld NX NY
```

Das ganze Programm (54 Bausteine) steht in `docs/code-editor.md`, Abschnitt *Karten-Bausteine*.
Der Selbsttest der Software prüft, dass es zufällige 5 × 5-Labyrinthe vom Feld unten links bis
zum Stern löst – auch mit einem nachgestellten echten Roboter, der nur `CELL`, `TURN` und `WALLS`
bekommt. Mit **Tempo** ganz links sieht man, wie die Zahlen das Labyrinth füllen.

Stundenskizze für P5–P7: P5 die Warteschlange unplugged (Kinder stehen als Felder in einer
Schlange an), P6 Stufe 1 oder 2 in der Simulation (**Zufall**, 5 × 5), P7 dasselbe Programm auf
dem Roboter und das Wettrennen aus Stunde 15 – diesmal mit einem Programm, das *jedes*
Labyrinth kann. Die *Optimisten-Falle* (Stunde 15) lässt sich jetzt mit dem eigenen Programm
prüfen. Für Ältere zusätzlich: der C-Code des Roboters (Modul 10).

## Differenzierung

- **Unterstützung:** Arbeitsblatt mit vorgegebener 0 und den Einsen; Zahlen in Farben
  (0 blau, 1 grün …); 3 × 3 statt 4 × 4; Partnerkontrolle mit dem Lösungsblatt.
- **Herausforderung:** längster kürzester Weg, Wege zählen (Pascal), Flut mit Kurvenkosten,
  Optimisten-Vorhersage.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Zahl „fließt" durch eine Wand | Wände übersehen | Wände vorher dick nachziehen; Regel 3 laut sprechen |
| Schräge Nachbarn bekommen Zahlen | Diagonale gezählt | Finger darf nur über eine Lücke gleiten |
| Zahlen passen nicht zusammen (zwei Nachbarn unterscheiden sich um mehr als 1, obwohl offen) | nicht Takt für Takt gearbeitet, ein Feld zu früh beschriftet | radieren, Takt für Takt neu – erst alle 1, dann alle 2 |
| Zahl nach Luftlinie statt nach Weg | „wie weit weg sieht es aus" | mit dem Finger den Weg gehen und zählen |
| Leere Felder werden „aufgefüllt" | unerreichbar ist nicht erlaubt | leer lassen – das ist eine Information |
| Kinder beginnen am Start statt am Ziel | geht auch, dann aber **bergauf** zum Ziel | beides erlaubt; die Firmware flutet vom Ziel |
| `GO` meldet `NO PATH` | Ziel eingemauert, oder eine Wand falsch gesehen | Labyrinth prüfen; im Protokoll die `walls`-Angaben lesen |
| Roboter will beim `GOTO` durch eine Wand, bremst und bricht ab | Zeichnung auf der Testseite stimmt nicht mit dem Tisch überein (die Zeichnung gilt dort als Wahrheit; die Seite markiert Abweichungen farbig) | Zeichnung korrigieren |

## Bewertungsvorschlag

Arbeitsblatt Flut-Labyrinth A (Zahlen und Weg) als Grundleistung; ein **neues**, ungesehenes
4 × 4-Labyrinth als kurze Lernkontrolle. Stufen: Zahlen korrekt (grundlegend); kürzester Weg
mit Begründung und Sonderfällen (erweitert); eine Knobelaufgabe gelöst und erklärt (vertieft).

## Für die Lehrkraft

Die Zahlenflut ist eine **Breitensuche** (englisch *breadth-first search*): Sie bearbeitet die
Felder „Welle für Welle" vom Ziel aus und braucht dafür eine **Warteschlange**. Weil jedes Feld
seine Zahl in der Welle bekommt, in der das Wasser zuerst ankommt, ist die Zahl immer die
kürzeste Entfernung – deshalb führt Bergab-Gehen garantiert auf einem kürzesten Weg ins Ziel.
Der Roboter rechnet so in der Firmware (`costAlgorithm.c`): Er beginnt mit einer Karte, auf der
nur die Außenwände bekannt sind, nimmt „frei" an, wo er noch nichts weiß, und flutet nach jedem
Feld neu. Findet er eine Wand, ändern sich die Zahlen, und der Weg biegt um. Bei Gleichstand
fährt er lieber geradeaus. Mit **GOTO** auf der Testseite kennt er die Karte schon (die
Zeichnung) und fährt direkt den kürzesten Weg. So arbeiten im Prinzip auch echte
Micromouse-Roboter: Erkundungslauf mit Flut, dann ein schneller Lauf auf der gelernten Karte.
