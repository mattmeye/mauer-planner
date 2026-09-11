/**
 * Steinkatalog der EHL Antik-Serie.
 *
 * Alle Maße in Millimetern (intern wird durchgaengig in mm gerechnet).
 *   l = Laenge (Ansichtslaenge), d = Tiefe (Mauerdicke), h = Hoehe der Lage
 *
 * Die Formate entsprechen der handelsueblichen Staffelung der EHL
 * Antik-/TimesAntik-Mauersteine (20/30/40 cm Laenge, 20 cm Tiefe,
 * 7 bzw. 14 cm Hoehe). Der Katalog ist bewusst als Daten gehalten:
 * weitere Formate koennen hier ergaenzt werden, ohne Code zu aendern.
 */

/** Rechnerische Rohdichte von Vorsatzbeton in kg/m3 (fuer Gewichtsschaetzung). */
export const BETON_DICHTE = 2350;

export const STEINE = [
  { id: 'S',   name: 'Antik S',   l: 200, d: 200, h:  70 },
  { id: 'M',   name: 'Antik M',   l: 300, d: 200, h:  70 },
  { id: 'L',   name: 'Antik L',   l: 200, d: 200, h: 140 },
  { id: 'XL',  name: 'Antik XL',  l: 300, d: 200, h: 140 },
  { id: 'XXL', name: 'Antik XXL', l: 400, d: 200, h: 140 },
];

export const SERIE = {
  id: 'ehl-antik',
  name: 'EHL Antik-Mauer',
  tiefe: 200,
  steine: STEINE,
};

/** Katalog als Map {id: stein} fuer schnellen Zugriff. */
export function steinMap(steine = STEINE) {
  const map = Object.create(null);
  for (const s of steine) map[s.id] = s;
  return map;
}

/** Geschaetztes Gewicht eines Steins in kg. */
export function gewichtKg(stein, dichte = BETON_DICHTE) {
  const volumenM3 = (stein.l / 1000) * (stein.d / 1000) * (stein.h / 1000);
  return volumenM3 * dichte;
}
