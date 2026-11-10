# Modul 1 – Erste Schritte: Befehle und Reihenfolge

**Woche 1 · Stunde 1–2 · ab 8 Jahren (Kern: 10–14) · Leiter-Sprosse 1 · Software: verfügbar**

Die Kinder erleben, dass ein Roboter nur wenige, genaue Befehle versteht und sie
streng der Reihe nach ausführt. Sie lösen Aufgabe 1 und 2 in RatRocket Code und
sehen dasselbe Programm auf dem echten Roboter fahren: **Erst simulieren, dann fahren.**

## Lernziele

Die Schülerinnen und Schüler (SuS) können …

1. einen Weg im Raster in eine Folge der Befehle `fahre 1 Feld`, `drehe nach rechts`,
   `drehe nach links` übersetzen (eine Sequenz planen),
2. ein Programm im Kopf ausführen und vorhersagen, wo der Roboter am Ende steht und wohin er schaut,
3. links und rechts aus Sicht des Roboters bestimmen und erklären, dass Drehen auf der Stelle passiert,
4. ein Programm in RatRocket Code bauen, mit **Los!** und **Schritt** testen und einen Fehler mithilfe der Meldung finden,
5. einen Unterschied zwischen Simulation und echtem Roboter beobachten und im Entdeckerheft festhalten.

## Vorbereitung (einmalig, etwa 60 Minuten)

1. **Software:** Den Ordner `web/` auf den Schulrechner oder einen USB-Stick kopieren und
   `web/code.html` in **Chrome oder Edge** öffnen. Es wird nichts installiert, es läuft
   offline. Firefox und Safari zeigen nur die Simulation. IT-Check (optional):
   `code.html?selftest=1` – der Fenstertitel muss `SELFTEST PASS` zeigen.
2. **Selbst ausprobieren:** Aufgabe 1–3 einmal lösen (15 min). `code.html?level=2`
   öffnet eine Aufgabe direkt (praktisch für Arbeitsblätter).
3. **Roboter:** Labyrinth-Modus einstellen: DIP-Schalter **SW3 an, SW1 und SW2 aus**,
   danach die Reset-Taste drücken. Strom laut Bausatz (Akku oder Powerbank).
4. **Verbindung in Woche 1:** USB-C-Kabel vom Laptop zum Roboter („die Leine"). Ab
   Stunde 4 stecken die Kinder das Bluetooth-Modul selbst ein. In RatRocket Code:
   **Roboter verbinden** → Eintrag wählen → oben steht „RatRocket". Erprobt ist das
   Fahren mit Powerbank am USB-C; ob der USB-Strom eures Laptops reicht, vorher mit
   Aufgabe 1 testen.
5. **Tisch-Labyrinth:** 3 × 3 Felder à 16 cm. Wände mindestens so hoch wie die
   Ultraschallsensoren (am Roboter nachmessen). Nicht bündig an die Tischkante bauen.
   „Oben" am Bildschirm ist auf dem Tisch „vom Team weg".
6. **Boden-Raster:** 3 × 3 Felder mit Malerkrepp, Feldgröße etwa ein großer Schritt (50 cm).
7. **Kopien:** Befehlskarten (je Paar 6 × ▲ `fahre 1 Feld`, 3 × ↷ `drehe nach rechts`,
   3 × ↶ `drehe nach links` – dieselben Zeichen wie in der Software), eine Stern-Karte A4,
   Entdeckerheft (siehe [anhang-entdeckerheft.md](anhang-entdeckerheft.md)).

**So steht der Roboter richtig (in allen Aufgaben):** im Feld unten links, Radachse in der
Feldmitte, gerade ausgerichtet, Blick nach „oben". Die Software sagt es beim Einschalten von
**Echter Roboter** selbst: „Stell den Roboter ins Startfeld unten links im Labyrinth, Blick
nach oben (Norden)."

## Stunde 1 – Roboter tun genau, was man sagt

**Material:** Boden-Raster, Befehlskarten, Stern-Karte, ein Laptop je Paar, Beamer,
ein Roboter mit Tisch-Labyrinth (Aufbau Aufgabe 1: keine Innenwände), Entdeckerheft.
**Simulation / Roboter:** Kinder nur Simulation; die Lehrkraft zeigt am Ende eine Fahrt.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 8 | Die Lehrkraft ist der Roboter und steht im Boden-Raster unten links. Die Klasse soll sie zum Stern lotsen. Sie führt **nur wörtlich** aus: „Geh nach vorne" – „Wie weit?"; „Nach rechts" – sie dreht sich nur. Ergebnis an der Tafel: Der Roboter versteht drei Befehle: ▲ `fahre 1 Feld`, ↷ `drehe nach rechts`, ↶ `drehe nach links`. Drehen heißt: auf der Stelle, ohne Schritt. |
| Erarbeitung I | 12 | Paare, ohne Computer: Ein Kind legt Befehlskarten von oben nach unten, das andere läuft sie im Raster ab (oder schiebt eine Spielfigur mit „Nase" auf dem Papier-Raster). Regel: erst das ganze Programm legen, dann ablaufen. Rollen tauschen. Die Lehrkraft legt den Stern zweimal um. |
| Erarbeitung II | 15 | Beamer (3 min): Aufgabe 1 „Geradeaus" öffnen, einen Baustein aus **Bausteine** in **Dein Programm** ziehen (zwischen Start und Ende), **Los!**, **Schritt**, **Zurück**; löschen = auf „Zum Löschen hierher ziehen". Dann lösen die Paare Aufgabe 1. Wer fertig ist, versucht Aufgabe 2. |
| Sicherung | 10 | Die Lehrkraft schaltet **Echter Roboter** ein und startet dasselbe Programm am Tisch. Vorher kreuzen alle im Entdeckerheft an: „Kommt er an?" Merksatz an die Tafel: *Ein Programm ist eine Liste von Befehlen. Der Roboter führt sie der Reihe nach aus – von oben nach unten.* |

Aufgabe 1 „Geradeaus" (Start unten links, Blick nach oben; `*` = Stern):

```
      0   1   2
    +---+---+---+
  2 | *         |
    +   +   +   +
  1 |           |
    +   +   +   +
  0 | ^         |
    +---+---+---+
```

Erwartetes Programm (2 Bausteine, 3 Sterne):

```
fahre 1 Feld
fahre 1 Feld
```

**Knobelaufgabe (für Schnelle):**
- *Kopf-Roboter:* Leeres 3 × 3-Raster, Start unten links, Blick nach oben. Programm:
  `fahre 1 Feld`, `drehe nach rechts`, `fahre 1 Feld`, `fahre 1 Feld`, `drehe nach links`,
  `drehe nach links`, `fahre 1 Feld`. Wo steht der Roboter, wohin schaut er – ohne
  Computer? *(Lösung: Mittelfeld, Blick nach links.)*
- *Nur rechts:* Start unten links, Blick nach **rechts**, Stern oben links. Es gibt keine
  ↶-Karten mehr. Wie viele Karten brauchst du mindestens? *(5: dreimal ↷ ergibt eine
  Linksdrehung, dann zweimal ▲.)*

**Entdeckerheft:** Vorhersage und Beobachtung zur Demo-Fahrt.

## Stunde 2 – Um die Ecke – und dann in echt

**Material:** Laptops, ein Roboter je Team mit USB-C-Kabel, 1–3 Tisch-Labyrinthe im
Aufbau von Aufgabe 2 (zwei Wandstücke in der unteren Reihe), Entdeckerheft, Plakat
„Unterschiede-Wand".
**Simulation / Roboter:** alle in der Simulation; jedes Team fährt einmal am Tisch.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 7 | Tafel: Labyrinth von Aufgabe 2. „Kann der Roboter einfach nach rechts fahren?" – Nein: erst drehen, dann fahren. Zwei Kinder spielen es vor. Trick für rechts/links: „Stell dich hinter den Roboter." |
| Erarbeitung I | 15 | Aufgabe 2 in der Simulation. Ziel: 3 Sterne (höchstens 5 Bausteine). Fehler sind erwünscht: Meldung lesen, mit **Schritt** die Stelle finden. Der **Tipp**-Knopf ist erlaubt. Fertig? Knobelaufgabe. |
| Erarbeitung II | 15 | Roboter-Station: Das Team verbindet seinen Roboter, stellt ihn unten links (Blick vom Team weg), schaltet **Echter Roboter** ein, **Los!**. Ein Kind hält die Kabel-Leine locker hoch. Etwa 3 Minuten je Team; Wartende schreiben ihre Vorhersage ins Entdeckerheft. |
| Sicherung | 8 | „Was war am echten Roboter anders?" (z. B. langsamer, dreht nicht ganz genau, Kabel zieht). Jede Beobachtung kommt als Zettel an die **Unterschiede-Wand** – sie wird in Woche 6 zur Tagesordnung der Werkstatt. Merksatz: *Erst simulieren, dann fahren.* |

Aufgabe 2 „Um die Ecke":

```
      0   1   2
    +---+---+---+
  2 |         * |
    +   +   +   +
  1 |           |
    +   +   +   +
  0 | ^ |   |   |
    +---+---+---+
```

Erwartetes Programm (5 Bausteine, 3 Sterne):

```
fahre 1 Feld
fahre 1 Feld
drehe nach rechts
fahre 1 Feld
fahre 1 Feld
```

**Knobelaufgabe (für Schnelle):**
- *Alle kürzesten Wege:* Drei Wege fahren nur 4 Felder. Finde alle drei und zähle ihre
  Bausteine. Welcher ist am billigsten – und warum? *(hoch-hoch-rechts-rechts: 5;
  hoch-rechts-rechts-hoch: 6; hoch-rechts-hoch-rechts: 7. Jede Kurve kostet Bausteine –
  und am echten Roboter Zeit.)*
- *Ohne rechts:* Löse Aufgabe 2 ohne `drehe nach rechts` (7 Bausteine, dreimal
  `drehe nach links`). Kommt der echte Roboter damit genauso gut an? Warum nicht ganz?
- *Blindflug:* Die Lehrkraft zeigt ein neues Labyrinth 30 Sekunden lang. Programm auf
  Papier schreiben, eintippen, **ein** Versuch.

**Entdeckerheft:** „Simulation – echter Roboter – was war anders?"

## Differenzierung

- **Unterstützung:** Befehlskarten neben dem Laptop; **Schritt** statt **Los!**; Tempo-Regler
  nach links; Spielfigur mit Nase auf dem Papier mitbewegen; feste Rollen im Team
  (Bauen – Vorlesen/Prüfen – Roboter-Chef:in). Für Jüngere (8–9): Stunde 1 doppelt so lange
  unplugged, Software erst in Stunde 2.
- **Herausforderung:** die Knobelaufgaben; Blindflug-Runden; Aufgabe 3 vorziehen.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Kind erwartet, dass `drehe nach rechts` nach rechts fährt | Drehen passiert auf der Stelle | Kind dreht sich selbst; danach `fahre 1 Feld` |
| Rechts und links vertauscht, wenn der Roboter nach unten fährt | Sicht von außen statt Sicht des Roboters | Spielfigur mit Nase; hinter den Roboter stellen |
| „Autsch – da ist eine Wand. Schau dir den Weg noch einmal an." | Programm führt durch eine Wand | **Schritt** drücken, bis es passiert; den Baustein davor prüfen |
| „Das Programm ist zu Ende, aber du bist noch nicht am Ziel." | Baustein fehlt | Weg mit dem Finger nachfahren, Felder zählen |
| „Dein Programm ist noch leer. Zieh Bausteine aus der Box." | Baustein nicht im Programmbereich abgelegt | bis zwischen **Start** und **Ende** ziehen |
| „Verbinde zuerst den Roboter." | **Echter Roboter** an, aber nicht verbunden | **Roboter verbinden** |
| „Dieser Browser kann keine Geräte anschließen. Nimm Chrome oder Edge." | Firefox oder Safari | Chrome oder Edge |
| Verbunden, aber der Roboter fährt nicht; nach 15 s kommt trotzdem „Autsch …" | Roboter nicht im Labyrinth-Modus, falscher Anschluss oder kein Strom (die Seite wartet auf eine Antwort, die nie kommt – die Wand-Meldung ist hier irreführend) | DIP-Schalter prüfen (SW3 an), Reset, neu verbinden |
| Roboter fährt aus dem Labyrinth oder in die falsche Richtung | Tisch-Labyrinth anders herum gebaut als am Bildschirm | „Oben" am Bildschirm = vom Team weg |
| Roboter fährt etwas zu kurz oder dreht etwas zu weit | normale Ungenauigkeit (Räder, Boden, Akku, ziehendes Kabel) | **Nicht** im Programm ausgleichen. An die Unterschiede-Wand – das klären wir in der Werkstatt (Woche 6). |

## Bewertungsvorschlag

Keine Note in Modul 1. Lernstand in drei Stufen:
1. löst Aufgabe 1 mit Hilfe; 2. löst Aufgabe 2 selbstständig und erklärt Drehen auf der
Stelle; 3. löst die Kopf-Roboter-Aufgabe ohne Computer und begründet, warum Kurven
Bausteine kosten. Belege: Entdeckerheft Seite 1, auf Wunsch die Datei
`ratrocket-aufgabe2.json` (Knopf **Speichern**).

## Für die Lehrkraft

Ein Computer „versteht" nichts: Er führt Anweisungen genau und der Reihe nach aus. Eine
solche Folge heißt **Sequenz**; ein Programm, das ein Problem sicher löst, heißt
**Algorithmus**. Die wichtigste Fähigkeit ist hier das *Vorhersagen*: Wer ein Programm im
Kopf ausführen kann, findet Fehler (**Debuggen**) schneller als jemand, der probiert.
Deshalb immer erst vorhersagen lassen, dann **Los!**. Die Simulation ist perfekt, der echte
Roboter nicht: Er misst mit Zählern an den Rädern und kann um Millimeter abweichen. Das ist
kein Fehler der Kinder, sondern der Stoff für die Werkstatt in Woche 6 – deshalb wird jede
Abweichung gesammelt statt weggeredet.
