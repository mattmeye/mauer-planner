import test from 'node:test';
import assert from 'node:assert/strict';

import { steinMap, gewichtKg, STEINE } from '../src/data/catalog.js';
import { VERBAENDE } from '../src/data/patterns.js';
import { standardKonfig, baueMauer } from '../src/core/wall.js';
import { kalkuliere, schnittUebersicht } from '../src/core/calc.js';

const katalog = steinMap();
const verband = VERBAENDE[0];

/** Testverband aus frei wählbaren Bändern. */
const testVerband = (...lagen) => ({ id: 'test', name: 'Test', lagen });
const band = (hoehe, muster) => ({ hoehe, anfang: [], muster });

function konfig(over = {}) {
  const cfg = standardKonfig();
  cfg.form = 'gerade';
  cfg.restnutzung = false;
  cfg.saegeblatt = 0;
  cfg.verschnitt = 0;
  cfg.schenkel[0] = { name: 'A', laenge: 1000, modus: 'lagen', lagen: 1 };
  return Object.assign(cfg, over);
}

test('Steinbedarf ohne Restverwertung: jeder Zuschnitt verbraucht einen Stein', () => {
  const cfg = konfig();
  const mauer = baueMauer(cfg, testVerband(band(140, ['40/14'])), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const position = k.positionen.find((p) => p.steinId === '40/14');

  assert.equal(position.ganz, 2);
  assert.equal(position.zuschnitte, 1);
  assert.equal(position.verbrauch, 3);
  assert.equal(k.summe.schnitte, 1);
  assert.equal(k.schnitte[0].laenge, 200);
  assert.equal(k.schnitte[0].herkunft, 'neu');
});

test('Restverwertung spart Steine und wird ausgewiesen', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100 });
  cfg.schenkel[0].lagen = 2;
  const mauer = baueMauer(cfg, testVerband(band(140, ['40/14'])), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const position = k.positionen.find((p) => p.steinId === '40/14');

  assert.equal(position.ganz, 4);
  assert.equal(position.zuschnitte, 2);
  assert.equal(position.ausRest, 1, 'zweiter Zuschnitt kommt aus dem Reststück');
  assert.equal(position.verbrauch, 5);
  assert.equal(k.summe.ausRest, 1);
  assert.equal(k.reste.length, 0, 'Reststück wurde vollständig aufgebraucht');
});

test('Schnittfugenverlust verhindert die passgenaue Wiederverwendung', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100, saegeblatt: 3 });
  cfg.schenkel[0].lagen = 2;
  const mauer = baueMauer(cfg, testVerband(band(140, ['40/14'])), katalog);
  const k = kalkuliere(mauer, katalog, cfg);

  assert.equal(k.summe.ausRest, 0);
  assert.equal(k.positionen[0].verbrauch, 6);
  assert.deepEqual(k.reste.map((r) => r.laenge), [197, 197]);
});

test('Reststücke werden nur bei gleicher Steinhöhe wiederverwendet', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100 });
  cfg.schenkel[0].lagen = 2;
  // Band 1: 7-cm-Steine (Rest 200 mm), Band 2: 14-cm-Steine (Bedarf 200 mm)
  const mauer = baueMauer(cfg, testVerband(band(70, ['30/7']), band(140, ['40/14'])), katalog);
  const k = kalkuliere(mauer, katalog, cfg);

  assert.equal(k.summe.schnitte, 2);
  assert.equal(k.summe.ausRest, 0);
  assert.deepEqual(k.reste.map((r) => r.steinId).sort(), ['30/7', '40/14']);
});

test('Bestellmenge enthält den Verschnittzuschlag', () => {
  const cfg = konfig({ verschnitt: 10 });
  const mauer = baueMauer(cfg, testVerband(band(140, ['40/14'])), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const position = k.positionen[0];
  assert.equal(position.verbrauch, 3);
  assert.equal(position.bestellmenge, 4, '3 Steine + 10 % aufgerundet');
});

test('Fläche, Laufmeter und Gewicht werden je Schenkel summiert', () => {
  const cfg = standardKonfig();
  cfg.restnutzung = false;
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 8 };
  cfg.schenkel[1] = { name: 'B', laenge: 2000, modus: 'lagen', lagen: 8 };
  const mauer = baueMauer(cfg, verband, katalog);
  const k = kalkuliere(mauer, katalog, cfg, verband);

  assert.equal(k.schenkel.length, 2);
  assert.equal(k.schenkel[0].hoehe, 840);
  assert.equal(Math.round(k.summe.laufmeter * 100) / 100, 6);
  assert.equal(Math.round(k.summe.flaeche * 1000) / 1000, 5.04);

  const erwartet = k.positionen.reduce(
    (s, p) => s + gewichtKg(katalog[p.steinId]) * p.verbrauch, 0,
  );
  assert.ok(Math.abs(k.summe.gewicht - erwartet) < 1e-9);
});

test('Richtwerte des Datenblatts werden mitgeführt', () => {
  const cfg = standardKonfig();
  const mauer = baueMauer(cfg, verband, katalog);
  const k = kalkuliere(mauer, katalog, cfg, verband);
  const position = k.positionen.find((p) => p.steinId === '40/14');
  assert.equal(position.richtwertSystem, 4);
  assert.equal(position.richtwertDiy, 3.7);
  assert.ok(position.jeQm > 0);
});

test('Gewichtsschätzung liegt im plausiblen Bereich', () => {
  const gross = STEINE.find((s) => s.id === '40/14');
  const klein = STEINE.find((s) => s.id === '20/7');
  assert.ok(gewichtKg(gross) > 20 && gewichtKg(gross) < 32, '40/20/14 ca. 26 kg');
  assert.ok(gewichtKg(klein) > 5 && gewichtKg(klein) < 9, '20/20/7 ca. 6,6 kg');
});

test('Schnittübersicht gruppiert gleiche Zuschnitte', () => {
  const uebersicht = schnittUebersicht([
    { steinId: '40/14', laenge: 200, herkunft: 'neu' },
    { steinId: '40/14', laenge: 200, herkunft: 'rest' },
    { steinId: '30/7', laenge: 150, herkunft: 'neu' },
  ]);
  assert.equal(uebersicht.length, 2);
  assert.deepEqual(
    uebersicht.find((u) => u.steinId === '40/14'),
    { steinId: '40/14', laenge: 200, anzahl: 2, ausRest: 1 },
  );
});

test('Kalkulation der Standardkonfiguration ist in sich schlüssig', () => {
  const cfg = standardKonfig();
  const mauer = baueMauer(cfg, verband, katalog);
  const k = kalkuliere(mauer, katalog, cfg, verband);
  const alleSteine = mauer.schenkel.flatMap((s) => s.lagen).flatMap((l) => l.steine);

  assert.equal(k.summe.steine, alleSteine.length);
  assert.equal(k.summe.schnitte, alleSteine.filter((s) => s.zuschnitt).length);
  assert.ok(k.summe.bestellmenge >= k.summe.verbrauch);
  assert.equal(k.positionen.map((p) => p.steinId).join(), '40/14,30/14,30/7,20/7');
});
