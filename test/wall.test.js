import test from 'node:test';
import assert from 'node:assert/strict';

import { steinMap } from '../src/data/catalog.js';
import { VERBAENDE, pruefeVerband, elementeAusText, elementeAlsText } from '../src/data/patterns.js';
import {
  standardKonfig, lagenFolge, hoeheVonLagen, lagenFuerHoehe, fuelleLage, baueMauer,
} from '../src/core/wall.js';

const katalog = steinMap();
const verband = VERBAENDE[0];
const FELD_50 = { unten: ['20/7', '30/7'], oben: ['30/7', '20/7'] };

const band = (hoehe, muster, anfang = []) => ({ hoehe, anfang, muster });

test('Aufbauschema 6016 ist plausibel', () => {
  assert.deepEqual(pruefeVerband(verband, katalog), []);
  assert.deepEqual(verband.lagen.map((l) => l.hoehe), [70, 140, 70, 140, 70, 140, 70, 140]);
  assert.equal(verband.lagen.reduce((s, l) => s + l.hoehe, 0), 840, '8 Bänder = 84 cm');
});

test('Alle Bänder des Verbands haben 120 cm Musterbreite', () => {
  for (const [i, lage] of verband.lagen.entries()) {
    const breite = lage.muster.reduce((summe, element) => summe + (typeof element === 'object'
      ? element.unten.reduce((s, id) => s + katalog[id].l, 0)
      : katalog[element].l), 0);
    assert.equal(breite, 1200, `Band ${i + 1}`);
  }
});

test('pruefeVerband meldet unpassende Formate', () => {
  const kaputt = { lagen: [band(70, ['40/14']), band(140, [{ unten: ['20/7'], oben: ['30/7'] }])] };
  const fehler = pruefeVerband(kaputt, katalog);
  assert.equal(fehler.length, 2);
  assert.match(fehler[0], /14 cm hoch, das Band 7 cm/);
  assert.match(fehler[1], /unten 20 cm und oben 30 cm breit/);
});

test('Textform der Elemente ist verlustfrei', () => {
  const text = '40/14 30/14 [20/7 30/7 | 30/7 20/7]';
  assert.deepEqual(elementeAusText(text), ['40/14', '30/14', FELD_50]);
  assert.equal(elementeAlsText(elementeAusText(text)), text);
  assert.throws(() => elementeAusText('[20/7 30/7]'), /genau ein "\|"/);
  assert.throws(() => elementeAusText('[20/7'), /schließende Klammer/);
});

test('fuelleLage schneidet den letzten Stein auf Restmaß', () => {
  const steine = fuelleLage({ lage: band(140, ['40/14']), laenge: 1000, katalog });
  assert.deepEqual(steine.map((s) => s.l), [400, 400, 200]);
  assert.deepEqual(steine.map((s) => s.zuschnitt), [false, false, true]);
  assert.deepEqual(steine.map((s) => s.dy), [0, 0, 0]);
  assert.equal(steine.at(-1).x, 800);
});

test('Gestapelte Felder erzeugen zwei Reihen 7-cm-Steine', () => {
  const steine = fuelleLage({ lage: band(140, [FELD_50]), laenge: 1000, katalog });
  assert.equal(steine.length, 8, '2 Felder à 4 Steine');
  const unten = steine.filter((s) => s.dy === 0);
  const oben = steine.filter((s) => s.dy === 70);
  assert.deepEqual(unten.map((s) => [s.x, s.l]), [[0, 200], [200, 300], [500, 200], [700, 300]]);
  assert.deepEqual(oben.map((s) => [s.x, s.l]), [[0, 300], [300, 200], [500, 300], [800, 200]]);
  assert.ok(steine.every((s) => s.h === 70), 'nur 7-cm-Steine im Feld');
});

test('Ein angeschnittenes Feld wird in beiden Reihen gekürzt', () => {
  const steine = fuelleLage({ lage: band(140, [FELD_50]), laenge: 600, katalog });
  const unten = steine.filter((s) => s.dy === 0);
  const oben = steine.filter((s) => s.dy === 70);
  assert.deepEqual(unten.map((s) => s.l), [200, 300, 100]);
  assert.deepEqual(oben.map((s) => s.l), [300, 200, 100]);
  assert.deepEqual(unten.at(-1).zuschnitt, true);
  assert.deepEqual(oben.at(-1).zuschnitt, true);
});

test('fuelleLage berücksichtigt Stoßfugen', () => {
  const steine = fuelleLage({ lage: band(140, ['40/14']), laenge: 1000, katalog, fuge: 10 });
  assert.deepEqual(steine.map((s) => s.x), [0, 410, 820]);
  assert.equal(steine.at(-1).l, 180);
});

test('fuelleLage vermeidet Splitter kleiner als minStueck', () => {
  const steine = fuelleLage({ lage: band(140, ['40/14']), laenge: 830, katalog, minStueck: 60 });
  assert.equal(steine.reduce((s, x) => s + x.l, 0), 830);
  assert.ok(steine.at(-1).l >= 60 && steine.at(-2).l >= 60);
  assert.equal(steine.at(-2).zuschnitt, true, 'vorletzter Stein wird mitgeteilt');
  assert.equal(steine.at(-1).x, steine.at(-2).x + steine.at(-2).l);
});

test('Splitter werden nur mit unmittelbar benachbarten Steinen geteilt', () => {
  // Letztes Element ist ein auf 50 mm angeschnittenes Feld; der vorherige
  // 7-cm-Stein derselben Reihe liegt nicht daneben, also bleibt es dabei.
  const lage = band(140, ['40/14', '30/14', FELD_50]);
  const steine = fuelleLage({ lage, laenge: 1950, katalog, minStueck: 60 });
  const letzte = steine.filter((s) => s.x >= 1900);
  assert.equal(letzte.length, 2, 'je ein Stein in unterer und oberer Reihe');
  assert.ok(letzte.every((s) => s.l === 50 && s.zuschnitt));
  assert.ok(steine.filter((s) => s.dy === 0 && s.x < 1900).every((s) => !s.zuschnitt));
});

test('fuelleLage startet am Ecken-Offset', () => {
  const steine = fuelleLage({ lage: band(140, ['40/14']), laenge: 800, offset: 200, katalog });
  assert.equal(steine[0].x, 200);
  assert.equal(steine.at(-1).x + steine.at(-1).l, 1000);
});

test('lagenFolge: reiner Verband wiederholt sich zyklisch', () => {
  const cfg = standardKonfig();
  const lagen = lagenFolge(cfg, verband, 10, katalog);
  assert.equal(lagen.length, 10);
  assert.deepEqual(lagen[8].muster, verband.lagen[0].muster);
  assert.deepEqual(lagen.map((l) => l.hoehe), [70, 140, 70, 140, 70, 140, 70, 140, 70, 140]);
  assert.ok(lagen.every((l) => l.quelle === 'verband'));
});

test('lagenFolge: Abschlussband ersetzen tauscht erstes/letztes Band', () => {
  const cfg = standardKonfig();
  cfg.abschluss.unten = { modus: 'ersetzen', steine: ['40/14'] };
  cfg.abschluss.oben = { modus: 'ersetzen', steine: ['30/7'] };
  const lagen = lagenFolge(cfg, verband, 5, katalog);
  assert.deepEqual(lagen[0], { hoehe: 140, anfang: [], muster: ['40/14'], quelle: 'unten' });
  assert.deepEqual(lagen[4], { hoehe: 70, anfang: [], muster: ['30/7'], quelle: 'oben' });
  assert.ok(lagen.slice(1, 4).every((l) => l.quelle === 'verband'));
});

test('lagenFolge: zusätzliche Abschlussbänder erhöhen den Verbandanteil nicht', () => {
  const cfg = standardKonfig();
  cfg.abschluss.unten = { modus: 'zusaetzlich', steine: ['30/7'] };
  cfg.abschluss.oben = { modus: 'zusaetzlich', steine: ['40/14'] };
  const lagen = lagenFolge(cfg, verband, 6, katalog);
  assert.equal(lagen.length, 6);
  assert.equal(lagen[0].quelle, 'unten');
  assert.equal(lagen[5].quelle, 'oben');
  assert.equal(lagen.filter((l) => l.quelle === 'verband').length, 4);
  assert.deepEqual(lagen[1].muster, verband.lagen[0].muster);
});

test('Höhe: 8 Bänder ergeben 84 cm, 16 Bänder 168 cm', () => {
  const cfg = standardKonfig();
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 8, katalog)), 840);
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 16, katalog)), 1680);
});

test('Höhe: Lagerfuge wird zwischen den Bändern addiert', () => {
  const cfg = standardKonfig();
  cfg.lagenfuge = 5;
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 4, katalog), 5), 70 + 140 + 70 + 140 + 3 * 5);
});

test('Höhe: zusätzliches Abschlussband verändert die Gesamthöhe', () => {
  const cfg = standardKonfig();
  cfg.abschluss.oben = { modus: 'zusaetzlich', steine: ['30/7'] };
  // 7 Verbandbänder (7+14+7+14+7+14+7 = 70) plus 7 cm Abschluss
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 8, katalog)), 700 + 70);
});

test('lagenFuerHoehe wählt die nächstliegende Bandzahl', () => {
  const cfg = standardKonfig();
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 840), { lagen: 8, hoehe: 840, abweichung: 0 });
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 800), { lagen: 8, hoehe: 840, abweichung: 40 });
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 620), { lagen: 6, hoehe: 630, abweichung: 10 });
  // Gleicher Abstand nach oben und unten (49,0 / 63,0 cm): die größere Höhe gewinnt
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 560), { lagen: 6, hoehe: 630, abweichung: 70 });
});

test('Ecke: Schenkel verzahnen sich bandweise', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 4 };
  cfg.schenkel[1] = { name: 'B', laenge: 2500, modus: 'lagen', lagen: 4 };
  const mauer = baueMauer(cfg, verband, katalog);
  const [a, b] = mauer.schenkel;

  assert.equal(mauer.tiefe, 200);
  assert.deepEqual(a.lagen.map((l) => l.offset), [0, 200, 0, 200]);
  assert.deepEqual(b.lagen.map((l) => l.offset), [200, 0, 200, 0]);
  assert.deepEqual(a.lagen.map((l) => l.nutzlaenge), [4000, 3800, 4000, 3800]);
  a.lagen.forEach((lage, i) => assert.notEqual(lage.fuehrend, b.lagen[i].fuehrend));
  a.lagen.forEach((lage) => {
    const rechts = Math.max(...lage.steine.map((s) => s.x + s.l));
    assert.equal(rechts, 4000, 'Außenkante wird eingehalten');
  });
});

test('Ecke: oberhalb des kürzeren Schenkels entfällt die Verzahnung', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 5 };
  cfg.schenkel[1] = { name: 'B', laenge: 2500, modus: 'lagen', lagen: 2 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.deepEqual(mauer.schenkel[0].lagen.map((l) => l.eckverzahnung), [true, true, false, false, false]);
  assert.deepEqual(mauer.schenkel[0].lagen.map((l) => l.nutzlaenge), [4000, 3800, 4000, 4000, 4000]);
});

test('Gerade Mauer hat nur einen Schenkel ohne Versatz', () => {
  const cfg = standardKonfig();
  cfg.form = 'gerade';
  cfg.schenkel[0] = { name: 'A', laenge: 3000, modus: 'lagen', lagen: 3 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.equal(mauer.schenkel.length, 1);
  assert.ok(mauer.schenkel[0].lagen.every((l) => l.offset === 0 && l.eckverzahnung === false));
});

test('Schenkelhöhe und Abweichung zur Zielhöhe werden ausgewiesen', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 3000, modus: 'hoehe', zielHoehe: 900 };
  cfg.schenkel[1] = { name: 'B', laenge: 2000, modus: 'hoehe', zielHoehe: 560 };
  const mauer = baueMauer(cfg, verband, katalog);
  // erreichbar sind 84,0 cm (8 Bänder) und 91,0 cm (9 Bänder) - 91,0 liegt näher
  assert.equal(mauer.schenkel[0].hoehe, 910);
  assert.equal(mauer.schenkel[0].abweichung, 10);
  assert.equal(mauer.schenkel[0].lagenAnzahl, 9);
  assert.equal(mauer.schenkel[1].hoehe, 630);
  assert.equal(mauer.schenkel[1].lagenAnzahl, 6);
});

test('Jedes Band füllt seine Nutzlänge exakt aus', () => {
  const faelle = [
    { laengeA: 4000, laengeB: 2500, lagen: 8, fuge: 0, minStueck: 60 },
    { laengeA: 3370, laengeB: 1990, lagen: 9, fuge: 5, minStueck: 60 },
    { laengeA: 12345, laengeB: 6789, lagen: 11, fuge: 3, minStueck: 100 },
    { laengeA: 700, laengeB: 450, lagen: 3, fuge: 0, minStueck: 0 },
  ];

  for (const fall of faelle) {
    const cfg = standardKonfig();
    cfg.fuge = fall.fuge;
    cfg.minStueck = fall.minStueck;
    cfg.schenkel[0] = { name: 'A', laenge: fall.laengeA, modus: 'lagen', lagen: fall.lagen };
    cfg.schenkel[1] = { name: 'B', laenge: fall.laengeB, modus: 'lagen', lagen: fall.lagen };
    const mauer = baueMauer(cfg, verband, katalog);

    for (const schenkel of mauer.schenkel) {
      for (const lage of schenkel.lagen) {
        for (const dy of [0, 70]) {
          const reihe = lage.steine.filter((s) => s.h === 70 && s.dy === dy);
          if (!reihe.length) continue;
          // 7-cm-Reihen dürfen Lücken haben (dort stehen 14-cm-Steine),
          // aber nie über die Nutzlänge hinausragen.
          const rechts = Math.max(...reihe.map((s) => s.x + s.l));
          assert.ok(rechts <= lage.offset + lage.nutzlaenge + 0.6, `${schenkel.name} B${lage.index + 1}`);
        }
        const rechts = Math.max(...lage.steine.map((s) => s.x + s.l));
        assert.ok(
          Math.abs(rechts - (lage.offset + lage.nutzlaenge)) < 0.6,
          `${schenkel.name} B${lage.index + 1}: endet bei ${rechts}`,
        );
        assert.ok(lage.steine.every((s) => s.x >= lage.offset - 0.6), 'kein Stein vor der Ecke');
        assert.ok(lage.steine.every((s) => s.l > 0 && s.l <= katalog[s.steinId].l + 0.5));
      }
    }
  }
});

test('Entartete Ecke (Schenkel kürzer als die Mauerdicke) bleibt berechenbar', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 200, modus: 'lagen', lagen: 2 };
  cfg.schenkel[1] = { name: 'B', laenge: 200, modus: 'lagen', lagen: 2 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.equal(mauer.schenkel[0].lagen[1].steine.length, 0, 'zurückgesetztes Band bleibt leer');
  assert.equal(mauer.schenkel[0].hoehe, 210);
});
