/**
 * Verbandarten (Aufbauschemata).
 *
 * Aufbau eines Verbands
 * ---------------------
 * Ein Verband besteht aus **Bändern** (Lagen), die von unten nach oben
 * wiederholt werden. Jedes Band hat eine feste Höhe (70 oder 140 mm) und
 * besteht aus Elementen:
 *
 *   '40/14'                                    ein Stein über die volle Bandhöhe
 *   { unten: ['20/7','30/7'],                  ein Feld aus zwei übereinander
 *     oben:  ['30/7','20/7'] }                 liegenden Reihen 7-cm-Steine
 *
 * `anfang` wird einmalig am Mauerbeginn (Ecke) verlegt, `muster` wiederholt
 * sich anschließend bis zum freien Ende. Genau dadurch versetzen sich die
 * Stoßfugen von Band zu Band.
 *
 * Datenquelle
 * -----------
 * Die Bänder des Aufbauschemas 6016 sind aus der Zeichnung des EHL-
 * Verlegebeispiels 6016 (CityAntik-Mauer, "Wilder Aufbau mit 4 Formaten",
 * DIY, Maßstab 1:20) übernommen: 8 Bänder (7/14/7/14/7/14/7/14 cm = 84 cm)
 * mit einer Horizontalperiode von 120 cm.
 */

/** Wiederkehrende Felder aus 7-cm-Steinen innerhalb der 14-cm-Bänder. */
const FELD_50 = { unten: ['20/7', '30/7'], oben: ['30/7', '20/7'] };
const FELD_20 = { unten: ['20/7'], oben: ['20/7'] };
const FELD_70 = { unten: ['20/7', '20/7', '30/7'], oben: ['20/7', '30/7', '20/7'] };

/** Muster der 14-cm-Bänder: 40er, 30er und ein 50 cm breites 7-cm-Feld. */
const BAND_14 = ['40/14', '30/14', FELD_50];

export const VERBAENDE = [
  {
    id: '6016',
    name: 'Aufbauschema 6016 (CityAntik)',
    serie: 'ehl-cityantik',
    bauweise: 'Wilder Aufbau mit 4 Formaten',
    quelle: 'EHL Verlegebeispiel 6016 · CityAntik-Mauer · DIY',
    beschreibung:
      'Wilder Aufbau mit vier Formaten: 8 Bänder (7/14/7/14/7/14/7/14 cm = 84 cm) '
      + 'mit 120 cm Horizontalperiode. 14-cm-Bänder mischen 40er und 30er Steine mit '
      + 'Feldern aus je zwei Reihen 7-cm-Steinen.',
    /** Richtwerte des EHL-Datenblatts (Stück je m²). */
    bedarfJeQm: { '40/14': 3.7, '30/14': 4.4, '30/7': 16, '20/7': 19.7 },
    /** Richtwerte des Systemverbands laut Datenblatt (Stück je m²). */
    bedarfSystem: { '40/14': 4, '30/14': 4, '30/7': 15.9, '20/7': 19.9 },
    lagen: [
      { hoehe: 70, anfang: [], muster: ['30/7', '20/7', '20/7', '30/7', '20/7'] },
      { hoehe: 140, anfang: ['40/14', FELD_50], muster: BAND_14 },
      { hoehe: 70, anfang: [], muster: ['30/7', '20/7', '30/7', '20/7', '20/7'] },
      { hoehe: 140, anfang: [FELD_20], muster: BAND_14 },
      { hoehe: 70, anfang: ['30/7', '20/7'], muster: ['30/7', '20/7', '30/7', '20/7', '20/7'] },
      { hoehe: 140, anfang: [FELD_70], muster: BAND_14 },
      { hoehe: 70, anfang: ['30/7'], muster: ['30/7', '20/7', '20/7', '30/7', '20/7'] },
      { hoehe: 140, anfang: [], muster: BAND_14 },
    ],
  },
];

/** Liefert die Band-Definition des Verbands für einen (endlosen) Lagenindex. */
export function verbandLage(verband, index) {
  const lagen = verband.lagen;
  return lagen[((index % lagen.length) + lagen.length) % lagen.length];
}

/** true, wenn das Element ein Feld aus zwei Reihen 7-cm-Steinen ist. */
export function istFeld(element) {
  return Boolean(element) && typeof element === 'object';
}

/** Breite eines Elements in mm (Felder: Summe der unteren Reihe). */
export function elementBreite(element, katalog) {
  if (istFeld(element)) {
    return element.unten.reduce((summe, id) => summe + (katalog[id]?.l || 0), 0);
  }
  return katalog[element]?.l || 0;
}

/**
 * Prüft einen Verband auf Plausibilität.
 * @returns {string[]} Fehlermeldungen (leer = in Ordnung)
 */
export function pruefeVerband(verband, katalog) {
  const fehler = [];
  if (!verband.lagen?.length) {
    fehler.push('Der Verband enthält keine Bänder.');
    return fehler;
  }

  verband.lagen.forEach((lage, i) => {
    const nr = i + 1;
    const elemente = [...(lage.anfang || []), ...(lage.muster || [])];
    if (!lage.muster?.length) {
      fehler.push(`Band ${nr}: kein sich wiederholendes Muster angegeben.`);
    }
    if (![70, 140].includes(lage.hoehe)) {
      fehler.push(`Band ${nr}: Bandhöhe ${lage.hoehe} mm ist nicht zulässig (70 oder 140 mm).`);
    }

    for (const element of elemente) {
      if (istFeld(element)) {
        if (lage.hoehe !== 140) {
          fehler.push(`Band ${nr}: gestapelte Felder sind nur in 14-cm-Bändern möglich.`);
          continue;
        }
        for (const reihe of [element.unten, element.oben]) {
          for (const id of reihe) {
            const stein = katalog[id];
            if (!stein) fehler.push(`Band ${nr}: unbekanntes Format "${id}".`);
            else if (stein.h !== 70) fehler.push(`Band ${nr}: "${id}" passt nicht in ein gestapeltes Feld (nur 7-cm-Formate).`);
          }
        }
        const unten = elementBreite({ unten: element.unten, oben: [] }, katalog);
        const oben = element.oben.reduce((s, id) => s + (katalog[id]?.l || 0), 0);
        if (unten !== oben) {
          fehler.push(`Band ${nr}: Feld ist unten ${unten / 10} cm und oben ${oben / 10} cm breit – beide Reihen müssen gleich breit sein.`);
        }
      } else {
        const stein = katalog[element];
        if (!stein) fehler.push(`Band ${nr}: unbekanntes Format "${element}".`);
        else if (stein.h !== lage.hoehe) {
          fehler.push(`Band ${nr}: "${element}" ist ${stein.h / 10} cm hoch, das Band ${lage.hoehe / 10} cm.`);
        }
      }
    }
  });

  return fehler;
}

/* ------------------------------------------------- Textform für den Editor */

/**
 * Wandelt eine Elementfolge in Text um, z. B.
 * `40/14 30/14 [20/7 30/7 | 30/7 20/7]`.
 */
export function elementeAlsText(elemente) {
  return (elemente || [])
    .map((element) => (istFeld(element)
      ? `[${element.unten.join(' ')} | ${element.oben.join(' ')}]`
      : element))
    .join(' ');
}

/**
 * Liest die Textform wieder ein. Unbekannte Formate bleiben erhalten und
 * werden von `pruefeVerband` gemeldet.
 * @throws {Error} bei fehlerhafter Klammerung
 */
export function elementeAusText(text) {
  const elemente = [];
  const tokens = String(text || '').match(/\[[^\]]*\]?|[^\s]+/g) || [];

  for (const token of tokens) {
    if (!token.startsWith('[')) {
      elemente.push(token);
      continue;
    }
    if (!token.endsWith(']')) throw new Error(`Fehlende schließende Klammer bei "${token}".`);
    const inhalt = token.slice(1, -1);
    const teile = inhalt.split('|');
    if (teile.length !== 2) {
      throw new Error('Ein gestapeltes Feld braucht genau ein "|" zwischen unterer und oberer Reihe.');
    }
    const unten = teile[0].trim().split(/\s+/).filter(Boolean);
    const oben = teile[1].trim().split(/\s+/).filter(Boolean);
    if (!unten.length || !oben.length) throw new Error('Ein gestapeltes Feld darf keine leere Reihe haben.');
    elemente.push({ unten, oben });
  }
  return elemente;
}
