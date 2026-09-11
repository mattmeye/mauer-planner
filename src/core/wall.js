/**
 * Geometrie-Modell der Mauer.
 *
 * Alle Laengen in Millimetern. Eine Mauer besteht aus einem Schenkel (gerade)
 * oder aus zwei Schenkeln, die im 90-Grad-Winkel aneinanderstossen (Ecke).
 *
 * Koordinaten je Schenkel: x = 0 liegt an der Ecke (bzw. am linken Ende einer
 * geraden Mauer) und waechst zum freien Ende hin. Dadurch wird - wie auf der
 * Baustelle - von der Ecke weg verlegt und der Zuschnitt faellt am freien
 * Ende an.
 */

import { verbandLage } from '../data/patterns.js';

/** Rechen-Toleranz in mm. */
const TOL = 0.5;

/** Maximal betrachtete Lagenzahl bei der Hoehenermittlung. */
const MAX_LAGEN = 60;

export function standardKonfig() {
  return {
    name: 'Neuer Mauerplan',
    form: 'ecke',
    verbandId: '6016',
    startLage: 0,
    fuge: 0,
    lagenfuge: 0,
    minStueck: 60,
    schenkel: [
      { name: 'Schenkel A', laenge: 4000, modus: 'hoehe', zielHoehe: 800, lagen: 6 },
      { name: 'Schenkel B', laenge: 2500, modus: 'hoehe', zielHoehe: 800, lagen: 6 },
    ],
    abschluss: {
      unten: { modus: 'verband', steine: ['XXL'] },
      oben: { modus: 'verband', steine: ['XXL'] },
    },
    restnutzung: true,
    minRest: 100,
    saegeblatt: 3,
    verschnitt: 5,
  };
}

/** Rundet auf ganze Millimeter. */
export function mm(wert) {
  return Math.round(wert * 10) / 10;
}

/**
 * Baut die Lagenfolge (von unten nach oben) fuer eine gegebene Lagenzahl.
 * Beruecksichtigt Sonderlagen unten/oben (`verband` | `ersetzen` | `zusaetzlich`).
 */
export function lagenFolge(cfg, verband, anzahl) {
  const unten = cfg.abschluss?.unten ?? { modus: 'verband' };
  const oben = cfg.abschluss?.oben ?? { modus: 'verband' };
  const n = Math.max(0, Math.round(anzahl));
  if (n === 0) return [];

  const sonder = (def, quelle) => ({
    steine: (def.steine && def.steine.length ? def.steine : ['XXL']).slice(),
    quelle,
  });

  const extraUnten = unten.modus === 'zusaetzlich' ? 1 : 0;
  const extraOben = oben.modus === 'zusaetzlich' ? 1 : 0;
  const verbandLagen = Math.max(0, n - extraUnten - extraOben);

  const liste = [];
  if (extraUnten && liste.length < n) liste.push(sonder(unten, 'unten'));
  for (let i = 0; i < verbandLagen; i++) {
    const index = i + (cfg.startLage || 0);
    liste.push({
      steine: verbandLage(verband, index).steine.slice(),
      quelle: 'verband',
      verbandIndex: ((index % verband.lagen.length) + verband.lagen.length) % verband.lagen.length,
    });
  }
  if (extraOben && liste.length < n) liste.push(sonder(oben, 'oben'));

  if (unten.modus === 'ersetzen' && liste.length) liste[0] = sonder(unten, 'unten');
  if (oben.modus === 'ersetzen' && liste.length) liste[liste.length - 1] = sonder(oben, 'oben');

  return liste.slice(0, n);
}

/** Hoehe einer Lage = Hoehe ihres (einheitlichen) Steinformats. */
export function lagenHoehe(lage, katalog) {
  for (const id of lage.steine) {
    const stein = katalog[id];
    if (stein) return stein.h;
  }
  return 0;
}

/** Gesamthoehe einer Lagenfolge inklusive Lagerfugen. */
export function hoeheVonLagen(lagen, katalog, lagenfuge = 0) {
  if (!lagen.length) return 0;
  const steine = lagen.reduce((summe, lage) => summe + lagenHoehe(lage, katalog), 0);
  return steine + (lagen.length - 1) * lagenfuge;
}

/**
 * Ermittelt die Lagenzahl, deren Hoehe der Zielhoehe am naechsten kommt.
 * Gibt zusaetzlich die tatsaechliche Hoehe und die Abweichung zurueck.
 */
export function lagenFuerHoehe(cfg, verband, katalog, zielHoehe) {
  let beste = { lagen: 1, hoehe: 0, abweichung: Infinity };
  for (let n = 1; n <= MAX_LAGEN; n++) {
    const hoehe = hoeheVonLagen(lagenFolge(cfg, verband, n), katalog, cfg.lagenfuge || 0);
    const abweichung = hoehe - zielHoehe;
    if (Math.abs(abweichung) < Math.abs(beste.abweichung)) {
      beste = { lagen: n, hoehe, abweichung };
    }
    if (hoehe > zielHoehe && Math.abs(abweichung) > Math.abs(beste.abweichung)) break;
  }
  return beste;
}

/**
 * Fuellt eine Lage ueber die nutzbare Laenge mit der zyklisch wiederholten
 * Steinfolge. Der letzte Stein wird bei Bedarf zugeschnitten.
 *
 * Ist das Reststueck kleiner als `minStueck`, werden die beiden letzten Steine
 * gleichmaessig aufgeteilt (kein Splitter am Mauerende).
 */
export function fuelleLage({ laenge, steine, katalog, fuge = 0, minStueck = 60, offset = 0 }) {
  const platzierte = [];
  if (laenge <= TOL || !steine || !steine.length) return platzierte;

  let x = offset;
  const ende = offset + laenge;
  let idx = 0;
  let guard = 0;

  while (ende - x > TOL && guard++ < 5000) {
    const start = platzierte.length ? x + fuge : x;
    if (ende - start <= TOL) break;
    const stein = katalog[steine[idx % steine.length]];
    idx++;
    if (!stein) continue;
    const platz = ende - start;
    if (stein.l <= platz + TOL) {
      platzierte.push({ steinId: stein.id, l: stein.l, x: start, zuschnitt: false });
      x = start + stein.l;
    } else {
      platzierte.push({
        steinId: stein.id,
        l: mm(platz),
        x: start,
        zuschnitt: true,
        ausgangslaenge: stein.l,
      });
      x = ende;
    }
  }

  verteileReststueck(platzierte, katalog, minStueck, fuge);
  return platzierte;
}

/** Verhindert Splitter am Lagenende, indem die letzten beiden Steine geteilt werden. */
function verteileReststueck(platzierte, katalog, minStueck, fuge) {
  if (platzierte.length < 2) return;
  const last = platzierte[platzierte.length - 1];
  if (!last.zuschnitt || last.l >= minStueck) return;

  const prev = platzierte[platzierte.length - 2];
  const prevMax = prev.ausgangslaenge ?? katalog[prev.steinId]?.l ?? prev.l;
  const lastMax = last.ausgangslaenge ?? katalog[last.steinId]?.l ?? last.l;
  const gesamt = prev.l + last.l;

  let b = Math.min(lastMax, Math.round(gesamt / 2 / 10) * 10);
  if (b < minStueck) b = Math.min(lastMax, minStueck);
  let a = gesamt - b;
  if (a > prevMax) {
    a = prevMax;
    b = gesamt - a;
  }
  if (a < minStueck || b < minStueck || a > prevMax || b > lastMax) return;

  if (a < prevMax) {
    prev.zuschnitt = true;
    prev.ausgangslaenge = prevMax;
  }
  prev.l = mm(a);
  last.l = mm(b);
  last.x = mm(prev.x + prev.l + (fuge || 0));
  if (last.l >= lastMax - TOL) {
    last.zuschnitt = false;
    delete last.ausgangslaenge;
  }
}

/**
 * Baut die komplette Mauer.
 * @returns {{form:string, tiefe:number, schenkel:Array}}
 */
export function baueMauer(cfg, verband, katalog) {
  const tiefe = katalog[verband.lagen[0]?.steine[0]]?.d ?? 200;
  const geradeMauer = cfg.form !== 'ecke';
  const schenkelDefs = geradeMauer ? cfg.schenkel.slice(0, 1) : cfg.schenkel.slice(0, 2);

  // Lagenzahl je Schenkel ermitteln (aus Zielhoehe oder direkt vorgegeben).
  const lagenzahlen = schenkelDefs.map((s) => {
    if (s.modus === 'lagen') return Math.max(1, Math.round(s.lagen || 1));
    return lagenFuerHoehe(cfg, verband, katalog, s.zielHoehe || 0).lagen;
  });

  const schenkel = schenkelDefs.map((def, si) => {
    const anzahl = lagenzahlen[si];
    const defs = lagenFolge(cfg, verband, anzahl);
    const partnerLagen = geradeMauer ? 0 : (lagenzahlen[1 - si] ?? 0);
    const lagen = [];
    let y = 0;

    defs.forEach((lagenDef, i) => {
      const hoehe = lagenHoehe(lagenDef, katalog);
      // Eckverzahnung: in geraden Lagen laeuft Schenkel A durch, in ungeraden B.
      const beideVorhanden = !geradeMauer && i < partnerLagen;
      const eckeGehoertA = i % 2 === 0;
      const fuehrend = geradeMauer ? true : (si === 0 ? eckeGehoertA : !eckeGehoertA);
      const offset = beideVorhanden && !fuehrend ? tiefe : 0;
      const nutzlaenge = Math.max(0, def.laenge - offset);

      lagen.push({
        index: i,
        quelle: lagenDef.quelle,
        verbandIndex: lagenDef.verbandIndex,
        steinfolge: lagenDef.steine,
        hoehe,
        y,
        offset,
        nutzlaenge,
        eckverzahnung: beideVorhanden,
        fuehrend: beideVorhanden ? fuehrend : null,
        steine: fuelleLage({
          laenge: nutzlaenge,
          offset,
          steine: lagenDef.steine,
          katalog,
          fuge: cfg.fuge || 0,
          minStueck: cfg.minStueck ?? 60,
        }),
      });
      y += hoehe + (cfg.lagenfuge || 0);
    });

    const hoehe = hoeheVonLagen(defs, katalog, cfg.lagenfuge || 0);
    return {
      name: def.name || `Schenkel ${String.fromCharCode(65 + si)}`,
      laenge: def.laenge,
      lagenAnzahl: defs.length,
      hoehe,
      zielHoehe: def.modus === 'hoehe' ? def.zielHoehe : null,
      abweichung: def.modus === 'hoehe' ? hoehe - (def.zielHoehe || 0) : null,
      lagen,
    };
  });

  return { form: geradeMauer ? 'gerade' : 'ecke', tiefe, schenkel };
}
