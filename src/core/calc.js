/**
 * Kalkulation: Schnittliste, Reststueckverwertung und Steinbedarf.
 *
 * Alle Laengen in mm. Grundlage ist das Ergebnis von `baueMauer`.
 */

import { gewichtKg } from '../data/catalog.js';

/**
 * @param {object} mauer   Ergebnis von baueMauer()
 * @param {object} katalog Steinkatalog als Map
 * @param {object} cfg     Konfiguration (restnutzung, minRest, saegeblatt, verschnitt)
 */
export function kalkuliere(mauer, katalog, cfg) {
  const restnutzung = cfg.restnutzung !== false;
  const minRest = cfg.minRest ?? 100;
  const saegeblatt = cfg.saegeblatt ?? 0;

  /** @type {Array<{steinId:string,laenge:number,h:number,d:number,herkunft:string}>} */
  const restPool = [];
  const schnitte = [];
  const bedarf = Object.create(null);

  const bedarfEintrag = (id) => {
    if (!bedarf[id]) {
      bedarf[id] = { steinId: id, ganz: 0, zuschnitte: 0, ausRest: 0, verbrauch: 0 };
    }
    return bedarf[id];
  };

  const schenkelStats = mauer.schenkel.map((s) => ({
    name: s.name,
    laenge: s.laenge,
    hoehe: s.hoehe,
    lagen: s.lagenAnzahl,
    steine: 0,
    schnitte: 0,
    flaeche: (s.laenge / 1000) * (s.hoehe / 1000),
  }));

  mauer.schenkel.forEach((schenkel, si) => {
    schenkel.lagen.forEach((lage) => {
      lage.steine.forEach((stein) => {
        const format = katalog[stein.steinId];
        if (!format) return;
        const eintrag = bedarfEintrag(stein.steinId);
        schenkelStats[si].steine += 1;

        if (!stein.zuschnitt) {
          eintrag.ganz += 1;
          eintrag.verbrauch += 1;
          return;
        }

        eintrag.zuschnitte += 1;
        schenkelStats[si].schnitte += 1;

        const rest = restnutzung ? findeRest(restPool, stein.l, format) : -1;
        let herkunft = 'neu';
        let quelleLaenge = format.l;

        if (rest >= 0) {
          const stueck = restPool.splice(rest, 1)[0];
          herkunft = 'rest';
          quelleLaenge = stueck.laenge;
          eintrag.ausRest += 1;
          const uebrig = stueck.laenge - stein.l - saegeblatt;
          if (uebrig >= minRest) {
            restPool.push({ ...stueck, laenge: uebrig });
          }
        } else {
          eintrag.verbrauch += 1;
          const uebrig = format.l - stein.l - saegeblatt;
          if (restnutzung && uebrig >= minRest) {
            restPool.push({
              steinId: format.id,
              laenge: uebrig,
              h: format.h,
              d: format.d,
              herkunft: `${schenkel.name}, Lage ${lage.index + 1}`,
            });
          }
        }

        schnitte.push({
          schenkel: schenkel.name,
          schenkelIndex: si,
          lage: lage.index + 1,
          steinId: stein.steinId,
          laenge: stein.l,
          ausgangslaenge: quelleLaenge,
          herkunft,
          x: stein.x,
        });
      });
    });
  });

  const positionen = Object.values(bedarf)
    .map((e) => {
      const format = katalog[e.steinId];
      const zuschlag = Math.ceil(e.verbrauch * (1 + (cfg.verschnitt ?? 0) / 100));
      return {
        ...e,
        name: format.name,
        format: `${format.l / 10} x ${format.d / 10} x ${format.h / 10} cm`,
        bestellmenge: zuschlag,
        gewicht: gewichtKg(format) * e.verbrauch,
      };
    })
    .sort((a, b) => a.steinId.localeCompare(b.steinId));

  const flaeche = schenkelStats.reduce((s, x) => s + x.flaeche, 0);
  const laufmeter = mauer.schenkel.reduce((s, x) => s + x.laenge / 1000, 0);

  return {
    schenkel: schenkelStats,
    positionen,
    schnitte,
    reste: restPool.slice().sort((a, b) => b.laenge - a.laenge),
    summe: {
      steine: positionen.reduce((s, p) => s + p.ganz + p.zuschnitte, 0),
      verbrauch: positionen.reduce((s, p) => s + p.verbrauch, 0),
      bestellmenge: positionen.reduce((s, p) => s + p.bestellmenge, 0),
      schnitte: schnitte.length,
      ausRest: schnitte.filter((s) => s.herkunft === 'rest').length,
      gewicht: positionen.reduce((s, p) => s + p.gewicht, 0),
      flaeche,
      laufmeter,
    },
  };
}

/**
 * Sucht im Restpool das kleinste passende Stueck (Best-Fit) mit gleicher
 * Lagenhoehe und Tiefe. Gibt den Index zurueck oder -1.
 */
function findeRest(pool, benoetigt, format) {
  let best = -1;
  let bestLaenge = Infinity;
  for (let i = 0; i < pool.length; i++) {
    const stueck = pool[i];
    if (stueck.h !== format.h || stueck.d !== format.d) continue;
    if (stueck.laenge + 0.5 < benoetigt) continue;
    if (stueck.laenge < bestLaenge) {
      best = i;
      bestLaenge = stueck.laenge;
    }
  }
  return best;
}

/** Gruppiert die Schnittliste nach Format und Laenge (fuer die Druckausgabe). */
export function schnittUebersicht(schnitte) {
  const map = new Map();
  for (const s of schnitte) {
    const key = `${s.steinId}|${Math.round(s.laenge)}`;
    const eintrag = map.get(key) || {
      steinId: s.steinId,
      laenge: Math.round(s.laenge),
      anzahl: 0,
      ausRest: 0,
    };
    eintrag.anzahl += 1;
    if (s.herkunft === 'rest') eintrag.ausRest += 1;
    map.set(key, eintrag);
  }
  return [...map.values()].sort(
    (a, b) => a.steinId.localeCompare(b.steinId) || b.laenge - a.laenge,
  );
}
