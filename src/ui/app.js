/**
 * Bedienoberflaeche des Mauer-Konfigurators.
 *
 * Haelt die Konfiguration im Zustand `state`, rechnet bei jeder Aenderung das
 * komplette Modell neu durch (Geometrie -> Kalkulation -> Darstellung) und
 * sichert den Entwurf im Browser-Speicher.
 */

import { STEINE, steinMap } from '../data/catalog.js';
import { VERBAENDE, pruefeVerband } from '../data/patterns.js';
import { standardKonfig, baueMauer } from '../core/wall.js';
import { kalkuliere, schnittUebersicht } from '../core/calc.js';
import { zeichneAnsicht, zeichneDraufsicht, legende, esc, cm } from './svg.js';
import * as store from '../store.js';

const katalog = steinMap();
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

const state = {
  konfig: standardKonfig(),
  planId: null,
};

/* ------------------------------------------------------------------ Hilfen */

function zahl(el, fallback = 0) {
  const wert = parseFloat(String(el.value).replace(',', '.'));
  return Number.isFinite(wert) ? wert : fallback;
}

/** cm-Eingabe -> mm */
const zuMm = (wert) => Math.round(wert * 10);
/** mm -> cm-Anzeige */
const zuCm = (wert) => Math.round(wert) / 10;

function zahlFmt(wert, stellen = 0) {
  return wert.toLocaleString('de-DE', {
    minimumFractionDigits: stellen,
    maximumFractionDigits: stellen,
  });
}

function zeigeHinweis(text, art = 'info') {
  const box = $('#hinweis');
  box.textContent = text;
  box.dataset.art = art;
  box.hidden = false;
  clearTimeout(zeigeHinweis.timer);
  zeigeHinweis.timer = setTimeout(() => { box.hidden = true; }, 4000);
}

/** Ergaenzt fehlende Felder aelterer bzw. importierter Plaene. */
function migriere(konfig) {
  const basis = standardKonfig();
  const k = { ...basis, ...konfig };
  k.schenkel = [0, 1].map((i) => ({ ...basis.schenkel[i], ...(konfig.schenkel?.[i] || {}) }));
  k.abschluss = {
    unten: { ...basis.abschluss.unten, ...(konfig.abschluss?.unten || {}) },
    oben: { ...basis.abschluss.oben, ...(konfig.abschluss?.oben || {}) },
  };
  return k;
}

/** Alle Verbandvorlagen (mitgeliefert + eigene). */
function alleVerbaende() {
  return [...VERBAENDE, ...store.eigeneVerbaende()];
}

/** Der aktuell wirksame Verband - ggf. die im Plan abgelegte Abwandlung. */
function aktiverVerband() {
  if (state.konfig.verband) return state.konfig.verband;
  const gefunden = alleVerbaende().find((v) => v.id === state.konfig.verbandId);
  return gefunden || VERBAENDE[0];
}

/* ------------------------------------------------- Formular <-> Konfiguration */

function fuelleAuswahlfelder() {
  const optionen = STEINE
    .map((s) => `<option value="${s.id}">${esc(s.id)} &ndash; ${esc(s.name)} (${s.l / 10}&times;${s.d / 10}&times;${s.h / 10} cm)</option>`)
    .join('');
  $$('[data-abschluss] [data-feld="stein"]').forEach((sel) => { sel.innerHTML = optionen; });
}

function fuelleVerbandSelect() {
  const sel = $('#verbandId');
  sel.innerHTML = alleVerbaende()
    .map((v) => `<option value="${esc(v.id)}">${esc(v.name)}${v.eigen ? ' (eigen)' : ''}</option>`)
    .join('');
  sel.value = state.konfig.verbandId;
  if (!sel.value) sel.value = VERBAENDE[0].id;
}

function fuellePlanListe() {
  const sel = $('#planListe');
  const plaene = store.listePlaene();
  sel.innerHTML = plaene.length
    ? plaene.map((p) => `<option value="${esc(p.id)}">${esc(p.name)} &middot; ${new Date(p.geaendert).toLocaleDateString('de-DE')}</option>`).join('')
    : '<option value="">&ndash; keine gespeicherten Pl&auml;ne &ndash;</option>';
  if (state.planId && plaene.some((p) => p.id === state.planId)) sel.value = state.planId;
}

function formularAusKonfig() {
  const k = state.konfig;
  $('#planName').value = k.name;
  $('#form').value = k.form;
  $('#verbandId').value = alleVerbaende().some((v) => v.id === k.verbandId) ? k.verbandId : VERBAENDE[0].id;
  $('#startLage').value = k.startLage;
  $('#fuge').value = k.fuge;
  $('#lagenfuge').value = k.lagenfuge;
  $('#minStueck').value = k.minStueck;
  $('#saegeblatt').value = k.saegeblatt;
  $('#restnutzung').checked = k.restnutzung !== false;
  $('#minRest').value = k.minRest;
  $('#verschnitt').value = k.verschnitt;

  $$('.schenkel').forEach((box, i) => {
    const s = k.schenkel[i];
    $('[data-feld="name"]', box).value = s.name;
    $('[data-feld="laenge"]', box).value = zuCm(s.laenge);
    $('[data-feld="modus"]', box).value = s.modus;
    $('[data-rolle="wertLabel"]', box).textContent = s.modus === 'lagen' ? 'Lagenzahl' : 'Zielhöhe (cm)';
    $('[data-feld="wert"]', box).value = s.modus === 'lagen' ? s.lagen : zuCm(s.zielHoehe);
    $('[data-feld="wert"]', box).step = s.modus === 'lagen' ? '1' : '0.5';
  });

  $$('[data-abschluss]').forEach((box) => {
    const def = k.abschluss[box.dataset.abschluss];
    $('[data-feld="modus"]', box).value = def.modus;
    const steinSel = $('[data-feld="stein"]', box);
    steinSel.value = def.steine?.[0] || 'XXL';
    steinSel.disabled = def.modus === 'verband';
  });

  $('.schenkel[data-schenkel="1"]').hidden = k.form !== 'ecke';
  $('#verbandBeschreibung').textContent = aktiverVerband().beschreibung || '';
}

function konfigAusFormular() {
  const k = state.konfig;
  k.name = $('#planName').value.trim() || 'Mauerplan';
  k.form = $('#form').value;
  k.verbandId = $('#verbandId').value;
  k.startLage = Math.max(0, Math.round(zahl($('#startLage'))));
  k.fuge = Math.max(0, Math.round(zahl($('#fuge'))));
  k.lagenfuge = Math.max(0, Math.round(zahl($('#lagenfuge'))));
  k.minStueck = Math.max(0, Math.round(zahl($('#minStueck'), 60)));
  k.saegeblatt = Math.max(0, Math.round(zahl($('#saegeblatt'))));
  k.restnutzung = $('#restnutzung').checked;
  k.minRest = Math.max(0, Math.round(zahl($('#minRest'), 100)));
  k.verschnitt = Math.max(0, zahl($('#verschnitt')));

  $$('.schenkel').forEach((box, i) => {
    const s = k.schenkel[i];
    s.name = $('[data-feld="name"]', box).value.trim() || `Schenkel ${String.fromCharCode(65 + i)}`;
    s.laenge = Math.max(100, zuMm(zahl($('[data-feld="laenge"]', box), 100)));
    s.modus = $('[data-feld="modus"]', box).value;
    const wert = zahl($('[data-feld="wert"]', box), 1);
    if (s.modus === 'lagen') s.lagen = Math.min(60, Math.max(1, Math.round(wert)));
    else s.zielHoehe = Math.max(10, zuMm(wert));
  });

  $$('[data-abschluss]').forEach((box) => {
    const def = k.abschluss[box.dataset.abschluss];
    def.modus = $('[data-feld="modus"]', box).value;
    def.steine = [$('[data-feld="stein"]', box).value];
  });
}

/* ------------------------------------------------------------ Verband-Editor */

function renderVerbandEditor() {
  const box = $('#verbandEditor');
  if (box.hidden) return;
  const verband = aktiverVerband();
  const eigen = Boolean(store.eigeneVerbaende().find((v) => v.id === state.konfig.verbandId));

  box.innerHTML = `
    <label class="feld feld--breit">
      <span>Name des Verbands</span>
      <input type="text" id="verbandName" value="${esc(verband.name)}" maxlength="60">
    </label>
    <ol class="lagen-editor">
      ${verband.lagen.map((lage, i) => `
        <li>
          <span class="lagen-nr">Lage ${i + 1}</span>
          <input type="text" data-lage="${i}" value="${esc(lage.steine.join(' '))}"
                 aria-label="Steinfolge Lage ${i + 1}">
          <button type="button" class="leise" data-aktion="entfernen" data-lage="${i}"
                  title="Lage entfernen">&times;</button>
        </li>`).join('')}
    </ol>
    <p class="beschreibung">
      Formate durch Leerzeichen trennen (${STEINE.map((s) => s.id).join(', ')}).
      Die Folge wird je Lage so lange wiederholt, bis die Schenkell&auml;nge erreicht ist.
      Innerhalb einer Lage m&uuml;ssen alle Formate dieselbe H&ouml;he haben.
    </p>
    <div class="editor-aktionen">
      <button type="button" data-aktion="hinzufuegen">+ Lage</button>
      <button type="button" data-aktion="speichern" class="primaer">Als eigenen Verband speichern</button>
      <button type="button" data-aktion="zuruecksetzen">Auf Vorlage zur&uuml;cksetzen</button>
      ${eigen ? '<button type="button" data-aktion="loeschen">Eigenen Verband l&ouml;schen</button>' : ''}
    </div>`;
}

/** Arbeitskopie des Verbands im Plan anlegen (sobald bearbeitet wird). */
function verbandKopie() {
  if (!state.konfig.verband) {
    state.konfig.verband = JSON.parse(JSON.stringify(aktiverVerband()));
    delete state.konfig.verband.eigen;
  }
  return state.konfig.verband;
}

function bindeEditor() {
  const box = $('#verbandEditor');

  box.addEventListener('input', (ev) => {
    const ziel = ev.target;
    if (ziel.id === 'verbandName') {
      verbandKopie().name = ziel.value;
      return;
    }
    if (ziel.dataset.lage !== undefined) {
      const verband = verbandKopie();
      const index = Number(ziel.dataset.lage);
      verband.lagen[index] = {
        steine: ziel.value.toUpperCase().split(/[\s,;]+/).filter(Boolean),
      };
      rendere();
    }
  });

  box.addEventListener('click', (ev) => {
    const knopf = ev.target.closest('button[data-aktion]');
    if (!knopf) return;
    const verband = verbandKopie();

    switch (knopf.dataset.aktion) {
      case 'hinzufuegen':
        verband.lagen.push({ steine: ['XXL', 'XL', 'L'] });
        break;
      case 'entfernen':
        if (verband.lagen.length <= 1) {
          zeigeHinweis('Ein Verband braucht mindestens eine Lage.', 'warnung');
          return;
        }
        verband.lagen.splice(Number(knopf.dataset.lage), 1);
        break;
      case 'zuruecksetzen':
        delete state.konfig.verband;
        break;
      case 'speichern': {
        const fehler = pruefeVerband(verband, katalog);
        if (fehler.length) {
          zeigeHinweis(fehler[0], 'warnung');
          return;
        }
        const gespeichert = store.speichereVerband({
          ...verband,
          id: store.eigeneVerbaende().some((v) => v.id === verband.id) ? verband.id : null,
          name: verband.name || 'Eigener Verband',
        });
        state.konfig.verbandId = gespeichert.id;
        delete state.konfig.verband;
        fuelleVerbandSelect();
        zeigeHinweis(`Verband „${gespeichert.name}“ gespeichert.`);
        break;
      }
      case 'loeschen':
        store.loescheVerband(state.konfig.verbandId);
        state.konfig.verbandId = VERBAENDE[0].id;
        delete state.konfig.verband;
        fuelleVerbandSelect();
        zeigeHinweis('Eigener Verband gelöscht.');
        break;
      default:
        return;
    }
    formularAusKonfig();
    renderVerbandEditor();
    rendere();
  });
}

/* ----------------------------------------------------------------- Ausgabe */

function tabelle(kopf, zeilen, fuss = null) {
  return `<table class="tabelle">
    <thead><tr>${kopf.map((h) => `<th>${h}</th>`).join('')}</tr></thead>
    <tbody>${zeilen.map((z) => `<tr>${z.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
    ${fuss ? `<tfoot><tr>${fuss.map((c) => `<td>${c}</td>`).join('')}</tr></tfoot>` : ''}
  </table>`;
}

function renderKennzahlen(mauer, kalk) {
  const karten = mauer.schenkel.map((s, i) => {
    const stats = kalk.schenkel[i];
    const abw = s.abweichung === null ? '' :
      `<span class="abweichung">${s.abweichung === 0 ? 'exakt' : `${s.abweichung > 0 ? '+' : ''}${zahlFmt(s.abweichung / 10, 1)} cm zur Zielhöhe`}</span>`;
    return `<article class="karte">
      <h4>${esc(s.name)}</h4>
      <dl>
        <div><dt>L&auml;nge</dt><dd>${cm(s.laenge)}</dd></div>
        <div><dt>H&ouml;he</dt><dd>${cm(s.hoehe)} ${abw}</dd></div>
        <div><dt>Lagen</dt><dd>${s.lagenAnzahl}</dd></div>
        <div><dt>Steine</dt><dd>${stats.steine}</dd></div>
        <div><dt>Zuschnitte</dt><dd>${stats.schnitte}</dd></div>
        <div><dt>Ansichtsfl&auml;che</dt><dd>${zahlFmt(stats.flaeche, 2)} m&sup2;</dd></div>
      </dl>
    </article>`;
  });

  karten.push(`<article class="karte karte--summe">
    <h4>Gesamt</h4>
    <dl>
      <div><dt>Steine ben&ouml;tigt</dt><dd>${kalk.summe.verbrauch}</dd></div>
      <div><dt>inkl. Verschnitt</dt><dd>${kalk.summe.bestellmenge}</dd></div>
      <div><dt>Zuschnitte</dt><dd>${kalk.summe.schnitte}${kalk.summe.ausRest ? ` (${kalk.summe.ausRest} aus Rest)` : ''}</dd></div>
      <div><dt>Mauerfl&auml;che</dt><dd>${zahlFmt(kalk.summe.flaeche, 2)} m&sup2;</dd></div>
      <div><dt>Laufmeter</dt><dd>${zahlFmt(kalk.summe.laufmeter, 2)} m</dd></div>
      <div><dt>Gewicht ca.</dt><dd>${zahlFmt(kalk.summe.gewicht, 0)} kg</dd></div>
    </dl>
  </article>`);

  $('#kennzahlen').innerHTML = karten.join('');
}

function renderAnsichten(mauer) {
  $('#ansichten').innerHTML = mauer.schenkel.map((s, i) => {
    const partner = mauer.schenkel[1 - i];
    const hinweis = partner
      ? `<p class="beschreibung">Gezeichnet von der Ecke (links) zum freien Ende (rechts).
         In den gestrichelten Feldern an der Ecke l&auml;uft ${esc(partner.name)} durch
         (wechselseitige Eckverzahnung). Schraffierte Steine sind Zuschnitte.</p>`
      : '<p class="beschreibung">Schraffierte Steine sind Zuschnitte; das Ma&szlig; ist die fertige L&auml;nge.</p>';
    return `<section class="block">
      <h3>Ansicht ${esc(s.name)}</h3>
      <div class="zeichnung">${zeichneAnsicht(s, { form: mauer.form, katalog })}</div>
      ${hinweis}
    </section>`;
  }).join('');
}

function renderBedarf(kalk) {
  const zeilen = kalk.positionen.map((p) => [
    `<strong>${esc(p.steinId)}</strong>`,
    esc(p.name),
    p.format,
    p.ganz,
    p.zuschnitte + (p.ausRest ? ` <span class="leise-text">(${p.ausRest} aus Rest)</span>` : ''),
    `<strong>${p.verbrauch}</strong>`,
    p.bestellmenge,
    `${zahlFmt(p.gewicht, 0)} kg`,
  ]);
  $('#bedarf').innerHTML = tabelle(
    ['Format', 'Bezeichnung', 'L&times;T&times;H', 'ganz verlegt', 'Zuschnitte', 'Steine n&ouml;tig', `inkl. ${zahlFmt(state.konfig.verschnitt, 0)} %`, 'Gewicht ca.'],
    zeilen,
    ['Summe', '', '',
      kalk.positionen.reduce((s, p) => s + p.ganz, 0),
      kalk.positionen.reduce((s, p) => s + p.zuschnitte, 0),
      `<strong>${kalk.summe.verbrauch}</strong>`,
      kalk.summe.bestellmenge,
      `${zahlFmt(kalk.summe.gewicht, 0)} kg`],
  );
  $('#legendeBox').innerHTML = legende(kalk.positionen, katalog);
}

function renderSchnitte(kalk) {
  if (!kalk.schnitte.length) {
    $('#schnitte').innerHTML = '<p class="beschreibung">Kein Zuschnitt erforderlich &ndash; alle Lagen gehen im Steinraster auf.</p>';
    return;
  }
  const uebersicht = schnittUebersicht(kalk.schnitte).map((u) => [
    `<strong>${esc(u.steinId)}</strong>`,
    cm(u.laenge),
    `aus ${katalog[u.steinId].l / 10} cm`,
    u.anzahl,
    u.ausRest || '&ndash;',
  ]);

  const detail = kalk.schnitte.map((s) => [
    esc(s.schenkel),
    `L${s.lage}`,
    esc(s.steinId),
    cm(s.laenge),
    s.herkunft === 'rest' ? 'aus Rest&shy;st&uuml;ck' : 'neuer Stein',
    cm(s.x),
  ]);

  $('#schnitte').innerHTML = `
    ${tabelle(['Format', 'Zuschnittl&auml;nge', 'Ausgangsl&auml;nge', 'Anzahl', 'davon aus Rest'], uebersicht)}
    <details class="details"><summary>Alle Zuschnitte einzeln (${kalk.schnitte.length})</summary>
      ${tabelle(['Schenkel', 'Lage', 'Format', 'Zuschnitt', 'Herkunft', 'Position ab Ecke'], detail)}
    </details>`;
}

function renderReste(kalk) {
  const block = $('#resteBlock');
  if (!kalk.reste.length) {
    block.hidden = true;
    return;
  }
  block.hidden = false;
  $('#reste').innerHTML = tabelle(
    ['L&auml;nge', 'Format', 'entstanden bei'],
    kalk.reste.map((r) => [cm(r.laenge), esc(r.steinId), esc(r.herkunft)]),
  );
}

function renderLagen(mauer) {
  $('#lagenTabelle').innerHTML = mauer.schenkel.map((s) => {
    const zeilen = [...s.lagen].reverse().map((lage) => [
      `L${lage.index + 1}`,
      lage.quelle === 'verband'
        ? `Verband, Lage ${lage.verbandIndex + 1}`
        : `Sonderlage ${lage.quelle === 'unten' ? 'unten' : 'oben'}`,
      cm(lage.y + lage.hoehe),
      cm(lage.hoehe),
      lage.offset ? `${cm(lage.offset)} zur&uuml;ck` : 'an der Ecke',
      cm(lage.nutzlaenge),
      lage.steine.map((st) => (st.zuschnitt
        ? `<span class="zuschnitt" title="Zuschnitt">${esc(st.steinId)}&rarr;${cm(st.l)}</span>`
        : esc(st.steinId))).join(' &middot; '),
    ]);
    return `<h4>${esc(s.name)}</h4>${tabelle(
      ['Lage', 'Herkunft', 'Oberkante', 'H&ouml;he', 'Beginn', 'Nutzl&auml;nge', 'Steinfolge (von der Ecke aus)'],
      zeilen,
    )}`;
  }).join('');
}

function renderDruckkopf(mauer) {
  const k = state.konfig;
  $('#druckTitel').textContent = k.name;
  $('#druckMeta').textContent = [
    k.form === 'ecke' ? 'Ecke 90°' : 'Gerade Mauer',
    `Verband: ${aktiverVerband().name}`,
    `Mauerdicke ${zahlFmt(mauer.tiefe / 10, 0)} cm`,
    `Stoßfuge ${k.fuge} mm / Lagerfuge ${k.lagenfuge} mm`,
    new Date().toLocaleDateString('de-DE'),
  ].join(' · ');
}

function zeigeFehler(fehler) {
  const box = $('#fehler');
  box.hidden = fehler.length === 0;
  box.innerHTML = fehler.map((f) => `<p>${esc(f)}</p>`).join('');
}

/* ------------------------------------------------------------- Hauptablauf */

export function rendere() {
  const verband = aktiverVerband();
  const fehler = pruefeVerband(verband, katalog);
  zeigeFehler(fehler);
  $('#verbandBeschreibung').textContent = verband.beschreibung || '';
  if (fehler.length) return;

  const mauer = baueMauer(state.konfig, verband, katalog);
  const kalk = kalkuliere(mauer, katalog, state.konfig);

  renderKennzahlen(mauer, kalk);
  $('#draufsicht').innerHTML = zeichneDraufsicht(mauer);
  renderAnsichten(mauer);
  renderBedarf(kalk);
  renderSchnitte(kalk);
  renderReste(kalk);
  renderLagen(mauer);
  renderDruckkopf(mauer);

  store.merkeEntwurf({ konfig: state.konfig, planId: state.planId });
}

function bindeFormular() {
  const formular = $('#formular');

  formular.addEventListener('input', (ev) => {
    if (ev.target.closest('#verbandEditor')) return;
    konfigAusFormular();
    rendere();
  });

  formular.addEventListener('change', (ev) => {
    if (ev.target.closest('#verbandEditor')) return;
    konfigAusFormular();
    if (ev.target.id === 'verbandId') delete state.konfig.verband;
    formularAusKonfig();
    renderVerbandEditor();
    rendere();
  });

  formular.addEventListener('submit', (ev) => ev.preventDefault());

  $('#btnVerbandEditor').addEventListener('click', () => {
    const box = $('#verbandEditor');
    box.hidden = !box.hidden;
    $('#btnVerbandEditor').textContent = box.hidden ? 'Verband bearbeiten' : 'Editor schließen';
    renderVerbandEditor();
  });
}

function bindeAktionen() {
  $('#btnSpeichern').addEventListener('click', () => {
    const eintrag = store.speicherePlan(state.konfig, state.planId);
    state.planId = eintrag.id;
    fuellePlanListe();
    zeigeHinweis(`Plan „${eintrag.name}“ gespeichert.`);
    rendere();
  });

  $('#btnSpeichernAls').addEventListener('click', () => {
    const eintrag = store.speicherePlan(state.konfig, null);
    state.planId = eintrag.id;
    fuellePlanListe();
    zeigeHinweis(`Als neuer Plan „${eintrag.name}“ gespeichert.`);
    rendere();
  });

  $('#btnLaden').addEventListener('click', () => {
    const id = $('#planListe').value;
    const eintrag = id && store.ladePlan(id);
    if (!eintrag) {
      zeigeHinweis('Bitte einen gespeicherten Plan auswählen.', 'warnung');
      return;
    }
    state.konfig = migriere(eintrag.konfig);
    state.planId = eintrag.id;
    fuelleVerbandSelect();
    formularAusKonfig();
    renderVerbandEditor();
    rendere();
    zeigeHinweis(`Plan „${eintrag.name}“ geladen.`);
  });

  $('#btnLoeschen').addEventListener('click', () => {
    const id = $('#planListe').value;
    const eintrag = id && store.ladePlan(id);
    if (!eintrag) return;
    if (!window.confirm(`Plan „${eintrag.name}“ wirklich löschen?`)) return;
    store.loeschePlan(id);
    if (state.planId === id) state.planId = null;
    fuellePlanListe();
    zeigeHinweis('Plan gelöscht.');
  });

  $('#btnNeu').addEventListener('click', () => {
    state.konfig = standardKonfig();
    state.planId = null;
    fuelleVerbandSelect();
    formularAusKonfig();
    renderVerbandEditor();
    rendere();
    zeigeHinweis('Neuer Plan angelegt.');
  });

  $('#btnExport').addEventListener('click', () => {
    const blob = new Blob([store.exportiereAlles()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mauerplaene-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  });

  $('#btnImport').addEventListener('click', () => $('#dateiImport').click());

  $('#dateiImport').addEventListener('change', async (ev) => {
    const datei = ev.target.files?.[0];
    if (!datei) return;
    try {
      const ergebnis = store.importiereAlles(await datei.text());
      fuellePlanListe();
      fuelleVerbandSelect();
      zeigeHinweis(`${ergebnis.plaene} Plan/Pläne und ${ergebnis.verbaende} Verband/Verbände importiert.`);
    } catch (fehler) {
      zeigeHinweis(`Import fehlgeschlagen: ${fehler.message}`, 'warnung');
    }
    ev.target.value = '';
  });

  $('#btnDrucken').addEventListener('click', () => window.print());
}

function init() {
  const entwurf = store.holeEntwurf();
  if (entwurf?.konfig) {
    state.konfig = migriere(entwurf.konfig);
    state.planId = entwurf.planId || null;
  }
  fuelleAuswahlfelder();
  fuelleVerbandSelect();
  fuellePlanListe();
  formularAusKonfig();
  bindeFormular();
  bindeEditor();
  bindeAktionen();
  rendere();

  if (store.speicherIstFluechtig) {
    zeigeHinweis('Der Browser-Speicher ist nicht verfügbar – Pläne gehen beim Schließen verloren.', 'warnung');
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
