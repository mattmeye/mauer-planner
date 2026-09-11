/**
 * Persistenz im Browser-Speicher (localStorage).
 *
 * Gespeichert werden:
 *  - Mauerplaene (Konfigurationen)
 *  - eigene Verbandarten
 *  - der zuletzt bearbeitete Entwurf (damit ein Reload nichts verliert)
 *
 * Steht localStorage nicht zur Verfuegung (privater Modus, Datei-Aufruf mit
 * strengen Einstellungen), faellt das Modul auf einen Speicher im
 * Arbeitsspeicher zurueck - die Anwendung bleibt bedienbar.
 */

const KEY_PLAENE = 'mauerplaner.plaene.v1';
const KEY_VERBAENDE = 'mauerplaner.verbaende.v1';
const KEY_ENTWURF = 'mauerplaner.entwurf.v1';

const speicher = (() => {
  try {
    const probe = '__mauerplaner__';
    window.localStorage.setItem(probe, '1');
    window.localStorage.removeItem(probe);
    return window.localStorage;
  } catch {
    const map = new Map();
    return {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => map.set(k, String(v)),
      removeItem: (k) => map.delete(k),
      fluechtig: true,
    };
  }
})();

export const speicherIstFluechtig = Boolean(speicher.fluechtig);

function lies(key, fallback) {
  try {
    const roh = speicher.getItem(key);
    if (!roh) return fallback;
    const wert = JSON.parse(roh);
    return wert ?? fallback;
  } catch {
    return fallback;
  }
}

function schreib(key, wert) {
  try {
    speicher.setItem(key, JSON.stringify(wert));
    return true;
  } catch {
    return false;
  }
}

export function neueId(prefix = 'plan') {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

/* ------------------------------------------------------------------ Plaene */

/** Alle Plaene als Array, zuletzt geaendert zuerst. */
export function listePlaene() {
  const alle = lies(KEY_PLAENE, {});
  return Object.values(alle).sort((a, b) => (b.geaendert || 0) - (a.geaendert || 0));
}

export function ladePlan(id) {
  return lies(KEY_PLAENE, {})[id] || null;
}

/**
 * Speichert eine Konfiguration. Ohne `id` wird ein neuer Plan angelegt.
 * @returns {{id:string, name:string, geaendert:number, konfig:object}}
 */
export function speicherePlan(konfig, id = null) {
  const alle = lies(KEY_PLAENE, {});
  const planId = id || neueId();
  const eintrag = {
    id: planId,
    name: konfig.name || 'Mauerplan',
    erstellt: alle[planId]?.erstellt || Date.now(),
    geaendert: Date.now(),
    konfig: JSON.parse(JSON.stringify(konfig)),
  };
  alle[planId] = eintrag;
  schreib(KEY_PLAENE, alle);
  return eintrag;
}

export function loeschePlan(id) {
  const alle = lies(KEY_PLAENE, {});
  delete alle[id];
  schreib(KEY_PLAENE, alle);
}

/* ------------------------------------------------------------- Verbaende */

export function eigeneVerbaende() {
  return Object.values(lies(KEY_VERBAENDE, {}));
}

export function speichereVerband(verband) {
  const alle = lies(KEY_VERBAENDE, {});
  const id = verband.id || neueId('verband');
  alle[id] = { ...JSON.parse(JSON.stringify(verband)), id, eigen: true, geaendert: Date.now() };
  schreib(KEY_VERBAENDE, alle);
  return alle[id];
}

export function loescheVerband(id) {
  const alle = lies(KEY_VERBAENDE, {});
  delete alle[id];
  schreib(KEY_VERBAENDE, alle);
}

/* --------------------------------------------------------------- Entwurf */

export function merkeEntwurf(zustand) {
  schreib(KEY_ENTWURF, zustand);
}

export function holeEntwurf() {
  return lies(KEY_ENTWURF, null);
}

/* ------------------------------------------------------------- Austausch */

/** Kompletter Datenbestand als JSON-Text (Sicherung / Weitergabe). */
export function exportiereAlles() {
  return JSON.stringify(
    {
      typ: 'mauerplaner-export',
      version: 1,
      exportiert: new Date().toISOString(),
      plaene: lies(KEY_PLAENE, {}),
      verbaende: lies(KEY_VERBAENDE, {}),
    },
    null,
    2,
  );
}

/**
 * Importiert eine Sicherung. Vorhandene Eintraege mit gleicher ID werden
 * ueberschrieben, alle uebrigen bleiben erhalten.
 * @returns {{plaene:number, verbaende:number}} Anzahl importierter Eintraege
 */
export function importiereAlles(text) {
  const daten = JSON.parse(text);
  if (!daten || daten.typ !== 'mauerplaner-export') {
    throw new Error('Die Datei ist keine Mauerplaner-Sicherung.');
  }
  const plaene = { ...lies(KEY_PLAENE, {}), ...(daten.plaene || {}) };
  const verbaende = { ...lies(KEY_VERBAENDE, {}), ...(daten.verbaende || {}) };
  schreib(KEY_PLAENE, plaene);
  schreib(KEY_VERBAENDE, verbaende);
  return {
    plaene: Object.keys(daten.plaene || {}).length,
    verbaende: Object.keys(daten.verbaende || {}).length,
  };
}
