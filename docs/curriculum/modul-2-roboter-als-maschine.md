# Modul 2 – Der Roboter als Maschine: Schalter, Bluetooth, Fernsteuern

**Woche 2 · Stunde 3–4 · ab 9 Jahren (Kern: 10–14) · Leiter-Sprossen 2 und 3**
**Software:** Roboter-Seite **verfügbar** (Betriebsarten, Start-Meldungen, Fahrbefehle).
Oberflächen: heute die englische Testseite `web/maze_event.html` mit Befehlsfeld;
eine deutsche Fernsteuer-Seite mit Pfeiltasten ist **geplant – Stand November 2026**.

Nach dem ersten Programmieren schauen die Kinder in die Maschine: Ein Roboter hat mehrere
Programme an Bord und wählt beim Start mit kleinen Schaltern eines aus. Dann stecken sie
das Bluetooth-Modul selbst ein, schneiden „die Leine" ab und steuern den Roboter fern –
bevor sie ihn in den folgenden Wochen immer klüger programmieren.

## Lernziele

Die SuS können …

1. erklären, dass der Roboter mehrere Betriebsarten (Modi) gespeichert hat und sie beim
   Start über die DIP-Schalter auswählt,
2. eine Schalterstellung als Zahl lesen (SW1 = 1, SW2 = 2, SW3 = 4) und begründen, warum es
   mit drei Schaltern acht Möglichkeiten gibt,
3. ein Elektronik-Modul sicher einstecken (Strom aus, Beschriftung vergleichen, prüfen lassen),
4. den Roboter mit Textbefehlen fernsteuern und erklären, dass jeder Baustein in RatRocket
   Code ebenfalls nur einen Befehl schickt (`fahre 1 Feld` = `CELL`),
5. Fernsteuern und Programmieren vergleichen: Wer entscheidet wann?

## Die Testseite in zwei Sätzen

`web/maze_event.html` (Chrome/Edge, englisch) ist die Werkstatt-Seite des Roboters.
**Connect robot** verbindet, im Kasten **Robot log** steht alles, was der Roboter sagt,
und darunter schickt das Befehlsfeld („Command, e.g. US, CFG, TURN 90, HELP") mit **Send**
einen Befehl. Die Befehle sind kurz und auf Englisch; die Kinder brauchen nur die
Befehlskarte dieser Stunde.

## Stunde 3 – Schalter, Modi, Neustart

**Material:** je Team Roboter mit USB-C-Kabel, Laptop mit Testseite, Zahnstocher (die
DIP-Schalter sind winzig), ein Klötzchen oder eine kleine Schachtel (Roboter darauf, Räder
in der Luft), Arbeitsblatt „Modus-Detektiv" (Tabelle unten), Entdeckerheft.
**Simulation / Roboter:** nur Roboter, Motoren bleiben in dieser Stunde aus.
**Beamer/Station:** für den Rad-Zähler die Erklär-Seite „Pulse zählen/Encoder" in `web/learn.html` (im Aufbau – Stand November 2026).

Die Betriebsarten (aus `docs/firmware.md`; SW4 hat keine Funktion):

| SW1 | SW2 | SW3 | Zahl | Modus | Antwort auf `HELP` beginnt mit |
|---|---|---|---|---|---|
| aus | aus | aus | 0 | Simulator-Modus für Entwickler (spricht nur über ein internes Kabel) | – keine Antwort – |
| an | aus | aus | 1 | Bluetooth-Test (Motoren aus) | Liste mit `PING`, `DIP`, `BAT`, `ENC`, `LED` … |
| aus | an | aus | 2 | Motor-Test (Räder in der Luft!) | „Motor test commands" |
| an | an | aus | 3 | PID-Test (Räder in der Luft!) | „PID test commands" |
| aus | aus | an | 4 | **Labyrinth-Modus** (für RatRocket Code) | „Maze mode commands" |
| andere | | | 5–7 | kein Modus: „No mode assigned", Motoren aus | – keine Antwort – |

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 7 | Waschmaschine oder Toaster: Ein Drehknopf wählt das Programm. Unser Roboter hat dafür vier kleine **DIP-Schalter**. Er liest sie nur **beim Start** – warum wohl? (Damit sich mitten in der Fahrt nichts ändert.) Tafel: SW1 zählt 1, SW2 zählt 2, SW3 zählt 4. |
| Erarbeitung | 28 | **Modus-Detektiv** in Teams, Zeile für Zeile: (1) Schalter mit dem Zahnstocher umlegen, (2) Reset-Taste drücken – der Roboter startet neu und verschwindet dabei kurz vom USB, (3) auf der Testseite neu **Connect robot**, (4) `HELP` senden und die erste Zeile notieren, (5) einen harmlosen Befehl ausprobieren. Im Bluetooth-Test: `DIP` senden, einen Schalter umlegen, wieder `DIP` – die Zahl ändert sich sofort; `LED R` schaltet die rote LED; `ENC0`, dann ein Rad von Hand eine Umdrehung drehen, `ENC` – der Zähler läuft. Im Labyrinth-Modus: `WALLS` senden, dann eine Hand vor den vorderen Sensor halten, wieder `WALLS`. Motor- und PID-Test: nur `HELP` lesen (die Motoren kommen in Woche 6). |
| Sicherung | 10 | Tabelle vergleichen: Welche Zahl hat der Labyrinth-Modus? (4.) Was passiert bei Zahl 5? (Stille.) **Alle Roboter zurück in den Labyrinth-Modus** (SW3 an, SW1 und SW2 aus, Reset) – die Lehrkraft hakt jedes Team ab. Entdeckerheft: „Der Roboter ist nicht ein Programm, sondern …" |

**Knobelaufgabe (für Schnelle):**
- *Binär-Detektiv:* Schreibe alle acht Schalterstellungen als Zahl und als Folge aus 0 und 1
  (SW3 SW2 SW1). Der Labyrinth-Modus ist `100`. Wie viele Modi wären mit vier Schaltern möglich? (16.)
- *Rad-Zähler:* Drehe im Bluetooth-Test ein Rad von Hand genau eine Umdrehung (Klebe-Fähnchen
  als Markierung). Wie viele Zählimpulse sind das? Dreimal messen. Streuen die Werte? Warum?
  (Merkt euch die Zahl – in Woche 6 vergleichen wir sie mit der Fahrt auf dem Boden.)
- *Gute Frage:* Warum antwortet der Roboter bei „alle Schalter aus" nicht, obwohl er läuft?

**Entdeckerheft:** Modus-Tabelle mit eigenen Beobachtungen.

## Stunde 4 – Bluetooth einstecken und fernsteuern

**Material:** je Team Roboter mit eigenem Strom (Akku oder Powerbank), ein HC-05-Bluetooth-Modul,
Laptop mit Testseite, Befehlskarte (unten), am Boden ein Klebeband-Parcours (Garage 25 × 25 cm,
zwei Becher als Slalom), Entdeckerheft. **Fernsteuern nur auf dem Boden**, nicht auf Tischen.
**Simulation / Roboter:** nur Roboter, Labyrinth-Modus.

**Vorbereitung durch die Lehrkraft:** Ein Modul selbst einstecken und ein Foto der richtigen
Lage aushängen; Modul und Steckplatz (Leiste „BT") mit einem Lackstift-Punkt markieren.
Jeder Roboter braucht einen **eigenen Bluetooth-Namen** und einen Aufkleber mit demselben
Namen – sonst heißen alle „RatRocket" und die Teams verbinden sich mit fremden Robotern.
Umbenennen geht im Bluetooth-Test mit `BTNAME <name>` (dabei die Taste am Modul halten,
siehe Knobelaufgabe); das erledigt am besten der Makerspace vorab.

Befehlskarte „Fernsteuern" (Labyrinth-Modus; groß/klein egal):

| Befehl | Was passiert |
|---|---|
| `FWD 160` | 160 mm vorwärts (ein Feld) |
| `FWD -160` | ein Feld rückwärts |
| `TURN 90` / `TURN -90` | auf der Stelle nach rechts / nach links drehen |
| `TURN 180` | umdrehen |
| `FWD 320 120` | 320 mm mit 120 mm/s (Standard sind 80 mm/s) |
| `STOP` | sofort anhalten |
| `CELL` | genau das, was der Baustein `fahre 1 Feld` schickt |
| `WALLS` | genau das, was ein `wenn`-Baustein fragt: Wände vorne, links, rechts |

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | „Bis jetzt hing der Roboter an der Leine. Heute schneiden wir sie ab." Modul zeigen. Drei Sicherheitsregeln an die Tafel: **Strom aus. Beschriftung vergleichen (VCC an +5V, GND an GND). Erst die Lehrkraft prüft, dann einschalten.** Falsch herum eingesteckt kann ein Modul kaputtgehen. |
| Erarbeitung I | 12 | Einstecken, „Piloten-Check" durch die Lehrkraft, einschalten: Die LED am Modul blinkt schnell = wartet auf einen Partner. Koppeln (Windows: Einstellungen → Bluetooth → Gerät hinzufügen, Name vom Aufkleber, PIN `1234`). Testseite: **Connect robot**, den Bluetooth-Anschluss wählen, `PING` senden → `PONG`. Das Blinken ändert sich: verbunden. |
| Erarbeitung II | 20 | **Fernsteuer-Parcours** am Boden: aus der Startlinie in die Garage einparken, dann Slalom um die Becher. Wertung: so wenige Befehle wie möglich, die Garage muss getroffen sein. Danach probiert jedes Team `CELL` und `WALLS` – genau diese Befehle schickt RatRocket Code, wenn ein Programm läuft. |
| Sicherung | 8 | Merksatz: *Fernsteuern: Ich schicke jeden Befehl selbst und entscheide in jedem Moment. Programmieren: Ich schreibe alle Befehle vorher auf, der Computer schickt sie.* Entdeckerheft: „Wofür ist Fernsteuern besser, wofür ein Programm?" |

**Knobelaufgabe (für Schnelle):**
- *Sechseck:* Fahre ein regelmäßiges Sechseck und komm genau am Start an. Welcher Winkel an
  jeder Ecke? (60°, denn sechs Ecken ergeben zusammen eine volle Drehung von 360°.) Und ein
  Zwölfeck? Wie viele Befehle insgesamt?
- *Kreis aus Ecken:* Je mehr Ecken, desto runder: Fahre ein „Fast-Kreis" mit `FWD 40` und
  `TURN 20` im Wechsel. Wie oft? (18-mal.) Landet der Roboter wieder am Start? Ins
  Entdeckerheft: Wie weit daneben – und warum?
- *Taufe (mit Lehrkraft):* Roboter in den Bluetooth-Test schalten (SW1), `BTNAME RatRocket-Falke`
  senden, Bluetooth trennen und die Taste am Modul halten, bis die blaue LED aufhört zu
  blinken (höchstens 30 Sekunden). Nur Buchstaben, Ziffern, `-` und `_`, höchstens 20 Zeichen.
  Danach in Windows neu koppeln. Ergebnis mit `BTINFO` prüfen.

**Entdeckerheft:** Parcours-Protokoll (Befehle, Treffer, Abweichung).

**Geplant – Stand November 2026:** eine Fernsteuer-Seite mit Pfeiltasten wie bei einem
Spielzeugauto. Die Roboter-Befehle dafür gibt es schon (`FWD`, `TURN`, `STOP`; im PID-Test
zusätzlich `SPD <links> <rechts> [ms]` für dauerndes Fahren). Bis dahin wird getippt – für
10- bis 14-Jährige erfahrungsgemäß eher ein Reiz („wie Hacker") als eine Hürde.

## Differenzierung

- **Unterstützung:** Befehlskarte laminiert neben den Laptop; Teams mit festen Rollen
  (Fahrer:in tippt, Beobachter:in misst, Protokoll); in Stunde 3 nur drei Modi erkunden
  (1, 4 und eine „leere" Zahl).
- **Herausforderung:** Knobelaufgaben; im Parcours „Rückwärts einparken"; Sechseck mit
  Zielgenauigkeit im Zentimeterbereich.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Nach dem Schalter-Umlegen ändert sich nichts | der Roboter liest die Schalter nur beim Start | Reset-Taste drücken |
| Testseite zeigt nach Reset nichts mehr (USB) | der Roboter startet neu und meldet sich am USB neu an | **Connect robot** erneut |
| `HELP` bekommt keine Antwort | Modus 0 oder eine Zahl ohne Modus | Schalter prüfen; das ist eine richtige Beobachtung, kein Fehler |
| Modul-LED bleibt dunkel | Strom aus, Modul verkehrt oder nicht ganz eingesteckt | ausschalten, Lage mit dem Foto vergleichen, Lehrkraft |
| In der Anschluss-Liste stehen zwei Bluetooth-Einträge | Windows legt zwei Anschlüsse an | den anderen Eintrag wählen |
| `PING` geht, aber `FWD` bewegt nichts | nicht im Labyrinth-Modus (z. B. noch Bluetooth-Test: Motoren aus) | SW3 an, SW1/SW2 aus, Reset |
| Roboter fährt beim falschen Team los | alle Roboter heißen gleich | Namen umbenennen (Taufe), Aufkleber |
| „? unknown" im Log | Tippfehler oder Befehl gibt es in diesem Modus nicht | `HELP` zeigt, was geht |

## Bewertungsvorschlag

Praktische Prüfung ohne Note oder als kleine Teilnote: Team stellt den Labyrinth-Modus her,
verbindet per Bluetooth und parkt mit höchstens 8 Befehlen in der Garage. Einzeln: Erklärung
in zwei Sätzen, warum der Roboter die Schalter nur beim Start liest und was `CELL` mit dem
Baustein `fahre 1 Feld` zu tun hat. Entdeckerheft: Modus-Tabelle vollständig.

## Für die Lehrkraft

Auf dem Mikrocontroller des Roboters (STM32F411) liegen fünf kleine Programme
nebeneinander. Beim Einschalten liest er die drei Schalter als **Binärzahl** und springt in
eines davon – genau wie ein Programmwahlschalter. Jedes Programm meldet sich mit einem
Text und versteht eigene **Befehle**, die über eine **serielle Verbindung** kommen (USB-C oder
Bluetooth, technisch dasselbe: eine Textzeile hin, eine Textzeile zurück). RatRocket Code ist
nichts anderes als ein geduldiger Fernsteuerer: Es schickt für jeden Baustein einen Befehl
und wartet auf die Antwort („CELL done"). Diese Einsicht – *ein Programm ist automatisierte
Fernsteuerung, die selbst entscheiden kann* – trägt durch den ganzen Kurs. Das Einstecken
des Moduls ist bewusst echte Handarbeit: Elektronik ist kein Zauber, aber sie verzeiht keine
verpolte Stromversorgung; die Prüfung durch die Lehrkraft ist deshalb Pflicht.
