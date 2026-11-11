# Modul 5 – Raus hier! Der Wandfolger und die Turnierwoche

**Woche 4–5 · Stunde 7–10 · ab 10 Jahren (Kern: 10–14) · Leiter-Sprosse 1**
**Software: verfügbar** (Aufgabe 5, 6, 7 mit **Zufall**; größere Labyrinthe als 5 × 5 nur in
der Simulation, echter Roboter bis 5 × 5; Speichern/Öffnen). Der Roboter startet in allen
Aufgaben im Feld unten links mit Blick nach oben; in Aufgabe 7 lassen wir den Start dort,
außer eine Knobelaufgabe sagt etwas anderes (Werkzeug **Start**).

Ein einziges Programm, das man nie ändern muss, findet aus jedem Labyrinth heraus: die
**Rechte-Hand-Regel**. Die Kinder bauen sie, prüfen sie an immer neuen Labyrinthen, finden
heraus, *warum* sie funktioniert – und wo sie scheitert. In Woche 5 messen sie sich im
Turnier: Labyrinthe bauen, Programme gegen unbekannte Labyrinthe antreten lassen.

## Lernziele

Die SuS können …

1. eine Strategie in Worten formulieren und als Programm mit `wiederhole, bis du draußen bist`
   und geschachtelten `wenn … sonst` umsetzen,
2. begründen, warum die Rechte-Hand-Regel hinausfindet, wenn der Ausgang in der Außenwand
   liegt und der Roboter an der Außenwand startet,
3. Gegenbeispiele konstruieren (Stern auf einer „Insel", Start neben einem freistehenden
   Block) und daraus Grenzen des Verfahrens ableiten,
4. ein Programm systematisch testen (viele Labyrinthe, Sonderfälle wie Sackgassen),
5. in einem Turnier fair nach Regeln arbeiten: bauen, testen, bewerten, protokollieren.

## Wichtig für den echten Roboter

- **Start:** im Feld unten links, Radachse in der Feldmitte, Blick nach oben. Die Software sagt
  es beim Einschalten von **Echter Roboter**.
- **Größe:** Das Tisch-Labyrinth muss so groß sein wie am Bildschirm (der Roboter zählt seine
  Felder mit, um zu wissen, wann er draußen ist). Der Ausgang darf überall am Rand sein – aber
  nicht zur Tischkante hin.
- **Aufgabe 6 am echten Roboter:** Mit **Echter Roboter** wartet die Software nach jedem
  geschafften Labyrinth („Geschafft! 1/3. Bau das nächste Labyrinth auf und stell den
  Roboter auf den Start.") – erst **Weiter** startet das nächste. Dazwischen das
  Tisch-Labyrinth umbauen. (In der Simulation geht es nach knapp einer Sekunde von selbst
  weiter.) Das Programm bleibt gleich, die Sensoren entscheiden.

## Stunde 7 – Die rechte Hand an der Wand

**Material:** Papier-Labyrinthe (Kopie, A4) und Bleistift, Laptops, Roboter-Station mit
Tisch-Labyrinth im Aufbau von Aufgabe 5, Entdeckerheft.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 10 | **Finger-Labyrinth:** Augen zu, der rechte Zeigefinger fährt auf einem Papier-Labyrinth immer an der rechten Wand entlang – nie loslassen. Kommt man raus? Die Regel gemeinsam in Worte fassen: *Wenn rechts frei ist: rechts abbiegen und ein Feld fahren. Sonst, wenn vorne frei ist: ein Feld fahren. Sonst: nach links drehen.* |
| Erarbeitung I | 20 | Aufgabe 5 „Raus hier!" in der Simulation. Neu: `wiederhole, bis du draußen bist` und `dreh dich um`; ein `wenn` im `sonst`-Bauch eines anderen `wenn`. Ziel: 3 Sterne (höchstens 7 Bausteine). |
| Erarbeitung II | 10 | Roboter-Station: dasselbe Programm am Tisch. Die Wände sind die des Labyrinths, aus dem der echte Roboter am 7. November 2026 zum ersten Mal allein herausgefunden hat (damals startete er draußen vor einem Eingang). |
| Sicherung | 5 | Merksatz: *Ein gutes Programm muss man für ein neues Labyrinth nicht ändern.* Entdeckerheft: Vorhersage für Stunde 8: „Schafft mein Programm auch drei neue Labyrinthe?" |

Aufgabe 5 „Raus hier!" (eine Öffnung in der Außenwand: der Ausgang):

```
      0   1   2
    +---+---+---+
  2 |   |            -> Ausgang
    +---+   +---+
  1 |       |   |
    +---+   +---+
  0 | ^     |   |
    +---+---+---+
```

Erwartetes Programm (7 Bausteine, 3 Sterne) – die Regel aus dem Einstieg, wörtlich:

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

Weg: rechts abbiegen, ein Feld, links hoch, zwei Felder, rechts, hinaus – 5 Felder,
3 Drehungen, **74 Fahrzeit-Punkte**.

**Knobelaufgabe (wirklich schwer):**
- *Golf, Stufe 1:* Es geht mit **6** Bausteinen. *(Lösung: im äußeren `wenn rechts frei` nur
  `drehe nach rechts`; im `sonst` ein `wenn vorne frei` mit leerem Bauch und `sonst`
  `drehe nach links`; das `fahre 1 Feld` steht einmal am Ende im Bauch der Schleife.)*
  Aber: Wo scheitert diese kürzere Version? *(In einer Sackgasse – siehe Stunde 8.)*
- *Golf, Stufe 2:* Es geht sogar mit **5** Bausteinen – und diese Version scheitert nie.
  *(Lösung: `wiederhole, bis du draußen bist` → `wenn rechts frei` → `drehe nach rechts`,
  `fahre 1 Feld`; `sonst` → nur `drehe nach links`. Ist vorne frei, dreht sie erst links und
  in der nächsten Runde wieder rechts.)* Preis dafür: In Aufgabe 5 braucht sie 9 statt 3
  Drehungen – 122 statt 74 Fahrzeit-Punkte. Kurz, sicher, schnell: Man kann nicht alles
  gleichzeitig haben.
- *Linke Hand:* Baue die Linke-Hand-Regel. Schafft sie Aufgabe 5? Wer ist schneller?
  *(Beide schaffen es; rechts 74, links 126 Fahrzeit-Punkte.)* Gibt es ein Labyrinth, in dem
  links gewinnt? Baue es in Aufgabe 7.
- *Blindflug:* das ganze Programm auf Papier, eintippen, ein einziger Versuch.

## Stunde 8 – Ein Programm für alle Labyrinthe

**Material:** Laptops, Roboter-Station(en) mit 3 × 3-Tisch-Labyrinth und losen Wandstücken,
Entdeckerheft, Rekordtafel.

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Vorhersagen aus Stunde 7 vorlesen. Aufgabe 6 öffnen: drei Labyrinthe, ein Programm. |
| Erarbeitung I | 12 | Aufgabe 6 in der Simulation. Danach Aufgabe 7 ohne Stern (Stern anklicken = weg; „… nach draußen"), Knopf **Zufall** zehnmal: Schafft das Programm alle zehn? Strichliste ins Entdeckerheft. |
| Erarbeitung II | 15 | Roboter-Station: **Aufgabe 6** mit **Echter Roboter** – nach jedem Labyrinth auf **Weiter** warten lassen und das Tisch-Labyrinth wie das nächste am Bildschirm umbauen. Oder **Aufgabe 5** und frei umbauen (Start bleibt unten links, ein Ausgang am Rand). Das Programm bleibt unverändert. |
| Sicherung | 13 | Unterrichtsgespräch „Warum klappt es überall?" (siehe *Für die Lehrkraft*). Dann der Gegenbeweis am Beamer: Aufgabe 7, 3 × 3, keine Wände, keine Öffnung, Stern in die **Mitte**. Die rechte Hand fährt immer außen herum, bis die Software abbricht: „Das Programm läuft zu lange. Fehlt eine Abbruchbedingung?" Cliffhanger für Woche 7: *Was müsste der Roboter können, um den Stern zu finden?* |

Die beiden weiteren Labyrinthe aus Aufgabe 6 (zum Nachbauen am Tisch):

```
      0   1   2                        0   1   2
    +---+---+---+                    +---+---+   +  <- Ausgang
  2 |              -> Ausgang      2 |           |
    +   +---+   +                    +---+   +   +
  1 |   |       |                  1 |           |
    +   +   +   +                    +   +---+   +
  0 | ^         |                  0 | ^         |
    +---+---+---+                    +---+---+---+
```

Der Stern auf der Insel (Gegenbeispiel):

```
      0   1   2
    +---+---+---+
  2 |           |
    +   +   +   +
  1 |     *     |
    +   +   +   +
  0 | ^         |
    +---+---+---+
```

**Knobelaufgabe (wirklich schwer):**
- *Schurken-Labyrinth:* Baue ein Labyrinth, an dem die 6-Baustein-Version scheitert, die
  7-Baustein-Version aber herausfindet. *(Lösung, 3 × 3: eine einzige Wand zwischen den
  Feldern unten rechts und rechts Mitte, Ausgang rechts oben. Die kurze Version dreht in der
  Sackgasse unten rechts nach links und fährt gegen die Wand.)*
- *Inselfalle:* Baue mit dem Werkzeug **Start** ein Labyrinth mit Ausgang, aus dem die
  7-Baustein-Version **nie** herausfindet. *(Lösung: 5 × 5, ein Wandring um das mittlere Feld,
  Ausgang irgendwo am Rand, Start direkt unter dem Ring mit Blick nach links – die rechte Hand
  kreist um den Block. Mit Start unten links findet sie hinaus.)*
- *Längster Weg:* Aufgabe 7, 5 × 5, ohne Stern, ein Ausgang: Baue ein Labyrinth, in dem das
  7-Baustein-Programm möglichst viele Fahrzeit-Punkte braucht. Klassenrekord auf die Tafel.
- *Beweis:* Warum findet die rechte Hand **immer** hinaus, wenn der Ausgang in der Außenwand
  liegt und sie in der Ecke unten links startet – auch wenn es innen Inseln gibt? Und warum
  findet sie in jedem **Zufall**-Labyrinth sogar jeden Stern?
- *Grenze:* Gibt es ein Programm aus unseren sieben Bausteinarten, das **jeden** Stern findet?
  *(Nein. Dafür braucht der Roboter ein Gedächtnis – Woche 7.)*

**Entdeckerheft:** Zufall-Strichliste; Begründung „Warum klappt es überall?" in eigenen Worten.

## Stunde 9 und 10 – Turnierwoche

Am besten als **Doppelstunde (90 min)**. Regeln, Bewertungsbögen und Turnierbaum stehen in
[anhang-turnier.md](anhang-turnier.md).

**Stunde 9 – Bauen und Qualifizieren**

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 5 | Regeln am Plakat; Rollen im Team: Architekt:in, Programmierer:in, Schiedsrichter:in, Protokoll. |
| Erarbeitung | 32 | Jedes Team baut in Aufgabe 7 (Größe von der Lehrkraft, meist 4 × 4 oder 5 × 5; Start unten links): ein **Escape-Labyrinth** (ohne Stern, genau eine Öffnung als Ausgang) und ein **Golf-Labyrinth** (mit Stern). Prüfung: Das Referenz-Programm (7 Bausteine, oben) muss aus dem Escape-Labyrinth herausfinden. Speichern mit **leerem Programm**, umbenennen (`falken-escape.json`, `falken-golf.json`). Dazu das **Turnier-Programm** des Teams – gespeichert in **Aufgabe 5** (`falken-programm.json`), sonst würde es beim Öffnen das Labyrinth ersetzen. Qualifikation: Das Programm muss alle drei Labyrinthe von Aufgabe 6 schaffen. |
| Sicherung | 8 | Alle Dateien zur Lehrkraft (Stick/Plattform). Entdeckerheft: „Wie viele fremde Labyrinthe schafft unser Programm?" |

**Stunde 10 – Das Turnier**

| Phase | Min | Ablauf |
|---|---|---|
| Einstieg | 3 | Ablauf, Bögen verteilen. |
| Runde 1: Escape-Cup | 17 | Jedes Team ist Schiedsrichter für **sein** Escape-Labyrinth: Labyrinth-Datei öffnen, dann nacheinander alle Programm-Dateien öffnen und **Los!** (Tempo hoch). Ergebnis in den Bogen. Zusätzlich drei unbekannte **Zufall**-Labyrinthe der Lehrkraft. |
| Runde 2: Golf-Duell | 15 | Viertelfinale im Turnierbaum: Paare tauschen ihre Golf-Labyrinthe, 8 Minuten, wenigste Bausteine gewinnt. Halbfinale und Finale laufen in den folgenden Wochen als 5-Minuten-Einstieg weiter. |
| Finale am Roboter | 10 | Die zwei besten Escape-Programme fahren am echten Roboter durch ein Tisch-Labyrinth, das die Lehrkraft hinter einem Pappschirm gebaut hat. Stoppuhr. |

**Knobelaufgabe in der Turnierwoche:** der **Schurken-Preis** – ein Escape-Labyrinth, an dem
möglichst viele Turnier-Programme scheitern, obwohl das Referenz-Programm herausfindet.

## Differenzierung

- **Unterstützung:** Regel-Karte mit der Rechte-Hand-Regel in Worten neben dem Laptop;
  Programm erst als Text schreiben, dann Satz für Satz in Bausteine übersetzen; im Turnier
  feste Rolle (z. B. Protokoll).
- **Herausforderung:** Golf, Schurken-Labyrinth, Inselfalle, Längster Weg, Beweis; Labyrinthe
  größer als 5 × 5 in der Simulation (Zufall-Labyrinthe bis Wettbewerbsgröße 16 × 16).

## Typische Fehler und Diagnosen

| Beobachtung | Ursache | Was tun |
|---|---|---|
| Roboter dreht sich auf der Stelle im Kreis, „Das Programm läuft zu lange …" | nach `drehe nach rechts` fehlt `fahre 1 Feld`: nach dem Drehen ist rechts wieder frei | Regel vorlesen: „rechts abbiegen **und** ein Feld fahren" |
| „Autsch …" in einer Sackgasse | 6-Baustein-Version: nach `drehe nach links` wird blind gefahren | 7-Baustein-Version: im letzten `sonst` nur drehen |
| Roboter fährt endlos Runden, „Das Programm läuft zu lange …", obwohl die Regel stimmt | Stern auf einer Insel, oder Start neben einem freistehenden Block | das ist die Grenze des Verfahrens – kein Programmfehler |
| „Dein Labyrinth hat kein Ziel – setz einen Stern oder öffne die Außenwand." | Aufgabe 7 ohne Stern und ohne Öffnung | Stern setzen oder eine Randlinie anklicken |
| Echter Roboter verpasst eine Abzweigung | Fuge zwischen Wandstücken oder schräger Sensorblick nach einer ungenauen Drehung | Wände dicht stellen; Drehgenauigkeit ist Werkstatt-Thema (Woche 6) |
| Echter Roboter „ist draußen", obwohl er drin ist (oder umgekehrt) | Tisch-Labyrinth hat eine andere Größe als am Bildschirm, oder Start falsch | Größe angleichen; Start genau im Feld unten links, Blick nach oben |
| Geöffnetes Turnier-Programm ersetzt das Labyrinth | Programm wurde in Aufgabe 7 gespeichert | Programme immer in Aufgabe 5 speichern |

## Bewertungsvorschlag

Teilnote „Algorithmus": (1) Datei `ratrocket-aufgabe5.json` mit funktionierendem Wandfolger,
(2) drei Sätze „Warum klappt es überall?", (3) ein Gegenbeispiel (Insel) erklärt. Stufen:
Wandfolger läuft (grundlegend); Begründung mit der zusammenhängenden Außenwand (erweitert);
Schurken-Labyrinth, Inselfalle oder Beweis für Zufall-Labyrinthe (vertieft). Das Turnier selbst
wird **nicht** benotet – bewertet werden Protokoll und Fairness (Schiedsrichter-Bogen
vollständig und nachvollziehbar).

## Für die Lehrkraft

Die Rechte-Hand-Regel ist ein **Algorithmus ohne Gedächtnis**: Der Roboter entscheidet nur
nach dem, was er gerade sieht. Warum das reicht: Er startet in der Ecke unten links. Seine
rechte Hand liegt von Anfang an an der Außenwand oder an einer Wand, die mit ihr verbunden ist.
Dieses zusammenhängende Wandstück führt am Ausgang vorbei. Wer die Hand nie von der Wand
nimmt, gleitet daran entlang – manchmal mit Umwegen in Sackgassen, aber er kann sie nicht
verlieren, also kommt er am Ausgang vorbei. Ein Stern im Inneren kann dagegen auf einer
**Insel** liegen: an einem Wandstück, das nicht mit der Außenwand verbunden ist, oder in einem
freien Raum mit Rundweg. Daran gleitet die Hand nie entlang. Ebenso kann ein Start mitten im
Labyrinth neben einem freistehenden Block dazu führen, dass die Hand ewig um diesen Block kreist.
Labyrinthe ohne Rundwege („perfekte" Labyrinthe, wie sie der Knopf **Zufall** baut) haben keine
Inseln: Dort besucht die rechte Hand jedes Feld, bevor sie zurückkommt – sie macht dann eine
vollständige **Tiefensuche**. Um *jeden* Stern zu finden, braucht der Roboter ein Gedächtnis
(Karte, Markierungen) – das ist das Thema der Wochen 7 und 8, und genau deshalb benutzen
Micromouse-Roboter, deren Ziel in der Mitte liegt, eine Karte und die Flood-Fill-Methode.
