import test from 'node:test';
import assert from 'node:assert/strict';

import { steinMap } from '../src/data/catalog.js';
import { VERBAENDE } from '../src/data/patterns.js';
import { standardKonfig, baueMauer } from '../src/core/wall.js';
import { kalkuliere } from '../src/core/calc.js';

const katalog = steinMap();
const verband = VERBAENDE[0];

/**
 * Das im EHL-Verlegebeispiel 6016 gezeichnete Mauerstück (340 x 84 cm),
 * aus den Vektordaten des Datenblatts ausgelesen.
 * Ein Zeichen = 10 x 7 cm; unterste Reihe zuerst.
 *   a = 20/20/7   b = 30/20/7   C = 30/20/14   D = 40/20/14
 *   Leerzeichen = im Datenblatt nicht mehr gezeichnet (Rand des Ausschnitts)
 *   ! = Überlagerung zweier Rechtecke in der PDF-Zeichnung
 */
const EHL_ZEICHNUNG = [
  'bbbaaaabbbaabbbaaaabbbaabbbaaaabbb',
  'DDDDaabbbDDDDCCCaabbbDDDDCCCaabbb ',
  'DDDDbbbaaDDDDCCCbbbaaDDDDCCCbbbaa ',
  'bbbaabbbaaaabbbaabbbaaaabbbaabbbaa',
  'aaDDDDCCCaabbbDDDDCCCaabbbDDDDCCC ',
  'aaDDDDCCCbbbaaDDDDCCCbbbaaDDDDCCC ',
  'bbbaabbbaabbbaaaabbbaabbbaaaabbbaa',
  'aaaabbbDDDDCCCaabbbDDDDCCCaabbb   ',
  'aabbbaaDDDDCCCbbbaaDDDDCCCbbbaa   ',
  'b!!bbbaaaabbbaabbbaaaabbbaabbbaaaa',
  'DDDDCCCaabbbDDDDCCCaabbbDDDDCCCaa ',
  'DDDDCCCbbbaaDDDDCCCbbbaaDDDDCCCbbb',
];

const ZEICHEN = { '20/7': 'a', '30/7': 'b', '30/14': 'C', '40/14': 'D' };

/** Zeichnet einen Schenkel in dasselbe Raster wie das Datenblatt. */
function raster(schenkel, spalten, reihen) {
  const feld = Array.from({ length: reihen }, () => Array(spalten).fill(' '));
  for (const lage of schenkel.lagen) {
    for (const stein of lage.steine) {
      const r0 = Math.round((lage.y + (stein.dy || 0)) / 70);
      const c0 = Math.round(stein.x / 100);
      for (let r = r0; r < r0 + Math.round(stein.h / 70); r++) {
        for (let c = c0; c < c0 + Math.round(stein.l / 100); c++) {
          if (r < reihen && c < spalten) feld[r][c] = ZEICHEN[stein.steinId] || '?';
        }
      }
    }
  }
  return feld.map((zeile) => zeile.join(''));
}

function mauerstueck(laenge, baender) {
  const cfg = standardKonfig();
  cfg.form = 'gerade';
  cfg.schenkel[0] = { name: 'A', laenge, modus: 'lagen', lagen: baender };
  return baueMauer(cfg, verband, katalog);
}

test('Der Verband gibt die Zeichnung des Datenblatts Stein für Stein wieder', () => {
  const mauer = mauerstueck(3400, 8);
  const gebaut = raster(mauer.schenkel[0], 34, 12);

  assert.equal(mauer.schenkel[0].hoehe, 840, 'Ausschnitt ist 84 cm hoch');

  let geprueft = 0;
  EHL_ZEICHNUNG.forEach((soll, r) => {
    for (let c = 0; c < soll.length; c++) {
      // Randzellen und die Überlagerung im PDF werden nicht verglichen
      if (soll[c] === ' ' || soll[c] === '!') continue;
      assert.equal(
        gebaut[r][c], soll[c],
        `Reihe ${r}, Spalte ${c}: erwartet "${soll[c]}", gebaut "${gebaut[r][c]}"\n`
        + `  Datenblatt: ${soll}\n  Mauerplan : ${gebaut[r]}`,
      );
      geprueft++;
    }
  });
  assert.equal(geprueft, 395, 'alle gezeichneten Rasterfelder wurden verglichen');
});

test('Bänder wechseln zwischen 7 und 14 cm, 14-cm-Bänder stapeln 7-cm-Steine', () => {
  const mauer = mauerstueck(3400, 8);
  const lagen = mauer.schenkel[0].lagen;

  assert.deepEqual(lagen.map((l) => l.hoehe), [70, 140, 70, 140, 70, 140, 70, 140]);
  for (const lage of lagen.filter((l) => l.hoehe === 70)) {
    assert.ok(lage.steine.every((s) => s.h === 70 && s.dy === 0));
  }
  for (const lage of lagen.filter((l) => l.hoehe === 140)) {
    assert.ok(lage.steine.some((s) => s.h === 140), 'enthält 14-cm-Steine');
    assert.ok(lage.steine.some((s) => s.h === 70 && s.dy === 70), 'enthält eine obere 7-cm-Reihe');
    // Jeder Punkt des Bandes ist genau einmal belegt (keine Lücken, keine Überlappung)
    const flaeche = lage.steine.reduce((summe, s) => summe + s.l * s.h, 0);
    assert.equal(flaeche, lage.nutzlaenge * lage.hoehe, `Band ${lage.index + 1} ist lückenlos`);
  }
});

test('Steinbedarf je m² entspricht den EHL-Richtwerten', () => {
  // Großes Mauerstück, damit die Anpassungen am Mauerbeginn kaum ins Gewicht fallen
  const cfg = standardKonfig();
  cfg.form = 'gerade';
  cfg.restnutzung = false;
  cfg.schenkel[0] = { name: 'A', laenge: 24000, modus: 'lagen', lagen: 24 };
  const mauer = baueMauer(cfg, verband, katalog);
  const kalk = kalkuliere(mauer, katalog, cfg, verband);

  assert.ok(Math.abs(kalk.summe.flaeche - 24 * 2.52) < 0.01);
  for (const position of kalk.positionen) {
    const richtwert = verband.bedarfSystem[position.steinId];
    assert.ok(
      Math.abs(position.jeQm - richtwert) < 0.35,
      `${position.steinId}: ${position.jeQm.toFixed(2)} Stk/m² statt ca. ${richtwert}`,
    );
  }
});

test('Die Ansichtsfläche der Steine deckt die Mauerfläche vollständig', () => {
  const mauer = mauerstueck(3370, 11);
  const schenkel = mauer.schenkel[0];
  const steinflaeche = schenkel.lagen
    .flatMap((l) => l.steine)
    .reduce((summe, s) => summe + s.l * s.h, 0);
  assert.equal(steinflaeche, schenkel.laenge * schenkel.hoehe);
});
