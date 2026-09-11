/**
 * Steinkatalog der EHL CityAntik-Mauer.
 *
 * Quelle: EHL Aufbauschema Nr. 6016 ("Wilder Aufbau mit 4 Formaten", DIY).
 * Das Schema verwendet genau vier Formate, hier in der Nummerierung des
 * Datenblatts (Stein 1 bis Stein 4).
 *
 * Alle Maße in Millimetern (intern wird durchgängig in mm gerechnet):
 *   l = Länge (Ansichtslänge), d = Tiefe (Mauerdicke), h = Höhe
 */

/** Rechnerische Rohdichte von Vorsatzbeton in kg/m³ (für Gewichtsschätzung). */
export const BETON_DICHTE = 2350;

export const STEINE = [
  { id: '40/14', nr: 1, name: 'Stein 1', l: 400, d: 200, h: 140 },
  { id: '30/14', nr: 2, name: 'Stein 2', l: 300, d: 200, h: 140 },
  { id: '30/7', nr: 3, name: 'Stein 3', l: 300, d: 200, h: 70 },
  { id: '20/7', nr: 4, name: 'Stein 4', l: 200, d: 200, h: 70 },
];

export const SERIE = {
  id: 'ehl-cityantik',
  name: 'EHL CityAntik-Mauer',
  tiefe: 200,
  steine: STEINE,
};

/** Katalog als Map {id: stein} für schnellen Zugriff. */
export function steinMap(steine = STEINE) {
  const map = Object.create(null);
  for (const s of steine) map[s.id] = s;
  return map;
}

/** Geschätztes Gewicht eines Steins in kg. */
export function gewichtKg(stein, dichte = BETON_DICHTE) {
  return (stein.l / 1000) * (stein.d / 1000) * (stein.h / 1000) * dichte;
}

/** Kurzbezeichnung für Zeichnung und Tabellen, z. B. "40 x 20 x 14 cm". */
export function formatText(stein) {
  return `${stein.l / 10} x ${stein.d / 10} x ${stein.h / 10} cm`;
}
