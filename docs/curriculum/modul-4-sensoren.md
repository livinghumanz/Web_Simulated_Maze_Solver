# Modul 4 – Sensoren und Entscheidungen

**Woche 3 · Stunde 6 (+ Plus-Stunde P2) · ab 9 Jahren (Kern: 10–14) · Leiter-Sprosse 1**
**Software: verfügbar** (Aufgabe 4, Aufgabe 7, echter Roboter mit Sensoren)

Bisher fuhr der Roboter blind ab, was im Programm stand. Jetzt fragt er seine „Augen" –
drei Ultraschall-Abstandssensoren nach vorne, links und rechts – und entscheidet mit
`wenn … sonst` selbst. Auf dem echten Roboter entscheiden die echten Sensoren, nicht die
Zeichnung am Bildschirm.

## Lernziele

Die SuS können …

1. erklären, was ein Sensor misst und wie der Roboter daraus „Wand" oder „frei" macht (Schwelle),
2. eine Verzweigung mit `wenn … sonst` und einer der sechs Bedingungen bauen und vorhersagen, welcher Zweig läuft,
3. begründen, warum ein `wenn` meistens in einer Schleife steht (es fragt nur einmal),
4. ein Experiment planen, durchführen und protokollieren (Wie weit sieht der Roboter?),
5. beschreiben, warum dasselbe Programm am echten Roboter anders fahren kann als in der Simulation.

## Die sechs Bedingungen (genau so in der Software)

`vorne frei` · `vorne Wand` · `rechts frei` · `rechts Wand` · `links frei` · `links Wand`
– immer aus Sicht des Roboters, immer nur für die Wände **seines eigenen Feldes**.

## Stunde 6 – Die Augen des Roboters

**Material:** Boden-Raster aus Modul 1 mit zwei Stühlen als Wände, Augenbinde (oder Augen zu),
Laptops, je Station ein Roboter (Labyrinth-Modus, Bluetooth), ein loses Wandstück, Lineal oder
Maßband, ein Stück Stoff (Pullover), Entdeckerheft.
**Simulation / Roboter:** Aufgabe 4 in der Simulation; Sensor-Labor am echten Roboter.
**Beamer/Station:** Erklär-Seite „Ultraschall" in `web/learn.html` (im Aufbau – Stand November 2026).

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 8 | **Blinder Roboter:** Ein Kind steht mit geschlossenen Augen im Raster. Ein „Sensor"-Kind steht dahinter und antwortet **nur** auf die Frage „Vorne frei?" mit „frei" oder „Wand". Die Klasse hat eine Programmkarte: „Wiederhole: Wenn vorne frei – ein Feld gehen. Sonst – rechts drehen." Gemeinsam ablaufen. |
| Erarbeitung I | 15 | Aufgabe 4 „Schau nach vorne" in der Simulation. Neu: der `wenn`-Baustein mit Auswahl der Bedingung und zwei Bäuchen (`wenn` und `sonst`). Mit **Schritt** sieht man: Erst fragt der Roboter, dann fährt er. Ziel: 3 Sterne (höchstens 4 Bausteine). |
| Erarbeitung II | 15 | **Sensor-Labor** an den Roboter-Stationen. Programm in Aufgabe 4: `wenn vorne Wand` → `drehe nach rechts`, `sonst` bleibt leer. **Echter Roboter** an. Wandstück in 5, 10, 15, 20 cm Abstand vor den vorderen Sensor stellen, jeweils **Los!**: Dreht er sich? Grenze eingrenzen (auf 1 cm genau). Dann: Pullover statt Wand; Wand schräg halten; Hand. Ergebnisse ins Messprotokoll. |
| Sicherung | 7 | Merksatz: *Mit `wenn … sonst` entscheidet der Roboter selbst – nach dem, was seine Augen gerade sehen. Ein `wenn` fragt nur einmal; für viele Fragen braucht es eine Schleife.* Klassen-Ergebnis: die Schwelle. |

Aufgabe 4 „Schau nach vorne" (keine Innenwände):

```
      0   1   2
    +---+---+---+
  2 |         * |
    +   +   +   +
  1 |           |
    +   +   +   +
  0 | ^         |
    +---+---+---+
```

Erwartetes Programm (4 Bausteine, 3 Sterne; jede Zahl ab 5 funktioniert, weil das Programm am
Stern anhält):

```
wiederhole 8 mal
    wenn vorne frei
        fahre 1 Feld
    sonst
        drehe nach rechts
```

**Was das Sensor-Labor ergeben sollte:** Bei Werkseinstellung zählt vorne eine Wand näher als
etwa 11 cm (vom Sensor gemessen), seitlich etwa 13 cm; danach ist „frei" – denn dort stünde
die Wand des *nächsten* Feldes. Nach einer Kalibrierung (Woche 6) können die Werte etwas
anders sein. Weicher Stoff und schräge Flächen werfen den Schall schlecht zurück: Der
Roboter „sieht" sie manchmal nicht.

**Knobelaufgabe (wirklich schwer):**
- *Die Spirale (Programm fest, Labyrinth gesucht):* Aufgabe 7, Größe 5 × 5, Stern in die
  Mitte, Start wie immer unten links mit Blick nach oben. Das Programm ist fast das aus
  Aufgabe 4 – nur mit einer Schleife, die nicht nach 8 Runden aufhört:

  ```
  wiederhole, bis du draußen bist
      wenn vorne frei
          fahre 1 Feld
      sonst
          drehe nach rechts
  ```

  Setze **so wenige Wände wie möglich**, damit der Roboter den Stern erreicht – und dabei
  **alle 25 Felder** besucht. *(Lösung mit 5 Wänden: Der Roboter dreht nur, wenn vorne eine
  Wand ist; also braucht es nur „Bremswände" an den Ecken der Spirale. Er fährt links hoch,
  oben nach rechts, rechts herunter und dann immer enger im Uhrzeigersinn nach innen.)*

  ```
        0   1   2   3   4
      +---+---+---+---+---+
    4 |                   |
      +   +---+   +   +   +
    3 |               |   |
      +   +   +   +   +   +
    2 |         *         |
      +   +   +   +   +   +
    1 |       |           |
      +   +   +   +---+   +
    0 | ^ |               |
      +---+---+---+---+---+
  ```
- *Zwei Wege:* Finde eine zweite 4-Baustein-Lösung für Aufgabe 4, die `vorne Wand` benutzt.
  *(z. B. `wiederhole 9 mal` mit `wenn vorne Wand` → `drehe nach rechts`, `sonst` leer, und
  danach im Bauch der Schleife `fahre 1 Feld`.)*
- *Forscherfrage:* Ist die Schwelle bei jedem Roboter der Klasse gleich? Sammelt alle Werte
  und erklärt die Unterschiede.

**Entdeckerheft:** Messprotokoll „Wie weit sieht der Roboter?"

## Plus-Stunde P2 – Die Sensoren entscheiden

**Material:** Tisch-Labyrinth 3 × 3 ohne Innenwände, ein zusätzliches Wandstück, Roboter,
Laptop am Beamer.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Das Programm aus Aufgabe 4 fährt am Tisch, wie in der Simulation. |
| Erarbeitung I | 15 | Die Lehrkraft stellt **ein Wandstück zwischen das linke mittlere und das linke obere Feld** – am Bildschirm ändert sich nichts. Vorhersage im Entdeckerheft: Wo endet der Roboter? Dann **Los!**: Der Bildschirm-Roboter dreht mitten im freien Feld – weil der echte Sensor eine Wand gesehen hat. Ergebnis: Er landet unten in der Mitte, Blick nach links, und die Meldung sagt „Das Programm ist zu Ende, aber du bist noch nicht am Ziel." |
| Erarbeitung II | 15 | **Bau-Wette:** Teams verändern abwechselnd das Tisch-Labyrinth (eine Wand), die anderen wetten vorher: Kommt das Programm zum Stern? |
| Sicherung | 10 | Merksatz: *Am echten Roboter entscheiden die Sensoren, nicht die Zeichnung.* Unterschiede-Wand ergänzen. |

**Knobelaufgabe:** Finde ein Programm mit `wenn`, das **mit und ohne** die Zusatzwand zum
Stern kommt. *(Eine Lösung mit 5 Bausteinen: erst `drehe nach rechts`, dann `wiederhole 8 mal`
mit `wenn vorne frei` → `fahre 1 Feld`, `sonst` → `drehe nach links`. Es fährt unten entlang
und dann rechts hoch – die neue Wand liegt nicht im Weg. Geht es mit 4?)*

## Differenzierung

- **Unterstützung:** Bedingung laut vorlesen lassen („Wenn vorne frei, dann …"); Zweige mit
  Fingern zeigen; im Sensor-Labor fest vorgegebene Abstände.
- **Herausforderung:** Spirale; Forscherfrage über alle Roboter; eigene Messreihe für die
  Seitensensoren (Roboter um 90° drehen).

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Roboter fährt einmal und hört auf | `wenn` ohne Schleife: es fragt nur einmal | `wenn` in `wiederhole` legen |
| Roboter dreht sich endlos im Kreis | Drehen im `wenn`-Zweig, aber `vorne frei` wird nie wahr, oder Bedingung vertauscht | Bedingung laut lesen; mit **Schritt** prüfen |
| `sonst`-Bauch ist leer und nichts passiert | gewollt oder vergessen | erst sagen, was in jedem Fall passieren soll |
| Rechts und links vertauscht | Sicht von außen | „Stell dich hinter den Roboter" |
| Echter Roboter „sieht" eine Wand nicht | Wand zu niedrig, weich, schräg, Lücke zwischen Wandstücken | feste, gerade, ausreichend hohe Wände; Lücken schließen |
| Echter Roboter sieht eine Wand, die nicht da ist | Hand, Kabel oder Tasche im Weg; Nachbar-Labyrinth zu nah | Umgebung frei räumen |
| Ergebnis am Roboter anders als in der Simulation | Tisch-Labyrinth weicht von der Zeichnung ab – oder der Roboter steht schief | das ist die Lektion: die Sensoren entscheiden. Aufstellung prüfen |

## Bewertungsvorschlag

Messprotokoll im Entdeckerheft (vollständig, mit Vermutung zur Ursache) und Aufgabe 4 als
Datei. Mündlich oder schriftlich: Ein Programm wird gezeigt – „Was macht der Roboter in
diesem Feld, und warum?" Stufen: richtiger Zweig benannt (grundlegend); Begründung mit der
Schwelle (erweitert); Spirale gelöst oder eigene Messreihe ausgewertet (vertieft).

## Für die Lehrkraft

Ein **Sensor** wandelt etwas aus der Welt in eine Zahl: Der Ultraschallsensor schickt ein
kurzes „Klick" (zu hoch zum Hören) und misst, wann das Echo zurückkommt. Daraus wird ein
Abstand in Millimetern. Der Roboter vergleicht ihn mit einer **Schwelle**: darunter „Wand",
darüber „frei". Diese Ja/Nein-Antwort steuert die **Verzweigung** (`wenn … sonst`). Im Modus
**Echter Roboter** schickt RatRocket Code bei jedem `wenn` den Befehl `WALLS`, und die Antwort
des Roboters entscheidet – darum klappt ein Programm auch in einem Labyrinth, das anders
gebaut ist als die Zeichnung. Echte Sensoren sind nicht perfekt (Stoff, Schrägen, Lücken);
die Firmware nimmt deshalb den Median mehrerer Messungen, und in ihrem eigenen Escape-Lauf
zählt eine Seite nur als offen, wenn sie während der letzten 6 cm der Anfahrt überwiegend
offen war (so werden die Fugen zwischen Wandstücken nicht für Ausgänge gehalten).
