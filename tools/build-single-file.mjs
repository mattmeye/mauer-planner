#!/usr/bin/env node
/**
 * Baut aus index.html, dem Stylesheet und den ES-Modulen eine einzelne
 * HTML-Datei (dist/mauer-konfigurator.html). Diese Datei laeuft ohne Server -
 * sie kann kopiert, per Mail verschickt und direkt im Browser geoeffnet werden.
 *
 * Aufruf: npm run build
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..');

/** Module in Abhaengigkeitsreihenfolge (Blaetter zuerst). */
const MODULE = [
  'src/data/catalog.js',
  'src/data/patterns.js',
  'src/core/wall.js',
  'src/core/calc.js',
  'src/ui/svg.js',
  'src/store.js',
  'src/ui/app.js',
];

/** Module, die anderswo als Namensraum (`import * as x`) eingebunden werden. */
const NAMENSRAEUME = { 'src/store.js': 'store' };

const lies = (pfad) => readFile(join(wurzel, pfad), 'utf8');

/** Sammelt die exportierten Bezeichner eines Moduls. */
function exportNamen(quelltext) {
  const namen = new Set();
  const einzeln = /^export\s+(?:async\s+)?(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/gm;
  for (const treffer of quelltext.matchAll(einzeln)) namen.add(treffer[1]);
  const sammel = /^export\s*\{([^}]+)\}/gm;
  for (const treffer of quelltext.matchAll(sammel)) {
    treffer[1].split(',').forEach((teil) => {
      const name = teil.split(/\s+as\s+/).pop().trim();
      if (name) namen.add(name);
    });
  }
  return [...namen];
}

/** Entfernt Import-/Export-Syntax, damit der Code flach zusammenlaufen kann. */
function entflechte(quelltext) {
  return quelltext
    .replace(/^\s*import\s+[^;]*?;\s*$/gms, '')
    .replace(/^export\s+(?=(?:async\s+)?(?:const|let|var|function|class)\s)/gm, '')
    .replace(/^export\s*\{[^}]*\}\s*;?\s*$/gm, '')
    .trim();
}

const teile = [];
for (const pfad of MODULE) {
  const quelltext = await lies(pfad);
  teile.push(`/* ---- ${pfad} ---- */\n${entflechte(quelltext)}`);
  const namensraum = NAMENSRAEUME[pfad];
  if (namensraum) {
    const namen = exportNamen(quelltext);
    teile.push(`const ${namensraum} = { ${namen.join(', ')} };`);
  }
}

const css = await lies('assets/styles.css');
let html = await lies('index.html');

// Ersetzt wird ueber Funktionen, damit Zeichenfolgen wie `$$` im Quelltext
// nicht als Ersetzungsmuster interpretiert werden.
html = html
  .replace('<link rel="stylesheet" href="assets/styles.css">', () => `<style>\n${css}\n</style>`)
  .replace(
    '<script type="module" src="src/ui/app.js"></script>',
    () => `<script type="module">\n${teile.join('\n\n')}\n</script>`,
  )
  .replace('</title>', () => ' (Einzeldatei)</title>');

await mkdir(join(wurzel, 'dist'), { recursive: true });
const ziel = join(wurzel, 'dist/mauer-konfigurator.html');
await writeFile(ziel, html, 'utf8');

console.log(`dist/mauer-konfigurator.html geschrieben (${(html.length / 1024).toFixed(0)} kB)`);
