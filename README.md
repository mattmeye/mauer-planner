# Mauer-Konfigurator · EHL CityAntik-Mauer (Aufbauschema 6016)

Planungswerkzeug für Gartenmauern nach dem **EHL-Verlegebeispiel 6016**
(CityAntik-Mauer, „Wilder Aufbau mit 4 Formaten“, DIY): gerade Mauer oder
Mauer mit 90°-Ecke, Mauerplan mit Ansicht und Draufsicht, Höhen- und
Schnittberechnung sowie die Kalkulation der benötigten Steine.
Die Anwendung läuft vollständig im Browser, speichert Pläne im Browser-Speicher
und lässt sich direkt ausdrucken.

## Online nutzen

Das Repository ist so aufgebaut, dass es direkt über **GitHub Pages** läuft –
alle Pfade sind relativ, es gibt keine externen Abhängigkeiten und keinen
Build-Schritt. Einmalig unter *Settings → Pages* einstellen:

> **Source:** Deploy from a branch · **Branch:** `main` · **Ordner:** `/ (root)`

Danach ist der Konfigurator unter
`https://<benutzer>.github.io/mauer-planner/` erreichbar und jeder Push auf
`main` veröffentlicht die neue Fassung. Die Pläne liegen im Browser-Speicher
des jeweiligen Besuchers – die Seite selbst speichert nichts.

## Lokal starten

```bash
npm start          # startet einen lokalen Server auf http://localhost:8080
```

Alternativ die Einzeldatei **[`dist/mauer-konfigurator.html`](dist/mauer-konfigurator.html)**
verwenden: sie enthält Oberfläche, Stylesheet und Programmcode in einer Datei,
läuft ohne Server per Doppelklick und lässt sich so weitergeben. Die Datei ist
eingecheckt und wird neu erzeugt mit:

```bash
npm run build      # schreibt dist/mauer-konfigurator.html
```

`npm test` baut sie ebenfalls neu und prüft sie; nach Änderungen am Quelltext
also den Build mit einchecken.

> Die Anwendung benötigt keine Abhängigkeiten. `npm start` nutzt nur
> `python3 -m http.server`; jeder andere statische Webserver funktioniert ebenso.
> Ein direkter Aufruf von `index.html` über `file://` funktioniert **nicht**,
> weil Browser ES-Module dort blockieren – dafür ist der Einzeldatei-Build da.

## Funktionsumfang

| Anforderung | Umsetzung |
|---|---|
| Mauer auf bestimmte Länge planen | Länge je Schenkel in cm (Außenkante) |
| 90°-Ecke | Mauerform „Ecke“ mit zwei Schenkeln und wechselseitiger Eckverzahnung |
| Verbandart auswählen | Vorlage „Aufbauschema 6016“, eigene Verbände speicherbar |
| Oberstes/unterstes Band bestimmen | aus dem Verband, Verbandband *ersetzen* oder *zusätzliches* Band |
| Höhe je Schenkel berechnen | aus Bandzahl oder aus Zielhöhe (mit Abweichungsangabe) |
| Schnitte berechnen | Zuschnittliste je Band, gruppiert und einzeln, mit Reststückverwertung |
| Steinkalkulation | Bedarf je Format, Bestellmenge inkl. Verschnitt, Stk/m² im Vergleich zum EHL-Richtwert, Fläche, Gewicht |
| Browser-Speicher | Pläne speichern/laden/löschen, Entwurf überlebt den Reload, Export/Import als JSON |
| Druckfunktion | eigenes Drucklayout (A4 quer) mit Plankopf, Zeichnungen und Tabellen |

## Datengrundlage: EHL-Verlegebeispiel 6016

Steinformate (`src/data/catalog.js`) und Aufbau (`src/data/patterns.js`) stammen
aus dem EHL-Datenblatt „Aufbauschema Nr. 6016 – CityAntik-Mauer“:

| | Format (L × T × H) | Systemverband | DIY-Ausschnitt |
|---|---|---|---|
| Stein 1 | 40 × 20 × 14 cm | ca. 4,0 Stk/m² | ca. 3,7 Stk/m² |
| Stein 2 | 30 × 20 × 14 cm | ca. 4,0 Stk/m² | ca. 4,4 Stk/m² |
| Stein 3 | 30 × 20 × 7 cm | ca. 15,9 Stk/m² | ca. 16,0 Stk/m² |
| Stein 4 | 20 × 20 × 7 cm | ca. 19,9 Stk/m² | ca. 19,7 Stk/m² |

Der Aufbau wurde aus der maßstäblichen Zeichnung des Datenblatts (Ausschnitt
340 × 84 cm, 124 Steine) rekonstruiert: **acht Bänder** mit den Höhen
7/14/7/14/7/14/7/14 cm (= 84 cm) und einer **Horizontalperiode von 120 cm**.
Die 14-cm-Bänder mischen 40er- und 30er-Steine mit 50 cm breiten Feldern aus je
zwei übereinanderliegenden Reihen 7-cm-Steinen – daher „wilder Aufbau“.

`test/verband6016.test.js` vergleicht den erzeugten Mauerplan Feld für Feld mit
der Zeichnung des Datenblatts (395 Rasterfelder, Raster 10 × 7 cm) und prüft den
Steinbedarf je m² gegen die EHL-Richtwerte.

## Rechenmodell

Intern wird durchgängig in **Millimetern** gerechnet; Eingaben und Ausgaben
erfolgen in cm.

**Verband.** Ein Verband besteht aus Bändern, die von unten nach oben wiederholt
werden. Jedes Band hat eine feste Höhe (7 oder 14 cm) und besteht aus Elementen:
einem Stein über die volle Bandhöhe oder einem Feld aus zwei übereinander
liegenden Reihen 7-cm-Steine. `anfang` wird einmalig an der Ecke verlegt,
`muster` wiederholt sich bis zum freien Ende – genau dadurch versetzen sich die
Stoßfugen von Band zu Band.

**Ecke.** Die Schenkel verzahnen sich bandweise: in Band 1 läuft Schenkel A bis
zur Außenkante durch und Schenkel B beginnt um die Mauerdicke (20 cm) versetzt,
in Band 2 umgekehrt. Verlegt wird in der Zeichnung immer **von der Ecke zum
freien Ende**, der Zuschnitt fällt also am freien Ende an. Hat ein Schenkel mehr
Bänder als der andere, entfällt die Verzahnung oberhalb des kürzeren Schenkels.

**Höhe.** Die Höhe ergibt sich aus der Summe der Bandhöhen plus Lagerfugen.
Wird eine Zielhöhe vorgegeben, wählt die Anwendung die Bandzahl mit der
kleinsten Abweichung (bei gleichem Abstand die größere Höhe) und weist die
Abweichung aus. Erreichbare Höhen sind 7, 21, 28, 42, 49, 63, 70, 84 cm usw.

**Zuschnitte.** Der letzte Stein eines Bandes wird auf das Restmaß geschnitten;
angeschnittene Felder werden in beiden Reihen gekürzt. Wäre ein Reststück
kleiner als das eingestellte kleinste Passstück (Standard 60 mm), werden die
beiden letzten Steine derselben Reihe gleichmäßig aufgeteilt – sofern sie
unmittelbar nebeneinander liegen.

**Reststücke.** Auf Wunsch werden Abschnitte wiederverwendet (Best-Fit, nur bei
gleicher Steinhöhe und Tiefe, abzüglich Schnittfugenverlust). Ein Zuschnitt aus
einem Reststück verbraucht keinen neuen Stein; die Ersparnis wird ausgewiesen.

**Gewicht** ist eine rechnerische Schätzung (Volumen × 2350 kg/m³), keine
Herstellerangabe.

## Verbandarten anpassen

Über **Verband bearbeiten** lässt sich jedes Band im Browser ändern und als
eigener Verband speichern. Die Elemente werden als Text geschrieben:

```
40/14 30/14 [20/7 30/7 | 30/7 20/7]
```

Formate sind `40/14`, `30/14`, `30/7`, `20/7` (Länge/Höhe in cm). Eckige
Klammern beschreiben ein gestapeltes Feld aus 7-cm-Steinen, der senkrechte
Strich trennt untere und obere Reihe. Eine Änderung ohne Speichern gilt nur für
den aktuellen Plan und wird mit ihm gesichert.

## Aufbau

```
index.html                    Oberfläche
assets/styles.css             Bildschirm- und Drucklayout
src/data/catalog.js           Steinformate der Serie
src/data/patterns.js          Verbandarten (Aufbauschema 6016) und Textform
src/core/wall.js              Bandfolge, Höhen, Eckverzahnung, Bandfüllung
src/core/calc.js              Schnittliste, Reststücke, Steinbedarf
src/ui/svg.js                 Mauerplan als SVG (Ansicht, Draufsicht, Legende)
src/ui/app.js                 Bedienung, Zustand, Ausgabe
src/store.js                  Browser-Speicher (Pläne, Verbände, Entwurf)
tools/build-single-file.mjs   Einzeldatei-Build
dist/mauer-konfigurator.html  fertige Einzeldatei (erzeugt, eingecheckt)
.nojekyll                     GitHub Pages liefert die Dateien unverändert aus
test/                         Tests (node:test, ohne Abhängigkeiten)
```

## Tests

```bash
npm test
```

Abgedeckt sind der Abgleich mit der Datenblatt-Zeichnung, Bandfolge und
Abschlussbänder, Höhenermittlung, Bandfüllung mit Fugen, gestapelten Feldern und
Passstück-Aufteilung, Eckverzahnung, Schnitt- und Reststücklogik, Steinbedarf
mit Verschnittzuschlag sowie der Einzeldatei-Build.

## Speicherung

Pläne liegen im `localStorage` des jeweiligen Browsers – sie sind an Gerät und
Browserprofil gebunden und werden beim Löschen der Browserdaten mit entfernt.
Für Sicherung und Weitergabe gibt es **Export**/**Import** als JSON-Datei.

---

Maße ohne Gewähr – maßgeblich sind die Angaben des Herstellers.
