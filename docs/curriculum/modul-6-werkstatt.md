# Modul 6 – Werkstatt: Motoren, Messen, Regeln

**Woche 6 · Stunde 11–12 (+ Plus-Stunde P3) · ab 11 Jahren (Kern: 12–16) · Leiter-Sprossen 4 und 5**
**Software:** Roboter-Seite **verfügbar** – Motor-Test-Modus (`PWM`, `JOG`, `SWEEP`, `ENC`,
`PWMFREQ`), PID-Test-Modus (`KP`, `KI`, `KD`, `FWD`, `TEL`), Kalibrierbefehle im
Labyrinth-Modus (`CALDIST`, `TRACK`, `THR`). Heute bedient über das Befehlsfeld der
englischen Testseite `web/maze_event.html`.
**Verfügbar – Stand November 2026:** die Werkstatt-Seite `web/werkstatt.html` mit drei Tabs:
Motoren & Pulse (Schieberegler, Live-Pulszähler, Pulse-pro-Umdrehung-Experiment, Tastgrad-Kurve),
PID-Regler (erst nach Gefühl, dann benannt, Live-Diagramm) und Kalibrieren (Strecke, Geradeaus,
Drehung, Zentrierung, Speichern mit Lehrkraft-Freigabe). Die Seite prüft den DIP-Modus.
**Geplant:** Gyro-Regelung der Drehungen (Gyro ist angeschlossen), parametrische Bausteine
(`fahre … cm`, `drehe … Grad`, Tempo).

Seit Woche 1 hängt die **Unterschiede-Wand**: alles, was der echte Roboter anders macht als
die Simulation. Jetzt wird sie abgearbeitet. Die Kinder öffnen die „Motorhaube": Was ist eine
Umdrehung, ein Puls, PWM? Wie weiß der Roboter, wie weit er gefahren ist – und wie hält er
Kurs, obwohl ein Motor schwächer ist?

## Lernziele

Die SuS können …

1. Umdrehung, Radumfang (U = π · d) und Zählimpulse (Pulse) in Beziehung setzen und daraus
   eine Strecke berechnen,
2. PWM als schnelles Ein- und Ausschalten (high/low) mit einem Tastgrad erklären und am Rad
   beobachten; die Drehrichtung über das Vorzeichen steuern,
3. eine Messreihe planen, Mittelwert und Streuung bestimmen und eine Kalibrierung mit dem
   Dreisatz begründen,
4. eine Regelung zuerst nach Gefühl einstellen und danach die Anteile P, I und D benennen
   und gezielt verändern,
5. Unterschiede zwischen Simulation und Roboter auf Ursachen zurückführen (Strecke,
   Drehung, Geradeauslauf, Sensoren, Zeit).

## Sicherheits- und Ordnungsregeln für beide Stunden

- **Räder in der Luft:** Im Motor- und PID-Test steht der Roboter auf einem Klötzchen.
- `STOP` beendet jede Bewegung. Bei Brummen, Zittern oder Geruch: `STOP`, ausschalten.
- **Nie `SAVE` und nie `DEFAULTS` tippen** (das überschreibt bzw. löscht die gespeicherte
  Kalibrierung). Ein Reset stellt die gespeicherten Werte wieder her.
- Am Ende: alle Roboter zurück in den Labyrinth-Modus (SW3 an, SW1/SW2 aus, Reset).

## Stunde 11 – Motoren: Umdrehung, Pulse, PWM

**Material:** je Team Roboter im **Motor-Test-Modus** (nur SW2 an, Reset), Klötzchen,
Klebe-Fähnchen am linken Rad, Laptop mit Testseite (Bluetooth), Taschenrechner,
Entdeckerheft (Messprotokoll). Lehrkraft: eine Schreibtischlampe mit Schalter für den Einstieg.
**Simulation / Roboter:** nur Roboter.
**Beamer/Station:** Erklär-Seiten „Pulse zählen/Encoder" und „PWM" in `web/learn.html` (im Aufbau – Stand November 2026).

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 8 | Unterschiede-Wand gemeinsam sortieren: *Strecke, Drehung, Geradeaus, Sensoren, Zeit.* Frage: „Woher weiß der Roboter, wie weit er gefahren ist?" PWM-Experiment ohne Technik: Lampe sehr schnell ein- und ausschalten – sie wirkt „halb hell". Genauso halbiert der Roboter die Kraft: Er schaltet den Motor tausende Male pro Sekunde ein (*high*) und aus (*low*). Der Anteil „ein" heißt **Tastgrad**. |
| Erarbeitung I | 12 | **Pulse zählen:** `ENC0`, das linke Rad von Hand genau eine Umdrehung drehen (Fähnchen oben → oben), `ENC`. Dreimal messen, Mittelwert. Bruchteile mit der Uhr angeben („bis 3 Uhr" = eine Viertelumdrehung). Danach `JOG L 1000` – der Motor dreht selbst 1000 Pulse weit: Welcher Bruchteil einer Umdrehung ist das? |
| Erarbeitung II | 15 | **PWM am Rad:** `PWM 150 0 2000` (linkes Rad, Tastgrad 150 von 1010, zwei Sekunden). Dreht es? Schrittweise erhöhen (200, 250, 300 …) bis zur **Anlauf-Schwelle**. Dann `PWM -400 0 2000`: andere Richtung. Dann `SWEEP`: Der Roboter fährt beide Räder mit steigendem Tastgrad und druckt eine Tabelle „duty – counts/s". Ins Protokoll übertragen. Hörprobe: `PWMFREQ` zeigt die Schaltfrequenz; mit `PWMFREQ 1000` und `PWMFREQ 10000` jeweils `PWM 500 0 3000` – der Ton ändert sich. |
| Sicherung | 10 | Merksätze: *Eine Umdrehung sind viele Pulse – so misst der Roboter Strecke. PWM: schnell ein und aus; der Tastgrad bestimmt die Kraft. Unter einer Schwelle dreht sich nichts (Haftreibung). Das Vorzeichen bestimmt die Richtung.* Reset (Frequenz wieder normal), zurück in den Labyrinth-Modus. |

**Die Kalibrier-Geschichte (wahr, aus der Entwicklung):** Die Entwickler hatten die Pulse pro
Umdrehung zuerst mit dem Auge gezählt: etwa 2510. Dann sollte der Roboter 300 mm fahren – er
fuhr nur 262 mm. Mit dem Dreisatz: 2510 · 300 / 262 ≈ 2874 Pulse pro Umdrehung; bei einem
Rad von 34 mm Durchmesser (Umfang ≈ 106,8 mm) sind das etwa 26,9 Pulse pro Millimeter. Genau
diese Rechnung macht der Befehl `CALDIST 300 262` im Labyrinth-Modus. **Heute** kalibriert die
Lehrkraft so über das Befehlsfeld (am Lineal `FWD 300`, messen, `CALDIST 300 <gemessen>`,
`SAVE`). **Verfügbar:** die Werkstatt „Kalibrieren" (Schritt Strecke) führt die Kinder
durch genau diese Messung.

**Knobelaufgabe (wirklich schwer):**
- *Rechnen:* Wie viele Pulse braucht der Roboter für ein Feld (160 mm)? *(≈ 4300.)* Wie viele
  Pulse sind ein Millimeter Fehler, wenn das Rad 0,5 mm kleiner ist als gedacht?
- *Forscherfrage – das ungelöste Rätsel:* Von Hand in der Luft gezählt ergeben sich rund
  2500 Pulse pro Umdrehung, aus der Fahrt auf dem Boden zurückgerechnet 2874. Beides wurde
  wirklich so gemessen. Woran kann das liegen? Plane ein Experiment, das zwischen deinen
  Vermutungen entscheidet (zum Beispiel: Reifen drückt sich ein, Rad rutscht, Zählfehler).
- *Spiegel-Rätsel:* Für „vorwärts" drehen beide Räder – von außen betrachtet – in
  verschiedene Richtungen (eins im, eins gegen den Uhrzeigersinn). Warum? Und warum muss die
  Firmware das Vorzeichen eines Radzählers umdrehen?
- *Takt:* Bei 1000 Hz dauert ein Ein-Aus-Takt wie lange? Bei Tastgrad 25 %: wie lange ist er
  *high*? *(1 ms; 0,25 ms.)*

**Entdeckerheft:** Messprotokoll Pulse und Anlauf-Schwelle, Tabelle aus `SWEEP` (Diagramm:
Tastgrad nach rechts, Geschwindigkeit nach oben).

**Geplant – Stand November 2026:** ein Motor-Panel (Tastgrad-Regler, Richtungsschalter,
Live-Pulszähler, Diagramm), damit nichts getippt werden muss.

## Stunde 12 – Regeln: PID nach Gefühl, dann mit Namen

**Material:** je Team Roboter im **PID-Test-Modus** (SW1 und SW2 an, Reset), Klötzchen,
Laptop mit Testseite, Malerkrepp-Linie am Boden, Augenbinde, Karte „Drei Drehknöpfe" (unten),
Entdeckerheft.
**Beamer/Station:** Erklär-Seite „Was ist PID?" (Schieberegler, Live-Fehlerkurve) in `web/learn.html` (im Aufbau – Stand November 2026) – gut zwischen Durchgang 1 und 2.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 8 | **Ankommen-Spiel:** Ein „Motor"-Kind geht mit geschlossenen Augen auf eine Linie zu, ein „Regler"-Kind darf alle zwei Sekunden nur ein Tempo von 0 bis 3 ansagen. Runde 1: nur „3" oder „0" (Gas oder Stopp) – es schießt über die Linie. Runde 2: „je näher, desto langsamer". Runde 3: „wenn wir immer zu kurz sind, legen wir etwas drauf" und „wenn wir schnell näherkommen, früher bremsen". |
| Erarbeitung I – nach Gefühl | 15 | Jedes Team: `GAINS` (Startwerte abschreiben), dann für **Knopf A** drei Werte ausprobieren, jeweils `FWD 300` und zuschauen und zuhören. Knopf A ist `KP` – der Name wird noch nicht verraten. Danach Knopf B (`KI`). Notieren: Wie bewegt sich das Rad? Wie groß ist der Fehler am Ende (`[EV] DONE … final err L=… R=… counts`)? |
| Erarbeitung II – mit Namen | 12 | Auflösung: **P** schaut auf den Abstand *jetzt* (Gegenwart), **I** sammelt Fehler aus der *Vergangenheit*, **D** schaut, wie schnell sich der Fehler ändert (*Zukunft*). Mit `TEL 100` druckt der Roboter zehnmal pro Sekunde Soll- und Ist-Geschwindigkeit (`[P] … vt=… v=… e=… d=…`). Teams stellen zwei Charaktere ein: „sanft" und „sportlich", und begründen ihre Werte. `TEL 0` schaltet die Liste ab. |
| Sicherung | 10 | Merksatz: *Ein Regler misst ständig, vergleicht mit dem Soll und korrigiert – beim Roboter tausendmal pro Sekunde für jedes Rad.* Reset (alle Werte wieder normal), zurück in den Labyrinth-Modus. Entdeckerheft. |

Karte „Drei Drehknöpfe" (Startwerte der Firmware: `KP 3`, `KI 6`, `KD 0.05`):

| Knopf | Probierwerte | Was man typischerweise sieht |
|---|---|---|
| A (`KP`) | `KP 1` · `KP 3` · `KP 9` | klein: weich, aber am Ende ungenauer; groß: zackig, kann brummen oder zittern |
| B (`KI`) | `KI 0` · `KI 6` · `KI 18` | 0: kleiner Restfehler bleibt; groß: schießt über und pendelt |
| C (`KD`) | `KD 0` · `KD 0.05` · `KD 0.3` | dämpft das Pendeln; zu groß: unruhig |

Beim Tippen **Punkt statt Komma** (`KD 0.3`). „Typischerweise" – genau das sollen die Kinder
an *ihrem* Roboter herausfinden.

**Knobelaufgabe (wirklich schwer):**
- *Kleinster guter Wert:* Finde den kleinsten `KP`, bei dem der Endfehler unter 5 Pulsen
  bleibt. Wie vielen Millimetern entspricht das?
- *Warum fährt er geradeaus?* Der linke Motor braucht bei kleinem Tempo deutlich mehr
  Tastgrad als der rechte (gemessen). Trotzdem fährt der Roboter gerade. Erkläre mit den
  Begriffen *Regler* und *Haftreibung* (der Startwert `KS` ist genau die Anlauf-Schwelle aus
  Stunde 11).
- *Daten-Detektiv (Oberstufe):* `[P]`-Zeilen in eine Tabellenkalkulation kopieren und Soll-
  gegen Ist-Geschwindigkeit plotten. Wo hinkt das Rad hinterher?
- *Schwellen sind auch Drehknöpfe:* Im Labyrinth-Modus setzt `THR <vorne> <seite>` die
  Wand-Schwellen aus Stunde 6 (Werkseinstellung etwa 113 und 128 mm). Was passiert im
  Sensor-Labor mit `THR 60 128`? (Reset stellt alles zurück.)

**Geplant – Stand November 2026:** PID-Werkstatt mit Schiebereglern für P, I, D und einem
Live-Diagramm (Soll gegen Ist); später eine Gyro-Werkstatt (Drehrate messen). Für den
Gyro gibt es auf der Platine einen Steckplatz (IMU), aber noch keine Firmware.

## Plus-Stunde P3 – Drehen messen und kalibrieren

**Material:** Winkelscheibe (Kopie, 0–360° in 5°-Schritten, Mittelpunkt markiert), Klebepfeil
auf dem Roboter, Laptops, Roboter im Labyrinth-Modus.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | „Roboter dreht zu weit" von der Unterschiede-Wand. |
| Erarbeitung I | 20 | Roboter mit der Radachse über den Mittelpunkt der Winkelscheibe. RatRocket Code, Aufgabe 3, Programm `wiederhole 4 mal` / `drehe nach rechts`, **Echter Roboter**, **Los!** (die Meldung „noch nicht am Ziel" ist hier egal). Abweichung ablesen. Dann `wiederhole 4 mal` mit `drehe nach links`. Dann dreimal hintereinander: Wächst der Fehler? |
| Erarbeitung II | 10 | Rechnen: Bei einer Vierteldrehung fährt jedes Rad ein Viertel eines Kreises, dessen Durchmesser die **Spurbreite** ist (96 mm): π · 96 / 4 ≈ 75 mm. Dreht der Roboter zu weit, glaubt er an eine zu große Spurbreite. Regel aus der Firmware: neue Spurbreite = alte Spurbreite · 360 / gemessener Winkel einer vollen Drehung. |
| Sicherung | 10 | Lehrkraft-Demo über das Befehlsfeld: `TURN 360`, messen, `TRACK <neuer Wert>`, nochmal `TURN 360`. (Erst wenn es passt: `SAVE`.) Entdeckerheft. |

**Knobelaufgabe:** Der Roboter dreht bei `TURN 360` auf 370°. Welche Spurbreite muss man
einstellen? *(96 · 360 / 370 ≈ 93,4 mm.)* Warum wird ein Drehfehler im Labyrinth schlimmer als
ein Streckenfehler? *(Ein schiefer Roboter fährt jedes weitere Feld schräg.)*

## Differenzierung

- **Unterstützung:** fertige Messtabellen; Befehle auf Karten zum Abschreiben; Rechenwege mit
  Lücken; Rollen (Tippen, Beobachten, Protokoll).
- **Herausforderung:** Forscherfrage 2500 gegen 2874; Daten-Detektiv; Spiegel-Rätsel; eigene
  Messreihe Tempo gegen Endfehler.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| „Roboter dreht zu weit" | eingestellte Spurbreite passt nicht; glatter Boden (Rad rutscht); Staub auf den Reifen | messen statt raten (P3); Reifen abwischen; anderer Untergrund |
| „Roboter fährt zu kurz / zu weit" | Pulse pro Millimeter passen nicht (Raddurchmesser, Reifen) | `FWD 300` am Lineal, `CALDIST` (Lehrkraft) |
| „Roboter fährt schief" | Räder unterschiedlich, Untergrund | Lehrkraft: `TRIM <Prozent>` (+ wenn er nach links zieht) |
| `PWM 150 …` – nichts dreht sich | unter der Anlauf-Schwelle (Haftreibung) | das ist das Ergebnis, kein Fehler |
| Rad läuft andersherum als erwartet | Vorzeichen; Blick von der anderen Seite | Spiegel-Rätsel |
| „? unknown …" | Befehl gibt es in diesem Modus nicht | `HELP`; Schalter prüfen |
| `FWD` im PID-Test endet mit „ABORT following error" | Rad blockiert (berührt das Klötzchen?) | Roboter höher stellen |
| Nach der Stunde fährt der Roboter in RatRocket Code nicht | noch im Motor- oder PID-Test | Labyrinth-Modus herstellen, Reset |

## Bewertungsvorschlag

Messprotokoll als Hauptleistung (sauber geführt, Mittelwert und Streuung, eine begründete
Vermutung zur Ursache). Kurzer schriftlicher Test: Strecke aus Pulsen berechnen; PWM in zwei
Sätzen erklären; P, I und D je einem Verhalten zuordnen. Stufen: Rechnung richtig
(grundlegend); Kalibrierung mit dem Dreisatz begründet (erweitert); Forscherfrage mit eigenem
Experiment-Plan (vertieft).

## Für die Lehrkraft

Der Roboter weiß nicht, wo er ist – er **zählt**. An jedem Motor sitzt ein Encoder, der bei
jeder kleinen Drehung einen Puls liefert; aus Pulsen und Radumfang wird Strecke. Stimmt die
angenommene Radgröße nicht, stimmt jede Strecke ein wenig nicht: Das ist ein **systematischer
Fehler**, den man durch **Kalibrieren** (Messen gegen ein Lineal und Umrechnen) beseitigt. Die
Kraft am Motor stellt der Mikrocontroller mit **PWM** ein: Er schaltet sehr schnell ein und
aus, der Motor „sieht" den Mittelwert. Damit beide Räder trotz unterschiedlicher Motoren genau
dem Plan folgen, misst ein **Regler** tausendmal pro Sekunde den Abstand zwischen Soll und Ist
und korrigiert: P reagiert auf den Fehler jetzt, I auf den aufsummierten Fehler, D auf seine
Änderung. Dazu kommen eine Vorsteuerung (`KFF`) und ein Anlauf-Zuschlag gegen die
Haftreibung (`KS`). Wer das einmal am Rad gesehen hat, versteht, warum „1 Feld" im Labyrinth
genau trifft – und warum es trotzdem nie perfekt ist.
