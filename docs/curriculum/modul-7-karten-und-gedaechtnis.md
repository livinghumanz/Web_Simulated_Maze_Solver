# Modul 7 – Karten und Gedächtnis: Der Roboter merkt sich Wände

**Woche 7 · Stunde 13 (+ Plus-Stunde P4) · ab 11 Jahren (Kern: 11–15) · Bogen F**
**Software:** Unplugged-Teile und die Karte des Roboters (`GO`, Kartenausdruck) **verfügbar**
– die Demo läuft heute über das Befehlsfeld der englischen Testseite `web/maze_event.html`.
**Geplant – Stand November 2026:** Variablen, Listen und eigene Funktionen in RatRocket Code;
eine deutsche Kartenansicht im Editor.

In Woche 4 ist die rechte Hand an einem Stern auf der Insel gescheitert. Was fehlt ihr? Ein
**Gedächtnis**. Die Kinder werden selbst zu Kartografen, sehen, wie der echte Roboter seine
Karte führt („unbekannt" ist ein eigener Zustand!), und lösen das Insel-Labyrinth mit
Brotkrumen und einem Rückweg-Stapel.

## Lernziele

Die SuS können …

1. eine Karte aus einzelnen Beobachtungen aufbauen und dabei *Wand*, *frei* und *unbekannt*
   unterscheiden,
2. erklären, warum ein Roboter mit Karte Aufgaben lösen kann, an denen ein Roboter ohne
   Gedächtnis scheitert,
3. die Ausgabe des Roboters (Protokollzeilen und Kartenausdruck) lesen und mit der Wirklichkeit
   vergleichen,
4. ein Verfahren mit Markierungen und Stapel (Tiefensuche) ausführen und beschreiben,
5. (geplant) Variablen und Listen in einem Programm einsetzen, um etwas zu zählen oder sich zu merken.

## Stunde 13 – Der Roboter als Kartograf

**Material:** je Dreiergruppe ein verdecktes Labyrinth (Kopie eines 3 × 3-Labyrinths in einer
Klarsichthülle – z. B. die Labyrinthe aus Aufgabe 5 und 6), Spielfigur, Karopapier, Bleistift,
Entdeckerheft. Für die Demo: Tisch-Labyrinth im Aufbau von Aufgabe 5, **Ausgang mit einem
Wandstück geschlossen**, Roboter im Labyrinth-Modus per Bluetooth, Testseite am Beamer.
**Simulation / Roboter:** unplugged; Roboter als Lehrkraft-Demo.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 7 | Rückblick auf den Stern auf der Insel (Woche 4): „Was würdest *du* tun, wenn du im Dunkeln ein Feld suchst?" – sich merken, wo man war; eine Karte zeichnen. |
| Erarbeitung I | 15 | **Kartograf-Spiel** in Dreiergruppen: Das *Roboter*-Kind schiebt die Figur durch das verdeckte Labyrinth. Das *Sensor*-Kind sieht die Vorlage und sagt in jedem Feld nur: „vorne Wand/frei, links …, rechts …". Das *Kartograf*-Kind zeichnet: dicke Linie = Wand, keine Linie = frei, **gepunktete Linie = unbekannt**. Nach 8 Zügen: Karte mit der Vorlage vergleichen. Wie viel ist noch gepunktet? |
| Erarbeitung II | 13 | **Demo:** Roboter in das Feld unten links, Blick nach oben. Befehl `GO`: Er sucht das Ziel in der Mitte (Feld 1,1), ohne das Labyrinth zu kennen, fährt danach nach Hause und druckt seine Karte. Vorher vorhersagen lassen: Wohin dreht er zuerst? Dann Protokollzeilen und Karte gemeinsam lesen. |
| Sicherung | 10 | Merksatz: *Eine Karte ist ein Gedächtnis. Für jede Wand merkt sich der Roboter einen von drei Zuständen: Wand, frei, noch nicht gesehen.* Entdeckerheft: eigene Karte neben die Roboter-Karte zeichnen – was hat er gesehen, was nicht? |

**Was der Roboter in der Demo tun sollte** (so ist das Verfahren gebaut; weicht er ab, hat er
eine Wand anders gesehen – genau das lohnt sich im Protokoll nachzulesen). Die Zahlen hinter
`f=`, `l=`, `r=` sind Abstände in mm; hier Beispielwerte:

```
[CELL] (0,0) N f=34 l=47 r=205  walls LF.  -> (1,0) RIGHT
[CELL] (1,0) E f=33 l=212 r=49  walls .FR  -> (1,1) LEFT
[CELL] (1,1) N f=198 l=210 r=46  GOAL REACHED
```

Lesart: In Feld (0,0), Blick Norden, sieht er links (`L`) und vorne (`F`) eine Wand, rechts
nicht (`.`) – also fährt er nach rechts. Danach kehrt er um (`UTURN`), fährt zurück und biegt
ab. Am Ende druckt er seine Karte (`<` = Roboter mit Blick nach links, `G` = Ziel,
`.` und `:` = noch nicht gesehen):

```
MAP (N up, robot ^>v<, G goal, '.'/':' unseen):
+---+---+---+
|   :   :   |
+...+   +...+
|     G |   |
+---+   +...+
| <     |   |
+---+---+---+
```

**Knobelaufgabe (wirklich schwer):**
- *Log-Detektiv:* Zeichne nur aus den drei `[CELL]`-Zeilen oben alle Wände, die der Roboter
  kennt. Vergleiche mit seiner Karte. Welche Wände hätte er sehen *können*, wenn er anders
  gefahren wäre?
- *Speicher-Rechnung:* Ein 5 × 5-Labyrinth hat 40 Innenwände. Jede kann *Wand*, *frei* oder
  *unbekannt* sein. Wie viele Ja/Nein-Speicherplätze (Bits) braucht man mindestens pro Wand?
  *(2.)* Der Roboter speichert pro Feld alle vier Seiten mit je 2 Bits – wie viele Bytes für
  5 × 5? *(25.)* Warum speichert er jede Innenwand doppelt?
- *Vorhersage-Profi:* Baue das Tisch-Labyrinth um (eine Wand) und sage die `[CELL]`-Zeilen
  der nächsten `GO`-Fahrt voraus, bevor sie kommen.

**Entdeckerheft:** „Meine Karte – die Karte des Roboters".

## Plus-Stunde P4 – Merk dir das! (Brotkrumen, Stapel, Variablen)

**Heute (verfügbar, unplugged):** Brotkrumen und Rückweg-Stapel.
**Material:** Boden-Raster 3 × 3 ohne Innenwände, ein Stern-Karte in der Mitte, 9 Spielsteine
(Brotkrumen), Richtungskarten (N, O, S, W) als Stapel, Entdeckerheft.

Die Regeln (eine **Tiefensuche**):

1. Lege in jedes Feld, das du betrittst, einen Stein.
2. Lege für jeden Schritt eine Karte mit der Richtung *zurück* oben auf deinen Stapel.
3. Gibt es ein Nachbarfeld ohne Stein und ohne Wand dazwischen? Geh hinein – prüfe in der
   Reihenfolge rechts, geradeaus, links.
4. Sonst: Nimm die oberste Karte vom Stapel und geh in diese Richtung zurück.
5. Stern gefunden: fertig. Stapel leer und nirgends ein freies Feld: Es gibt keinen Weg.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Insel-Labyrinth aus Woche 4 auf dem Boden; die rechte Hand scheitert – nochmal vorspielen. |
| Erarbeitung I | 15 | Zwei Gruppen spielen die Regeln vor; die Klasse prüft Schritt für Schritt. Ergebnis: mit Brotkrumen wird der Stern gefunden (unten entlang, rechts hoch, oben zurück, links herunter, dann in die Mitte). |
| Erarbeitung II | 15 | Papier-Variante mit größeren Labyrinthen (4 × 4); zählen: Wie oft wird zurückgegangen? |
| Sicherung | 10 | Der Stapel ist eine **Liste**, bei der man nur oben etwas hinlegt und wegnimmt. Die Steine sind eine Karte „besucht ja/nein". Für den Roboter heißt das: Er braucht Speicher, den das Programm beschreiben und lesen kann – **Variablen** und **Listen**. |

**Für Neugierige:** Der Knopf **Zufall** in Aufgabe 7 baut seine Labyrinthe mit genau diesem
Verfahren – einem Stapel und „noch nicht besucht".

**Geplant – Stand November 2026: dieselbe Stunde mit Bausteinen.** Ein Entwurf, wie es aussehen
könnte (die Baustein-Namen sind Arbeitstitel, angelehnt an Scratch – sie gibt es noch nicht):

```
[Entwurf – diese Bausteine gibt es noch nicht]
setze Felder auf 0
wiederhole, bis du am Stern bist
    … Rechte-Hand-Regel wie in Aufgabe 5 …
    nach jedem fahre 1 Feld: ändere Felder um 1
        und füge die Richtung zur Liste Weg hinzu
sage Felder
fahre die Liste Weg rückwärts ab        ← der Heimweg ohne Umwege in Sackgassen?
```

Knobel dazu (sobald verfügbar): Der Roboter soll nach dem Stern auf dem **kürzesten
bekannten** Weg heimfahren. Warum reicht es nicht, die Liste einfach rückwärts abzufahren?
(Sackgassen-Umwege sind mit drin – man muss sie herausstreichen.)

## Differenzierung

- **Unterstützung:** Kartograf-Spiel mit 2 × 3 Feldern; Karopapier mit vorgedruckten
  Punkt-Linien; feste Rollen.
- **Herausforderung:** Log-Detektiv; Vorhersage-Profi; Brotkrumen in 5 × 5 auf Papier mit
  Zählung der Rückwege; Beweis, dass die Brotkrumen-Regel jedes erreichbare Feld findet.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Kartograf zeichnet „frei", wo er nichts weiß | *unbekannt* und *frei* verwechselt | drei Stifte/Strich-Arten vorgeben |
| Karte passt nicht zur Vorlage | Richtung beim Drehen verloren (Norden auf der Karte ≠ Blickrichtung) | Kompass-Rose auf das Blatt; Figur mit Nase |
| `GO` meldet „[MAZE] map all 3 sensors first (USMAP)" | Sensoren nicht zugeordnet | Lehrkraft: Kalibrier-Checkliste in `docs/firmware.md` |
| `GO` fährt anders als vorhergesagt | eine Wand wurde anders gesehen (Fuge, schräger Blick) | Protokollzeile mit `walls …` lesen – Lernanlass |
| Roboter fährt beim `GO` aus dem Labyrinth | Ausgang offen gelassen | mit einem Wandstück schließen |
| Brotkrumen-Spiel endet im Kreis | Stein vergessen oder Stapel nicht benutzt | Regel 1 und 2 laut mitsprechen |

## Bewertungsvorschlag

Kartograf-Karte mit drei Zuständen und Vergleich (Entdeckerheft) als Beleg; kurzer
Erklärtext „Warum findet die rechte Hand den Stern auf der Insel nicht, die Brotkrumen aber
schon?" Stufen: Karte korrekt (grundlegend); Erklärung mit dem Begriff Gedächtnis/Speicher
(erweitert); Log-Detektiv oder Beweis (vertieft).

## Für die Lehrkraft

Die Rechte-Hand-Regel reagiert nur auf den Augenblick. Sobald ein Roboter etwas **speichert**
– besuchte Felder, gesehene Wände –, kann er planen. Eine **Karte** ist dafür eine Tabelle: für
jedes Feld vier Wände mit je drei möglichen Zuständen. Der echte Roboter beginnt bei `GO` mit
einer Karte, auf der nur die Außenwand bekannt ist; alles andere ist „noch nicht gesehen". In
jedem Feld trägt er ein, was seine drei Sensoren melden, und rechnet neu. Das Brotkrumen-Spiel
ist die **Tiefensuche**: Markierungen (wo war ich?) und ein **Stapel** (wie komme ich zurück?).
Beides sind Datenstrukturen – in Programmiersprachen heißen sie **Variable** und **Liste**.
Weil RatRocket Code diese Bausteine noch nicht hat, bleibt der Bau mit Bausteinen geplant; das
Denken dahinter ist heute vollständig unplugged lernbar.
