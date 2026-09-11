# Mauer-Konfigurator · EHL Antik-Serie

Planungswerkzeug für Gartenmauern aus der EHL Antik-Serie: gerade Mauer oder
Mauer mit 90°-Ecke, Verlegeart **6016**, Mauerplan mit Ansicht und Draufsicht,
Höhen- und Schnittberechnung sowie die Kalkulation der benötigten Steine.
Die Anwendung läuft vollständig im Browser, speichert Pläne im Browser-Speicher
und lässt sich direkt ausdrucken.

## Starten

```bash
npm start          # startet einen lokalen Server auf http://localhost:8080
```

Alternativ eine Einzeldatei bauen, die ohne Server per Doppelklick läuft:

```bash
npm run build      # erzeugt dist/mauer-konfigurator.html
```

> Die Anwendung benötigt keine Abhängigkeiten. `npm start` nutzt nur
> `python3 -m http.server`; jeder andere statische Webserver funktioniert ebenso.
> Ein direkter Aufruf von `index.html` über `file://` funktioniert **nicht**,
> weil Browser ES-Module dort blockieren – dafür ist der Einzeldatei-Build da.

## Funktionsumfang

| Anforderung | Umsetzung |
|---|---|
| Mauer auf bestimmte Länge planen | Länge je Schenkel in cm (Außenkante) |
| 90°-Ecke | Mauerform „Ecke“ mit zwei Schenkeln und wechselseitiger Eckverzahnung |
| Verbandart auswählen | Vorlage „Verlegeart 6016“, eigene Verbände speicherbar |
| Oberste/unterste Lage bestimmen | je Lage: aus dem Verband, Verbandlage *ersetzen* oder *zusätzliche* Lage |
| Höhe je Schenkel berechnen | aus Lagenzahl oder aus Zielhöhe (mit Abweichungsangabe) |
| Schnitte berechnen | Zuschnittliste je Lage, gruppiert und einzeln, mit Reststückverwertung |
| Steinkalkulation | Bedarf je Format, Bestellmenge inkl. Verschnitt, Fläche, Gewicht |
| Browser-Speicher | Pläne speichern/laden/löschen, Entwurf überlebt den Reload, Export/Import als JSON |
| Druckfunktion | eigenes Drucklayout (A4 quer) mit Plankopf, Zeichnungen und Tabellen |

## Rechenmodell

Intern wird durchgängig in **Millimetern** gerechnet; Eingaben und Ausgaben
erfolgen in cm.

**Steinformate (EHL Antik, `src/data/catalog.js`)**

| Format | L × T × H |
|---|---|
| S | 20 × 20 × 7 cm |
| M | 30 × 20 × 7 cm |
| L | 20 × 20 × 14 cm |
| XL | 30 × 20 × 14 cm |
| XXL | 40 × 20 × 14 cm |

**Verband.** Ein Verband ist eine Folge von Lagen, jede Lage eine Folge von
Steinformaten. Die Steinfolge wird je Lage wiederholt, bis die Schenkellänge
erreicht ist; der Verband selbst wiederholt sich über die Lagen. Innerhalb
einer Lage müssen alle Formate dieselbe Höhe haben – die Anwendung prüft das.

**Ecke.** Die Schenkel verzahnen sich lagenweise: in Lage 1 läuft Schenkel A bis
zur Außenkante durch und Schenkel B beginnt um die Mauerdicke (20 cm) versetzt,
in Lage 2 umgekehrt. Dadurch stoßen die Lagerfugen nicht durchgehend aufeinander.
Verlegt wird in der Zeichnung immer **von der Ecke zum freien Ende**, der
Zuschnitt fällt also am freien Ende an. Hat ein Schenkel mehr Lagen als der
andere, entfällt die Verzahnung oberhalb des kürzeren Schenkels.

**Höhe.** Die Höhe ergibt sich aus der Summe der Lagenhöhen plus Lagerfugen.
Wird eine Zielhöhe vorgegeben, wählt die Anwendung die Lagenzahl mit der
kleinsten Abweichung und weist diese Abweichung aus.

**Zuschnitte.** Der letzte Stein einer Lage wird auf das Restmaß geschnitten.
Wäre dieses Reststück kleiner als das eingestellte kleinste Passstück
(Standard 60 mm), werden die beiden letzten Steine gleichmäßig aufgeteilt,
damit kein Splitter am Mauerende steht.

**Reststücke.** Auf Wunsch werden Abschnitte wiederverwendet (Best-Fit, nur bei
gleicher Lagenhöhe und Tiefe, abzüglich Schnittfugenverlust). Ein Zuschnitt aus
einem Reststück verbraucht keinen neuen Stein; die Ersparnis wird ausgewiesen.

**Gewicht** ist eine rechnerische Schätzung (Volumen × 2350 kg/m³), keine
Herstellerangabe.

## Verbandarten

Die mitgelieferte Vorlage „Verlegeart 6016“ liegt in
`src/data/patterns.js`. Über **Verband bearbeiten** lässt sich die Lagenfolge
im Browser ändern (Formate je Lage durch Leerzeichen getrennt), als eigener
Verband speichern und wiederverwenden. Eine Änderung ohne Speichern gilt nur
für den aktuellen Plan und wird mit ihm gesichert.

> **Datenherkunft:** Die Steinformate entsprechen der handelsüblichen
> Staffelung der EHL Antik-Mauersteine. Die Lagenfolge der Verlegeart 6016 ist
> als Vorlage hinterlegt – das offizielle EHL-Verlegebeispiel war beim Erstellen
> nicht abrufbar. Bitte einmal gegen das EHL-Datenblatt prüfen und bei Bedarf im
> Verband-Editor korrigieren; alle Berechnungen ziehen die Werte aus den Daten,
> nicht aus dem Code. Maßgeblich bleiben in jedem Fall die Herstellerangaben.

## Aufbau

```
index.html                    Oberfläche
assets/styles.css             Bildschirm- und Drucklayout
src/data/catalog.js           Steinformate der Serie
src/data/patterns.js          Verbandarten (Vorlage 6016)
src/core/wall.js              Lagenfolge, Höhen, Eckverzahnung, Lagenfüllung
src/core/calc.js              Schnittliste, Reststücke, Steinbedarf
src/ui/svg.js                 Mauerplan als SVG (Ansicht, Draufsicht, Legende)
src/ui/app.js                 Bedienung, Zustand, Ausgabe
src/store.js                  Browser-Speicher (Pläne, Verbände, Entwurf)
tools/build-single-file.mjs   Einzeldatei-Build
test/                         Tests (node:test, ohne Abhängigkeiten)
```

## Tests

```bash
npm test
```

Abgedeckt sind Lagenfolge und Abschlusslagen, Höhenermittlung, Lagenfüllung mit
Fugen und Passstück-Aufteilung, Eckverzahnung, Schnitt- und Reststücklogik,
Steinbedarf mit Verschnittzuschlag sowie der Einzeldatei-Build.

## Speicherung

Pläne liegen im `localStorage` des jeweiligen Browsers – sie sind an Gerät und
Browserprofil gebunden und werden beim Löschen der Browserdaten mit entfernt.
Für Sicherung und Weitergabe gibt es **Export**/**Import** als JSON-Datei.
