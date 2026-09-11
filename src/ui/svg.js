/**
 * Zeichnet den Mauerplan als SVG (Ansicht je Schenkel + Draufsicht).
 *
 * Das SVG rechnet direkt in Millimetern: die viewBox entspricht dem Bauteil,
 * Strichstaerken bleiben ueber `vector-effect="non-scaling-stroke"` konstant.
 * Dadurch ist die Zeichnung in jeder Groesse und im Ausdruck massstabsgerecht.
 */

/** Fuellfarben je Steinformat (hell genug fuer Beschriftung und Graustufendruck). */
const FARBEN = {
  '40/14': '#bb9c70',
  '30/14': '#cfb58d',
  '30/7': '#e2cda9',
  '20/7': '#f2e5cd',
};
const FARBE_FALLBACK = '#e3d5bd';
const FARBE_SCHNITT = '#f0cfc6';

let lfdNummer = 0;

export function esc(text) {
  return String(text ?? '').replace(/[&<>"']/g, (z) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[z]
  ));
}

/** Millimeter als Zentimeterangabe fuer die Beschriftung. */
export function cm(wert, stellen = 1) {
  return `${(wert / 10).toFixed(stellen).replace('.', ',')} cm`;
}

function hatchDef(id) {
  return `<defs><pattern id="${id}" width="60" height="60" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
      <rect width="60" height="60" fill="${FARBE_SCHNITT}"/>
      <line x1="0" y1="0" x2="0" y2="60" stroke="#b4543f" stroke-width="8" opacity="0.55"/>
    </pattern></defs>`;
}

/**
 * Ansicht eines Schenkels.
 * @param {object} schenkel Ergebnis-Schenkel aus baueMauer()
 * @param {object} opts {form, tiefe, katalog, titel}
 */
export function zeichneAnsicht(schenkel, opts = {}) {
  const { form = 'gerade', katalog = {} } = opts;
  const id = `hatch-${(lfdNummer += 1)}`;
  const padL = 540;
  const padR = 200;
  const padO = 260;
  const padU = 340;
  const breite = schenkel.laenge + padL + padR;
  const hoehe = Math.max(schenkel.hoehe, 140) + padO + padU;
  const boden = padO + schenkel.hoehe;
  const x0 = padL;

  const teile = [];
  teile.push(hatchDef(id));

  // Erdreich / Auflager
  teile.push(`<line x1="${x0 - 260}" y1="${boden}" x2="${x0 + schenkel.laenge + 120}" y2="${boden}"
    stroke="#3c3227" stroke-width="2.5" vector-effect="non-scaling-stroke"/>`);

  for (const lage of schenkel.lagen) {
    const y = padO + (schenkel.hoehe - lage.y - lage.hoehe);

    for (const stein of lage.steine) {
      // dy = Höhe über der Bandunterkante (7-cm-Steine in einem 14-cm-Band)
      const sy = padO + (schenkel.hoehe - lage.y - (stein.dy || 0) - stein.h);
      const farbe = stein.zuschnitt ? `url(#${id})` : (FARBEN[stein.steinId] || FARBE_FALLBACK);
      teile.push(`<rect x="${x0 + stein.x}" y="${sy}" width="${stein.l}" height="${stein.h}"
        fill="${farbe}" stroke="#4a4034" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`);
      teile.push(...beschriftung(stein, x0, sy));
    }

    // Lagenbeschriftung links: Nummer (mit Marke fuer Sonderlagen) und Oberkante
    const marke = lage.quelle === 'unten' ? ' \u25b2' : lage.quelle === 'oben' ? ' \u25bc' : '';
    const mitteY = y + lage.hoehe / 2 + 18;
    teile.push(`<text x="${x0 - 80}" y="${mitteY}" text-anchor="end"
      font-size="50" fill="#5b5044">B${lage.index + 1}${marke}</text>`);
    teile.push(`<text x="${x0 - 230}" y="${mitteY}" text-anchor="end"
      font-size="40" fill="#8a7f70">${((lage.y + lage.hoehe) / 10).toFixed(1).replace('.', ',')}</text>`);

    if (lage.offset > 0) {
      // Ecke: in dieser Lage laeuft der andere Schenkel durch
      teile.push(`<rect x="${x0}" y="${y}" width="${lage.offset}" height="${lage.hoehe}"
        fill="#ece5da" stroke="#b3a48d" stroke-width="1" stroke-dasharray="16 10"
        vector-effect="non-scaling-stroke"/>`);
      teile.push(`<text x="${x0 + lage.offset / 2}" y="${y + lage.hoehe / 2 + 14}" text-anchor="middle"
        font-size="40" fill="#9a8b74">${esc(opts.partnerKurz || '\u2192')}</text>`);
    }
  }

  // Spaltenkoepfe der Lagenbeschriftung
  teile.push(`<text x="${x0 - 80}" y="${padO - 80}" text-anchor="end" font-size="40"
    fill="#a2978a">Band</text>`);
  teile.push(`<text x="${x0 - 230}" y="${padO - 80}" text-anchor="end" font-size="40"
    fill="#a2978a">OK cm</text>`);

  // Hoehenmass links
  teile.push(masslinieVertikal(x0 - 420, padO, boden, cm(schenkel.hoehe, 1)));
  // Laengenmass unten
  teile.push(masslinieHorizontal(x0, x0 + schenkel.laenge, boden + 190, cm(schenkel.laenge, 1)));

  // Enden kennzeichnen
  if (form === 'ecke') {
    teile.push(`<line x1="${x0}" y1="${padO - 150}" x2="${x0}" y2="${boden + 40}"
      stroke="#b4543f" stroke-width="1.4" stroke-dasharray="26 16" vector-effect="non-scaling-stroke"/>`);
    teile.push(`<text x="${x0 + 30}" y="${padO - 90}" font-size="52" fill="#b4543f">Ecke (Außenkante)</text>`);
  }
  teile.push(`<text x="${x0 + schenkel.laenge}" y="${padO - 90}" font-size="48" fill="#8a7f70"
    text-anchor="end">freies Ende</text>`);

  const titel = opts.titel
    ? `<text x="${x0 - 330}" y="90" font-size="64" font-weight="600" fill="#33291d">${esc(opts.titel)}</text>`
    : '';

  return `<svg viewBox="0 0 ${breite} ${hoehe}" class="plan-svg" role="img"
    aria-label="Ansicht ${esc(schenkel.name)}" xmlns="http://www.w3.org/2000/svg">
    ${titel}${teile.join('\n')}
  </svg>`;
}

/** Schriftgroesse, die einen Text sicher in die verfuegbare Breite legt. */
function passendeSchrift(text, platz, max, min) {
  return Math.max(min, Math.min(max, (platz - 24) / (text.length * 0.58)));
}

function beschriftung(stein, x0, y) {
  const out = [];
  const mitteX = x0 + stein.x + stein.l / 2;
  const mitteY = y + stein.h / 2;
  const klein = stein.h < 100;

  if (stein.zuschnitt) {
    const text = (stein.l / 10).toFixed(1).replace('.', ',');
    const quer = passendeSchrift(text, stein.l, klein ? 40 : 46, 0);

    if (quer >= 22) {
      out.push(`<text x="${mitteX}" y="${mitteY + (klein ? 14 : 6)}" text-anchor="middle"
        font-size="${quer}" font-weight="600" fill="#8c3a28">${text}</text>`);
      if (!klein && stein.l >= 240) {
        out.push(`<text x="${mitteX}" y="${mitteY + 58}" text-anchor="middle"
          font-size="${Math.min(36, quer * 0.8)}" fill="#8c3a28">aus ${esc(stein.steinId)}</text>`);
      }
    } else {
      // Schmales Passstueck: Mass hochkant eintragen
      const hoch = passendeSchrift(text, stein.h, 38, 16);
      out.push(`<text x="${mitteX}" y="${mitteY}" text-anchor="middle" font-size="${hoch}"
        font-weight="600" fill="#8c3a28" transform="rotate(-90 ${mitteX} ${mitteY})">${text}</text>`);
    }
    return out;
  }

  if (stein.l < 130) return out;
  const label = String(stein.l / 10);
  out.push(`<text x="${mitteX}" y="${mitteY + (klein ? 12 : 16)}" text-anchor="middle"
    font-size="${klein ? 38 : 46}" fill="#4a4034">${label}</text>`);
  return out;
}

function masslinieHorizontal(x1, x2, y, text) {
  return `<g stroke="#5b5044" stroke-width="1.1" vector-effect="non-scaling-stroke">
    <line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}"/>
    <line x1="${x1}" y1="${y - 45}" x2="${x1}" y2="${y + 45}"/>
    <line x1="${x2}" y1="${y - 45}" x2="${x2}" y2="${y + 45}"/>
  </g>
  <text x="${(x1 + x2) / 2}" y="${y - 30}" text-anchor="middle" font-size="56" fill="#33291d">${text}</text>`;
}

function masslinieVertikal(x, y1, y2, text) {
  return `<g stroke="#5b5044" stroke-width="1.1" vector-effect="non-scaling-stroke">
    <line x1="${x}" y1="${y1}" x2="${x}" y2="${y2}"/>
    <line x1="${x - 45}" y1="${y1}" x2="${x + 45}" y2="${y1}"/>
    <line x1="${x - 45}" y1="${y2}" x2="${x + 45}" y2="${y2}"/>
  </g>
  <text x="${x - 30}" y="${(y1 + y2) / 2}" text-anchor="middle" font-size="56" fill="#33291d"
    transform="rotate(-90 ${x - 30} ${(y1 + y2) / 2})">${text}</text>`;
}

/** Draufsicht der Mauer (L-Form bzw. gerader Riegel). */
export function zeichneDraufsicht(mauer) {
  const d = mauer.tiefe;
  const a = mauer.schenkel[0];
  const b = mauer.schenkel[1];
  const pad = 520;
  const la = a.laenge;
  const lb = b ? b.laenge : d;

  const breite = la + pad * 2;
  const hoehe = (b ? lb : d) + pad * 2;
  const ox = pad;
  const oy = pad;

  const form = b
    ? `M ${ox} ${oy} L ${ox + la} ${oy} L ${ox + la} ${oy + d} L ${ox + d} ${oy + d}
       L ${ox + d} ${oy + lb} L ${ox} ${oy + lb} Z`
    : `M ${ox} ${oy} L ${ox + la} ${oy} L ${ox + la} ${oy + d} L ${ox} ${oy + d} Z`;

  const teile = [`<path d="${form}" fill="#e3d5bd" stroke="#4a4034" stroke-width="1.6"
    vector-effect="non-scaling-stroke"/>`];

  teile.push(masslinieHorizontal(ox, ox + la, oy - 200, cm(la, 1)));
  teile.push(`<text x="${ox + la / 2}" y="${oy + d / 2 + 20}" text-anchor="middle" font-size="60"
    fill="#33291d">${esc(a.name)}</text>`);

  if (b) {
    teile.push(masslinieVertikal(ox - 200, oy, oy + lb, cm(lb, 1)));
    const ty = oy + d + (lb - d) / 2;
    teile.push(`<text x="${ox + d / 2}" y="${ty}" text-anchor="middle" font-size="60" fill="#33291d"
      transform="rotate(-90 ${ox + d / 2} ${ty})">${esc(b.name)}</text>`);
    // 90-Grad-Winkelmarke
    teile.push(`<path d="M ${ox + 260} ${oy} L ${ox + 260} ${oy + 260} L ${ox} ${oy + 260}"
      fill="none" stroke="#b4543f" stroke-width="1.2" vector-effect="non-scaling-stroke"/>`);
    teile.push(`<text x="${ox + 300} " y="${oy + 210}" font-size="52" fill="#b4543f">90&#176;</text>`);
  }

  // Mauerdicke
  teile.push(masslinieVertikal(ox + la + 200, oy, oy + d, cm(d, 1)));

  return `<svg viewBox="0 0 ${breite} ${hoehe}" class="plan-svg plan-svg--draufsicht" role="img"
    aria-label="Draufsicht" xmlns="http://www.w3.org/2000/svg">${teile.join('\n')}</svg>`;
}

/** Kleine Farblegende der verwendeten Formate. */
export function legende(positionen, katalog) {
  const eintraege = positionen.map((p) => {
    const stein = katalog[p.steinId];
    return `<li><span class="swatch" style="background:${FARBEN[p.steinId] || FARBE_FALLBACK}"></span>
      <strong>${esc(stein.name)}</strong> ${stein.l / 10} &times; ${stein.d / 10} &times; ${stein.h / 10} cm</li>`;
  });
  eintraege.push('<li><span class="swatch swatch--schnitt"></span> Zuschnitt (Zahl = fertige L&auml;nge in cm)</li>');
  eintraege.push('<li>Zahlen in den Steinen = Ansichtsl&auml;nge in cm</li>');
  return `<ul class="legende">${eintraege.join('')}</ul>`;
}
