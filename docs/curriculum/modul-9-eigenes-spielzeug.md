# Modul 9 – Dein eigenes Spielzeug

**Woche 8 · Stunde 16 (+ Ausbau P8–P9) · ab 10 Jahren (Kern: 10–16) · Leiter-Sprosse 6**
**Software:** heute mit RatRocket Code (Aufgabe 7 als kleines Baufenster: eigenes Labyrinth,
alle Bausteine, echter Roboter bis 5 × 5), den Fernsteuer-Befehlen und der
Start-Taste des Roboters – **verfügbar**.
**Geplant – Stand November 2026:** ein freies Baufenster (ähnlich wie MIT App Inventor):
offene Programmierfläche, Roboter verbinden, **Los!**, eigene Simulationswelt frei gestalten,
eigene Bausteine; dazu Programme, die **auf dem Roboter** gespeichert werden und ohne Laptop laufen.

Das Ziel der Leiter: Aus dem Lernroboter wird ein eigenes Spielzeug. Die Kinder erfinden ein
Spiel oder eine Show, die *andere* benutzen, und präsentieren sie auf einer Mini-Messe.

## Lernziele

Die SuS können …

1. eine eigene Idee als Produkt beschreiben (für wen, Regeln, was der Roboter tut),
2. dafür passende Bausteine, Befehle und Sensoren auswählen und kombinieren,
3. ihr Spielzeug mit fremden Nutzerinnen und Nutzern testen und danach verbessern,
4. Grenzen ehrlich benennen (was geht heute, was bräuchte neue Funktionen).

## Stunde 16 – Spielzeug-Werkstatt und Mini-Messe

Besser als **Doppelstunde (90 min)**; in 45 Minuten bauen die Teams einen Prototyp und die
Messe findet in der nächsten Stunde statt.

**Material:** alles aus den Wochen 1–7 (Roboter, Tisch-Labyrinthe, Wandstücke), Pappe,
Schere, Klebeband (für Verkleidungen), Steckbrief-Karte, Entdeckerheft, Leiter-Plakat.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Leiter-Plakat „Vom ersten Baustein zum eigenen Spielzeug": Was können wir jetzt alles? Sechs Spielzeug-Typen vorstellen (unten). |
| Idee | 8 | Teams wählen einen Typ oder erfinden einen eigenen. **Steckbrief:** Name, für wen (z. B. Grundschulkinder), Spielregel in drei Sätzen, was der Roboter tut, was am Bildschirm passiert. |
| Bauen | 22 | Bauen und testen – erst in der Simulation, dann am Roboter. Die Lehrkraft geht als „Kunde" herum: „Wie spiele ich das?" |
| Mini-Messe | 10 | Stände; je ein Kind erklärt, die anderen testen fremde Spielzeuge und geben einen Stern-Zettel: *Was macht Spaß? Was würde ich ändern?* |

**Sechs Spielzeug-Typen, die heute funktionieren:**

1. **Labyrinth-Spiel für Jüngere:** Labyrinth in Aufgabe 7 mit Stern, Spielkarte mit
   erlaubten Bausteinen und Rekord, Lösung als Datei für die Spielleitung.
2. **Roboter-Pingpong** (am Boden, nur mit **Echter Roboter**; Aufgabe 7, Größe 5 × 5, alle
   Wände weg, Stern oben rechts, Start unten links mit Blick nach oben): Der Roboter fährt die
   linke Spalte entlang, fünf Felder lang. Zwei Spielende halten abwechselnd die Hand als
   „Wand" vor ihn – dann dreht er um. Wer zu spät kommt, lässt ihn aus dem Spielfeld:
   Spielende. Programm:

   ```
   wiederhole, bis du draußen bist
       wenn vorne Wand
           dreh dich um
       sonst
           fahre 1 Feld
   ```
3. **Roboter-Tanz:** Choreografie mit Schleifen und Drehungen zu Musik, echter Roboter auf
   freier Fläche; Wettbewerb „gleicher Tanz, weniger Bausteine".
4. **Fernsteuer-Parcours:** Parcours mit Regeln und Highscore (Befehle aus Modul 2) für die
   Parallelklasse.
5. **Escape-Box ohne Laptop** (mit Lehrkraft): Labyrinth in einem Karton, eine Öffnung als
   Eingang, eine als Ausgang. Die Start-Taste des Roboters (PB2) startet den eingebauten
   Wandfolger, eine Sekunde nach dem Loslassen. Die Lehrkraft stellt vorher über das
   Befehlsfeld ein, an welcher Stelle der Eingang liegt (`ENTRY`, siehe `docs/firmware.md`).
6. **Verkleidung:** Pappaufbau als Tier, Rakete, Taxi – **die drei Sensoren vorne und an den
   Seiten frei lassen**, nichts über die Räder hängen.

**Knobelaufgabe (wirklich schwer):**
- *Pingpong mit Punkten:* Wie könnte das Spiel Punkte zählen? Mit den heutigen Bausteinen
  geht das nicht – entwirf auf Papier, welche Bausteine du dafür bräuchtest. (Diese Entwürfe
  sammeln wir für das Entwicklungsteam.)
- *Spielzeug mit Erkundung:* Ein Spiel, bei dem der Roboter mit `GO` den Weg in die Mitte
  sucht und die Mitspielenden vorher wetten, welche Felder er besucht.
- *Ohne Bildschirm:* Was müsste der Roboter speichern können, damit dein Spielzeug ganz
  ohne Laptop läuft?

**Entdeckerheft:** letzte Seite – „Mein Weg die Leiter hinauf": Was war am schwersten, was
am besten, welche Funktion wünsche ich mir?

## Ausbau P8–P9 – Projekt im freien Baufenster

**Geplant – Stand November 2026.** Zwei Doppelstunden Projekt: eigene Welt in der Simulation
gestalten (Größe, Wände, Ziele frei), Programm mit eigenen Bausteinen, auf dem Roboter
speichern, Präsentation. Bis das freie Baufenster existiert, ist Stunde 16 mit den sechs
Typen oben die Abschluss-Stunde.

## Differenzierung

- **Unterstützung:** Typ 1 oder 3 mit fertiger Vorlage; Steckbrief mit Satzanfängen.
- **Herausforderung:** eigene Spielidee; Bausteine für die Punktezählung entwerfen;
  Spielzeug mit `GO` oder mit Taste.

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Pingpong endet sofort mit „Das Programm ist zu Ende …" | Roboter ist aus dem Spielfeld (5 Felder) oder über den Stern gefahren | Stern nicht in die linke Spalte; Hand früher hinhalten (näher als etwa 11 cm) |
| Pingpong läuft in der Simulation endlos | in der Simulation sind die gezeichneten Randwände die „Hände" | das Spiel ist für den echten Roboter gedacht |
| Roboter reagiert nicht auf die Hand | Hand zu weit weg oder zu spät, oder Ärmel (Stoff) | flache Hand, rechtzeitig |
| Verkleidung stört die Fahrt | Pappe verdeckt einen Sensor oder schleift | Sensoren frei, Aufbau leicht |
| Escape-Box: Roboter dreht falsch ab | Eingangsseite (`ENTRY`) passt nicht | Lehrkraft stellt `ENTRY` neu ein |
| Spielzeug ist nur für die Erfinder verständlich | Regel nicht erklärt | Messe-Rückmeldung nutzen, Steckbrief verbessern |

## Bewertungsvorschlag

Projektbewertung mit drei Teilen zu gleichen Teilen: **Produkt** (funktioniert, ist für
andere spielbar), **Präsentation** (Steckbrief, Erklärung an der Messe), **Reflexion**
(Entdeckerheft letzte Seite, ehrliche Grenzen). Zusätzlich kann das gesamte Entdeckerheft
als Portfolio in die Note eingehen (siehe [anhang-entdeckerheft.md](anhang-entdeckerheft.md)).

## Für die Lehrkraft

Ein Abschlussprojekt mit echtem Publikum verschiebt die Frage von „Habe ich die Aufgabe
gelöst?" zu „Kann jemand anderes mein Ding benutzen?" – das ist der Kern von **Produktdenken**
und von gutem Software-Design: Bedienbarkeit, Regeln, Testen mit Fremden. Die sechs Typen
sind bewusst mit den heutigen Mitteln machbar; wo Kinder an Grenzen stoßen (Punkte zählen,
ohne Laptop spielen, freie Welten), sind ihre Entwürfe wertvolle Rückmeldung für die geplanten
Funktionen – sammeln Sie sie gern und geben Sie sie an das RatRocket-Team weiter.
