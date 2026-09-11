import test from 'node:test';
import assert from 'node:assert/strict';

import { steinMap, gewichtKg, STEINE } from '../src/data/catalog.js';
import { VERBAENDE } from '../src/data/patterns.js';
import { standardKonfig, baueMauer } from '../src/core/wall.js';
import { kalkuliere, schnittUebersicht } from '../src/core/calc.js';

const katalog = steinMap();
const verband = VERBAENDE[0];

/** Testverband mit frei waehlbarer Steinfolge. */
function testVerband(...lagen) {
  return { id: 'test', name: 'Test', lagen: lagen.map((steine) => ({ steine })) };
}

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
  const mauer = baueMauer(cfg, testVerband(['XXL']), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const xxl = k.positionen.find((p) => p.steinId === 'XXL');

  assert.equal(xxl.ganz, 2);
  assert.equal(xxl.zuschnitte, 1);
  assert.equal(xxl.verbrauch, 3);
  assert.equal(k.summe.schnitte, 1);
  assert.equal(k.schnitte[0].laenge, 200);
  assert.equal(k.schnitte[0].herkunft, 'neu');
});

test('Restverwertung spart Steine und wird ausgewiesen', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100 });
  cfg.schenkel[0].lagen = 2;
  const mauer = baueMauer(cfg, testVerband(['XXL']), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const xxl = k.positionen.find((p) => p.steinId === 'XXL');

  assert.equal(xxl.ganz, 4);
  assert.equal(xxl.zuschnitte, 2);
  assert.equal(xxl.ausRest, 1, 'zweiter Zuschnitt kommt aus dem Reststueck');
  assert.equal(xxl.verbrauch, 5);
  assert.equal(k.summe.ausRest, 1);
  assert.equal(k.reste.length, 0, 'Reststueck wurde vollstaendig aufgebraucht');
});

test('Schnittfugenverlust verhindert die passgenaue Wiederverwendung', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100, saegeblatt: 3 });
  cfg.schenkel[0].lagen = 2;
  const mauer = baueMauer(cfg, testVerband(['XXL']), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const xxl = k.positionen.find((p) => p.steinId === 'XXL');

  assert.equal(xxl.ausRest, 0);
  assert.equal(xxl.verbrauch, 6);
  assert.deepEqual(k.reste.map((r) => r.laenge), [197, 197]);
});

test('Reststuecke werden nur bei gleicher Lagenhoehe wiederverwendet', () => {
  const cfg = konfig({ restnutzung: true, minRest: 100 });
  cfg.schenkel[0].lagen = 2;
  // Lage 1: 7-cm-Steine (Rest 100 mm), Lage 2: 14-cm-Steine (Bedarf 200 mm)
  const mauer = baueMauer(cfg, testVerband(['M'], ['XXL']), katalog);
  const k = kalkuliere(mauer, katalog, cfg);

  assert.equal(k.summe.ausRest, 0);
  assert.equal(k.reste.length, 2);
  assert.deepEqual(k.reste.map((r) => r.steinId).sort(), ['M', 'XXL']);
});

test('Bestellmenge enthaelt den Verschnittzuschlag', () => {
  const cfg = konfig({ verschnitt: 10 });
  const mauer = baueMauer(cfg, testVerband(['XXL']), katalog);
  const k = kalkuliere(mauer, katalog, cfg);
  const xxl = k.positionen.find((p) => p.steinId === 'XXL');
  assert.equal(xxl.verbrauch, 3);
  assert.equal(xxl.bestellmenge, 4, '3 Steine + 10 % aufgerundet');
});

test('Flaeche, Laufmeter und Gewicht werden je Schenkel summiert', () => {
  const cfg = standardKonfig();
  cfg.restnutzung = false;
  cfg.schenkel[0] = { name: 'A', laenge: 4000, modus: 'lagen', lagen: 5 };
  cfg.schenkel[1] = { name: 'B', laenge: 2000, modus: 'lagen', lagen: 5 };
  const mauer = baueMauer(cfg, verband, katalog);
  const k = kalkuliere(mauer, katalog, cfg);

  assert.equal(k.schenkel.length, 2);
  assert.equal(k.schenkel[0].hoehe, 700);
  assert.equal(Math.round(k.summe.laufmeter * 100) / 100, 6);
  assert.equal(Math.round(k.summe.flaeche * 1000) / 1000, 4.2);

  const erwartet = k.positionen.reduce(
    (s, p) => s + gewichtKg(katalog[p.steinId]) * p.verbrauch, 0,
  );
  assert.ok(Math.abs(k.summe.gewicht - erwartet) < 1e-9);
});

test('Gewichtsschaetzung liegt im plausiblen Bereich', () => {
  const xxl = STEINE.find((s) => s.id === 'XXL');
  assert.ok(gewichtKg(xxl) > 20 && gewichtKg(xxl) < 32, 'XXL ca. 26 kg');
});

test('Schnittuebersicht gruppiert gleiche Zuschnitte', () => {
  const uebersicht = schnittUebersicht([
    { steinId: 'XXL', laenge: 200, herkunft: 'neu' },
    { steinId: 'XXL', laenge: 200, herkunft: 'rest' },
    { steinId: 'XL', laenge: 150, herkunft: 'neu' },
  ]);
  assert.equal(uebersicht.length, 2);
  const xxl = uebersicht.find((u) => u.steinId === 'XXL');
  assert.deepEqual(xxl, { steinId: 'XXL', laenge: 200, anzahl: 2, ausRest: 1 });
});

test('Kalkulation der Standardkonfiguration ist in sich schluessig', () => {
  const cfg = standardKonfig();
  const mauer = baueMauer(cfg, verband, katalog);
  const k = kalkuliere(mauer, katalog, cfg);

  const verlegt = mauer.schenkel
    .flatMap((s) => s.lagen)
    .reduce((summe, lage) => summe + lage.steine.length, 0);
  assert.equal(k.summe.steine, verlegt);
  assert.equal(
    k.summe.schnitte,
    mauer.schenkel.flatMap((s) => s.lagen).flatMap((l) => l.steine).filter((s) => s.zuschnitt).length,
  );
  assert.ok(k.summe.bestellmenge >= k.summe.verbrauch);
});
