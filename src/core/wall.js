/**
 * Geometrie-Modell der Mauer.
 *
 * Alle Längen in Millimetern. Eine Mauer besteht aus einem Schenkel (gerade)
 * oder aus zwei Schenkeln, die im 90-Grad-Winkel aneinanderstoßen (Ecke).
 *
 * Koordinaten je Schenkel: x = 0 liegt an der Ecke (bzw. am linken Ende einer
 * geraden Mauer) und wächst zum freien Ende hin. Dadurch wird - wie auf der
 * Baustelle - von der Ecke weg verlegt und der Zuschnitt fällt am freien
 * Ende an. Innerhalb eines Bandes gibt `dy` die Höhe über der Bandunterkante
 * an: 7-cm-Steine in einem 14-cm-Band liegen mit dy = 0 bzw. dy = 70.
 */

import { verbandLage, istFeld } from '../data/patterns.js';

/** Rechen-Toleranz in mm. */
const TOL = 0.5;

/** Maximal betrachtete Bandzahl bei der Höhenermittlung. */
const MAX_LAGEN = 80;

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
      { name: 'Schenkel A', laenge: 4000, modus: 'hoehe', zielHoehe: 840, lagen: 8 },
      { name: 'Schenkel B', laenge: 2500, modus: 'hoehe', zielHoehe: 840, lagen: 8 },
    ],
    abschluss: {
      unten: { modus: 'verband', steine: ['40/14'] },
      oben: { modus: 'verband', steine: ['40/14'] },
    },
    restnutzung: true,
    minRest: 100,
    saegeblatt: 3,
    verschnitt: 5,
  };
}

/** Rundet auf Zehntelmillimeter. */
export function mm(wert) {
  return Math.round(wert * 10) / 10;
}

/**
 * Baut die Bandfolge (von unten nach oben) für eine gegebene Bandzahl.
 * Berücksichtigt Sonderlagen unten/oben (`verband` | `ersetzen` | `zusaetzlich`).
 */
export function lagenFolge(cfg, verband, anzahl, katalog) {
  const unten = cfg.abschluss?.unten ?? { modus: 'verband' };
  const oben = cfg.abschluss?.oben ?? { modus: 'verband' };
  const n = Math.max(0, Math.round(anzahl));
  if (n === 0) return [];

  const sonder = (def, quelle) => {
    const ids = (def.steine?.length ? def.steine : ['40/14']).filter((id) => katalog[id]);
    const steine = ids.length ? ids : ['40/14'];
    return { hoehe: katalog[steine[0]].h, anfang: [], muster: steine.slice(), quelle };
  };

  const extraUnten = unten.modus === 'zusaetzlich' ? 1 : 0;
  const extraOben = oben.modus === 'zusaetzlich' ? 1 : 0;
  const verbandLagen = Math.max(0, n - extraUnten - extraOben);

  const liste = [];
  if (extraUnten) liste.push(sonder(unten, 'unten'));
  for (let i = 0; i < verbandLagen; i++) {
    const index = i + (cfg.startLage || 0);
    const band = verbandLage(verband, index);
    liste.push({
      hoehe: band.hoehe,
      anfang: band.anfang || [],
      muster: band.muster,
      quelle: 'verband',
      verbandIndex: ((index % verband.lagen.length) + verband.lagen.length) % verband.lagen.length,
    });
  }
  if (extraOben) liste.push(sonder(oben, 'oben'));

  if (unten.modus === 'ersetzen' && liste.length) liste[0] = sonder(unten, 'unten');
  if (oben.modus === 'ersetzen' && liste.length) liste[liste.length - 1] = sonder(oben, 'oben');

  return liste.slice(0, n);
}

/** Gesamthöhe einer Bandfolge inklusive Lagerfugen. */
export function hoeheVonLagen(lagen, lagenfuge = 0) {
  if (!lagen.length) return 0;
  return lagen.reduce((s, l) => s + l.hoehe, 0) + (lagen.length - 1) * lagenfuge;
}

/**
 * Ermittelt die Bandzahl, deren Höhe der Zielhöhe am nächsten kommt.
 * Bei gleichem Abstand wird die größere Höhe gewählt (die Mauer erreicht das
 * Ziel dann eher, als dass sie darunter bleibt).
 * @returns {{lagen:number, hoehe:number, abweichung:number}}
 */
export function lagenFuerHoehe(cfg, verband, katalog, zielHoehe) {
  let beste = { lagen: 1, hoehe: 0, abweichung: Infinity };
  for (let n = 1; n <= MAX_LAGEN; n++) {
    const hoehe = hoeheVonLagen(lagenFolge(cfg, verband, n, katalog), cfg.lagenfuge || 0);
    const abweichung = hoehe - zielHoehe;
    const abstand = Math.abs(abweichung);
    const bisher = Math.abs(beste.abweichung);
    if (abstand < bisher || (abstand === bisher && abweichung > 0)) {
      beste = { lagen: n, hoehe, abweichung };
    }
    if (hoehe > zielHoehe && abstand > Math.abs(beste.abweichung)) break;
  }
  return beste;
}

/** Endlose Elementfolge eines Bandes: erst `anfang`, dann `muster` in Schleife. */
function* elementFolge(lage) {
  for (const element of lage.anfang || []) yield element;
  const muster = lage.muster || [];
  for (let i = 0; muster.length; i++) yield muster[i % muster.length];
}

/** Breite einer Steinreihe inklusive der Stoßfugen zwischen ihren Steinen. */
function reihenBreite(ids, katalog, fuge) {
  const summe = ids.reduce((s, id) => s + (katalog[id]?.l || 0), 0);
  return summe + Math.max(0, ids.length - 1) * fuge;
}

/**
 * Legt eine Steinreihe ab `start` bis höchstens `ende`; der letzte Stein wird
 * bei Bedarf zugeschnitten.
 * @returns {{steine:Array, x:number}}
 */
function platziereReihe(ids, { start, ende, dy, katalog, fuge }) {
  const steine = [];
  let x = start;
  for (const id of ids) {
    const stein = katalog[id];
    if (!stein) continue;
    const pos = steine.length ? x + fuge : x;
    const platz = ende - pos;
    if (platz <= TOL) break;
    if (stein.l <= platz + TOL) {
      steine.push({ steinId: id, x: mm(pos), l: stein.l, h: stein.h, dy, zuschnitt: false });
      x = pos + stein.l;
    } else {
      steine.push({
        steinId: id, x: mm(pos), l: mm(platz), h: stein.h, dy, zuschnitt: true, ausgangslaenge: stein.l,
      });
      x = ende;
      break;
    }
  }
  return { steine, x };
}

/**
 * Füllt ein Band über die nutzbare Länge mit seiner Elementfolge.
 * Einzelsteine laufen über die volle Bandhöhe, Felder bestehen aus zwei
 * übereinanderliegenden Reihen 7-cm-Steine.
 */
export function fuelleLage({ lage, laenge, katalog, fuge = 0, minStueck = 60, offset = 0 }) {
  const steine = [];
  if (laenge <= TOL) return steine;

  const ende = offset + laenge;
  let x = offset;
  let erstes = true;
  let guard = 0;

  for (const element of elementFolge(lage)) {
    if (ende - x <= TOL || guard++ > 5000) break;
    const start = erstes ? x : x + fuge;
    if (ende - start <= TOL) break;
    erstes = false;

    if (istFeld(element)) {
      const breite = Math.min(reihenBreite(element.unten, katalog, fuge), ende - start);
      const bis = start + breite;
      steine.push(...platziereReihe(element.unten, { start, ende: bis, dy: 0, katalog, fuge }).steine);
      steine.push(...platziereReihe(element.oben, { start, ende: bis, dy: 70, katalog, fuge }).steine);
      x = bis;
    } else {
      const stein = katalog[element];
      if (!stein) continue;
      const platz = ende - start;
      if (stein.l <= platz + TOL) {
        steine.push({ steinId: element, x: mm(start), l: stein.l, h: stein.h, dy: 0, zuschnitt: false });
        x = start + stein.l;
      } else {
        steine.push({
          steinId: element, x: mm(start), l: mm(platz), h: stein.h, dy: 0, zuschnitt: true, ausgangslaenge: stein.l,
        });
        x = ende;
      }
    }
  }

  verteileReststuecke(steine, katalog, minStueck, fuge);
  steine.sort((a, b) => a.x - b.x || a.dy - b.dy);
  return steine;
}

/**
 * Verhindert Splitter am Bandende: ist das letzte Stück einer Reihe kleiner
 * als `minStueck`, werden die beiden letzten (unmittelbar benachbarten)
 * Steine dieser Reihe gleichmäßig aufgeteilt.
 */
function verteileReststuecke(steine, katalog, minStueck, fuge) {
  const reihen = new Map();
  for (const stein of steine) {
    const key = `${stein.h}|${stein.dy}`;
    if (!reihen.has(key)) reihen.set(key, []);
    reihen.get(key).push(stein);
  }

  for (const reihe of reihen.values()) {
    reihe.sort((a, b) => a.x - b.x);
    if (reihe.length < 2) continue;
    const last = reihe.at(-1);
    const prev = reihe.at(-2);
    if (!last.zuschnitt || last.l >= minStueck) continue;
    // Nur zulässig, wenn die beiden Steine wirklich nebeneinander liegen.
    if (Math.abs(prev.x + prev.l + fuge - last.x) > TOL) continue;

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
    if (a < minStueck || b < minStueck || a > prevMax || b > lastMax) continue;

    if (a < prevMax) {
      prev.zuschnitt = true;
      prev.ausgangslaenge = prevMax;
    }
    prev.l = mm(a);
    last.l = mm(b);
    last.x = mm(prev.x + prev.l + fuge);
    if (last.l >= lastMax - TOL) {
      last.zuschnitt = false;
      delete last.ausgangslaenge;
    }
  }
}

/**
 * Baut die komplette Mauer.
 * @returns {{form:string, tiefe:number, schenkel:Array}}
 */
export function baueMauer(cfg, verband, katalog) {
  const tiefe = Object.values(katalog)[0]?.d ?? 200;
  const geradeMauer = cfg.form !== 'ecke';
  const schenkelDefs = geradeMauer ? cfg.schenkel.slice(0, 1) : cfg.schenkel.slice(0, 2);

  const lagenzahlen = schenkelDefs.map((s) => (s.modus === 'lagen'
    ? Math.max(1, Math.round(s.lagen || 1))
    : lagenFuerHoehe(cfg, verband, katalog, s.zielHoehe || 0).lagen));

  const schenkel = schenkelDefs.map((def, si) => {
    const defs = lagenFolge(cfg, verband, lagenzahlen[si], katalog);
    const partnerLagen = geradeMauer ? 0 : (lagenzahlen[1 - si] ?? 0);
    const lagen = [];
    let y = 0;

    defs.forEach((lagenDef, i) => {
      // Eckverzahnung: in geraden Bändern läuft Schenkel A durch, in ungeraden B.
      const beideVorhanden = !geradeMauer && i < partnerLagen;
      const eckeGehoertA = i % 2 === 0;
      const fuehrend = geradeMauer ? true : (si === 0 ? eckeGehoertA : !eckeGehoertA);
      const offset = beideVorhanden && !fuehrend ? tiefe : 0;
      const nutzlaenge = Math.max(0, def.laenge - offset);

      lagen.push({
        index: i,
        quelle: lagenDef.quelle,
        verbandIndex: lagenDef.verbandIndex,
        hoehe: lagenDef.hoehe,
        definition: lagenDef,
        y,
        offset,
        nutzlaenge,
        eckverzahnung: beideVorhanden,
        fuehrend: beideVorhanden ? fuehrend : null,
        steine: fuelleLage({
          lage: lagenDef,
          laenge: nutzlaenge,
          offset,
          katalog,
          fuge: cfg.fuge || 0,
          minStueck: cfg.minStueck ?? 60,
        }),
      });
      y += lagenDef.hoehe + (cfg.lagenfuge || 0);
    });

    const hoehe = hoeheVonLagen(defs, cfg.lagenfuge || 0);
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
