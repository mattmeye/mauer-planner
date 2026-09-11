/**
 * Verbandarten (Verlegearten) als Vorlagen.
 *
 * Ein Verband ist eine sich wiederholende Folge von Lagen; jede Lage ist eine
 * sich wiederholende Folge von Steinformaten. Beim Fuellen einer Lage wird die
 * Steinfolge zyklisch wiederholt, bis die Schenkellaenge erreicht ist.
 *
 * WICHTIG / Datenherkunft:
 * Die Lagenfolge der EHL-Verlegeart 6016 ist hier als Vorlage hinterlegt.
 * Sie laesst sich im Verband-Editor der Anwendung jederzeit anpassen und als
 * eigener Verband speichern (siehe README, Abschnitt "Verbandarten").
 */

export const VERBAENDE = [
  {
    id: '6016',
    name: 'Verlegeart 6016',
    serie: 'ehl-antik',
    beschreibung:
      'Vierlagiger Antik-Verband aus den Formaten XXL/XL/L (Lagenhöhe 14 cm). '
      + 'Die Steinfolge wechselt je Lage, dadurch versetzen sich die Stoßfugen.',
    lagen: [
      { steine: ['XXL', 'XL', 'L', 'XL', 'XXL'] },
      { steine: ['XL', 'L', 'XXL', 'XXL', 'XL'] },
      { steine: ['L', 'XXL', 'XL', 'XXL', 'L'] },
      { steine: ['XXL', 'XXL', 'L', 'XL', 'L'] },
    ],
  },
];

/** Liefert die Lagen-Definition des Verbands fuer einen (endlosen) Lagenindex. */
export function verbandLage(verband, index) {
  const lagen = verband.lagen;
  const i = ((index % lagen.length) + lagen.length) % lagen.length;
  return lagen[i];
}

/**
 * Prueft einen Verband auf Plausibilitaet.
 * Gibt eine Liste von Fehlermeldungen zurueck (leer = in Ordnung).
 */
export function pruefeVerband(verband, katalog) {
  const fehler = [];
  if (!verband.lagen || verband.lagen.length === 0) {
    fehler.push('Der Verband enthält keine Lagen.');
    return fehler;
  }
  verband.lagen.forEach((lage, i) => {
    if (!lage.steine || lage.steine.length === 0) {
      fehler.push(`Lage ${i + 1} enthält keine Steine.`);
      return;
    }
    const hoehen = new Set();
    for (const id of lage.steine) {
      const stein = katalog[id];
      if (!stein) {
        fehler.push(`Lage ${i + 1}: unbekanntes Format "${id}".`);
        continue;
      }
      hoehen.add(stein.h);
    }
    if (hoehen.size > 1) {
      fehler.push(
        `Lage ${i + 1}: Formate mit unterschiedlicher Höhe (${[...hoehen].join('/')} mm) `
        + 'können nicht in einer Lage verlegt werden.',
      );
    }
  });
  return fehler;
}
