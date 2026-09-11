import test from 'node:test';
import assert from 'node:assert/strict';

import { steinMap } from '../src/data/catalog.js';
import { VERBAENDE, pruefeVerband } from '../src/data/patterns.js';
import {
  standardKonfig, lagenFolge, hoeheVonLagen, lagenFuerHoehe, fuelleLage, baueMauer,
} from '../src/core/wall.js';

const katalog = steinMap();
const verband = VERBAENDE[0];

test('Verband 6016 ist plausibel (einheitliche Lagenhoehen)', () => {
  assert.deepEqual(pruefeVerband(verband, katalog), []);
});

test('fuelleLage schneidet den letzten Stein auf Restmass', () => {
  const steine = fuelleLage({ laenge: 1000, steine: ['XXL'], katalog });
  assert.equal(steine.length, 3);
  assert.deepEqual(steine.map((s) => s.l), [400, 400, 200]);
  assert.deepEqual(steine.map((s) => s.zuschnitt), [false, false, true]);
  assert.equal(steine.at(-1).x, 800);
});

test('fuelleLage vermeidet Splitter kleiner als minStueck', () => {
  const steine = fuelleLage({ laenge: 830, steine: ['XXL'], katalog, minStueck: 60 });
  const summe = steine.reduce((s, x) => s + x.l, 0);
  assert.equal(summe, 830);
  assert.ok(steine.at(-1).l >= 60, 'letztes Stueck >= minStueck');
  assert.ok(steine.at(-2).l >= 60, 'vorletztes Stueck >= minStueck');
  assert.equal(steine.at(-2).zuschnitt, true, 'vorletzter Stein wird mitgeteilt');
  assert.equal(steine.at(-1).x, steine.at(-2).x + steine.at(-2).l);
});

test('fuelleLage beruecksichtigt Stossfugen', () => {
  const steine = fuelleLage({ laenge: 1000, steine: ['XXL'], katalog, fuge: 10 });
  assert.deepEqual(steine.map((s) => s.x), [0, 410, 820]);
  assert.equal(steine.at(-1).l, 180);
});

test('fuelleLage startet am Ecken-Offset', () => {
  const steine = fuelleLage({ laenge: 800, offset: 200, steine: ['XXL'], katalog });
  assert.equal(steine[0].x, 200);
  assert.equal(steine.at(-1).x + steine.at(-1).l, 1000);
});

test('lagenFolge: reiner Verband wiederholt sich zyklisch', () => {
  const cfg = standardKonfig();
  const lagen = lagenFolge(cfg, verband, 6);
  assert.equal(lagen.length, 6);
  assert.deepEqual(lagen[0].steine, verband.lagen[0].steine);
  assert.deepEqual(lagen[4].steine, verband.lagen[0].steine);
  assert.ok(lagen.every((l) => l.quelle === 'verband'));
});

test('lagenFolge: Abschlusslage ersetzen tauscht erste/letzte Lage', () => {
  const cfg = standardKonfig();
  cfg.abschluss.unten = { modus: 'ersetzen', steine: ['L'] };
  cfg.abschluss.oben = { modus: 'ersetzen', steine: ['XXL'] };
  const lagen = lagenFolge(cfg, verband, 5);
  assert.equal(lagen.length, 5);
  assert.deepEqual(lagen[0].steine, ['L']);
  assert.equal(lagen[0].quelle, 'unten');
  assert.deepEqual(lagen[4].steine, ['XXL']);
  assert.equal(lagen[4].quelle, 'oben');
  assert.ok(lagen.slice(1, 4).every((l) => l.quelle === 'verband'));
});

test('lagenFolge: zusaetzliche Abschlusslagen erhoehen den Verbandanteil nicht', () => {
  const cfg = standardKonfig();
  cfg.abschluss.unten = { modus: 'zusaetzlich', steine: ['S'] };
  cfg.abschluss.oben = { modus: 'zusaetzlich', steine: ['S'] };
  const lagen = lagenFolge(cfg, verband, 6);
  assert.equal(lagen.length, 6);
  assert.equal(lagen[0].quelle, 'unten');
  assert.equal(lagen[5].quelle, 'oben');
  assert.equal(lagen.filter((l) => l.quelle === 'verband').length, 4);
  assert.deepEqual(lagen[1].steine, verband.lagen[0].steine);
});

test('Hoehe: 6 Verbandlagen a 14 cm ergeben 84 cm', () => {
  const cfg = standardKonfig();
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 6), katalog), 840);
});

test('Hoehe: Lagerfuge wird zwischen den Lagen addiert', () => {
  const cfg = standardKonfig();
  cfg.lagenfuge = 5;
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 4), katalog, 5), 4 * 140 + 3 * 5);
});

test('Hoehe: Sonderlage mit 7 cm veraendert die Gesamthoehe', () => {
  const cfg = standardKonfig();
  cfg.abschluss.oben = { modus: 'zusaetzlich', steine: ['S'] };
  assert.equal(hoeheVonLagen(lagenFolge(cfg, verband, 6), katalog), 5 * 140 + 70);
});

test('lagenFuerHoehe waehlt die naechstliegende Lagenzahl', () => {
  const cfg = standardKonfig();
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 800), {
    lagen: 6, hoehe: 840, abweichung: 40,
  });
  assert.deepEqual(lagenFuerHoehe(cfg, verband, katalog, 700), {
    lagen: 5, hoehe: 700, abweichung: 0,
  });
});

test('Ecke: Schenkel verzahnen sich lagenweise', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 4 };
  cfg.schenkel[1] = { name: 'B', laenge: 2500, modus: 'lagen', lagen: 4 };
  const mauer = baueMauer(cfg, verband, katalog);
  const [a, b] = mauer.schenkel;

  assert.equal(mauer.tiefe, 200);
  assert.deepEqual(a.lagen.map((l) => l.offset), [0, 200, 0, 200]);
  assert.deepEqual(b.lagen.map((l) => l.offset), [200, 0, 200, 0]);
  assert.deepEqual(a.lagen.map((l) => l.nutzlaenge), [4000, 3800, 4000, 3800]);
  assert.deepEqual(b.lagen.map((l) => l.nutzlaenge), [2300, 2500, 2300, 2500]);

  // In jeder Lage fuehrt genau ein Schenkel ueber die Ecke.
  a.lagen.forEach((lage, i) => {
    assert.notEqual(lage.fuehrend, b.lagen[i].fuehrend);
  });
  // Aussenkante wird eingehalten.
  a.lagen.forEach((lage) => {
    assert.equal(lage.steine.at(-1).x + lage.steine.at(-1).l, 4000);
  });
});

test('Ecke: oberhalb des kuerzeren Schenkels entfaellt die Verzahnung', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 5 };
  cfg.schenkel[1] = { name: 'B', laenge: 2500, modus: 'lagen', lagen: 2 };
  const mauer = baueMauer(cfg, verband, katalog);
  const a = mauer.schenkel[0];
  assert.deepEqual(a.lagen.map((l) => l.eckverzahnung), [true, true, false, false, false]);
  assert.deepEqual(a.lagen.map((l) => l.nutzlaenge), [4000, 3800, 4000, 4000, 4000]);
});

test('Gerade Mauer hat nur einen Schenkel ohne Versatz', () => {
  const cfg = standardKonfig();
  cfg.form = 'gerade';
  cfg.schenkel[0] = { name: 'A', laenge: 3000, modus: 'lagen', lagen: 3 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.equal(mauer.schenkel.length, 1);
  assert.ok(mauer.schenkel[0].lagen.every((l) => l.offset === 0));
  assert.ok(mauer.schenkel[0].lagen.every((l) => l.eckverzahnung === false));
});

test('Schenkelhoehe und Abweichung zur Zielhoehe werden ausgewiesen', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 3000, modus: 'hoehe', zielHoehe: 900 };
  cfg.schenkel[1] = { name: 'B', laenge: 2000, modus: 'hoehe', zielHoehe: 560 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.equal(mauer.schenkel[0].hoehe, 840);
  assert.equal(mauer.schenkel[0].abweichung, -60);
  assert.equal(mauer.schenkel[1].hoehe, 560);
  assert.equal(mauer.schenkel[1].lagenAnzahl, 4);
});

test('Jede Lage fuellt ihre Nutzlaenge exakt aus (verschiedene Konfigurationen)', () => {
  const faelle = [
    { laengeA: 4000, laengeB: 2500, lagen: 6, fuge: 0, minStueck: 60 },
    { laengeA: 3370, laengeB: 1990, lagen: 7, fuge: 5, minStueck: 60 },
    { laengeA: 12345, laengeB: 6789, lagen: 9, fuge: 3, minStueck: 100 },
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
        const belegt = lage.steine.reduce((s, x) => s + x.l, 0)
          + Math.max(0, lage.steine.length - 1) * fall.fuge;
        assert.ok(
          Math.abs(belegt - lage.nutzlaenge) < 0.6,
          `${schenkel.name} L${lage.index + 1}: ${belegt} statt ${lage.nutzlaenge}`,
        );
        assert.equal(lage.steine[0].x, lage.offset, 'Lage beginnt am Ecken-Offset');
        for (const stein of lage.steine) {
          assert.ok(stein.l > 0, 'kein Stein mit Laenge 0');
          assert.ok(stein.l <= katalog[stein.steinId].l + 0.5, 'kein Stein laenger als sein Format');
        }
      }
    }
  }
});

test('Entartete Ecke (Schenkel kuerzer als die Mauerdicke) bleibt berechenbar', () => {
  const cfg = standardKonfig();
  cfg.schenkel[0] = { name: 'A', laenge: 200, modus: 'lagen', lagen: 2 };
  cfg.schenkel[1] = { name: 'B', laenge: 200, modus: 'lagen', lagen: 2 };
  const mauer = baueMauer(cfg, verband, katalog);
  assert.deepEqual(mauer.schenkel[0].lagen.map((l) => l.steine.length), [1, 0]);
  assert.deepEqual(mauer.schenkel[1].lagen.map((l) => l.steine.length), [0, 1]);
  assert.equal(mauer.schenkel[0].hoehe, 280);
});
