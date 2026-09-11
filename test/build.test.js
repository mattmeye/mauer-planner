import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

/** Der Einzeldatei-Build muss syntaktisch gueltig und vollstaendig sein. */
test('Einzeldatei-Build ist lauffaehig zusammengesetzt', () => {
  execFileSync(process.execPath, ['tools/build-single-file.mjs'], { stdio: 'pipe' });
  const html = readFileSync('dist/mauer-konfigurator.html', 'utf8');

  const skript = html.match(/<script type="module">([\s\S]*?)<\/script>/);
  assert.ok(skript, 'Modul-Skript ist eingebettet');
  assert.ok(html.includes('<style>'), 'Stylesheet ist eingebettet');
  assert.ok(!html.includes('src="src/ui/app.js"'), 'kein externer Skriptverweis mehr');
  assert.ok(!html.includes('href="assets/styles.css"'), 'kein externer Stylesheet-Verweis mehr');

  const code = skript[1];
  assert.ok(!/^\s*import\s/m.test(code), 'keine Import-Anweisungen im Bundle');
  assert.ok(!/^export\s/m.test(code), 'keine Export-Anweisungen im Bundle');
  assert.match(code, /const \$\$ = /, 'Bezeichner bleiben unveraendert ($$ nicht ersetzt)');
  for (const modul of ['catalog.js', 'patterns.js', 'wall.js', 'calc.js', 'svg.js', 'store.js', 'app.js']) {
    assert.ok(code.includes(`---- src/`) && code.includes(modul), `${modul} ist enthalten`);
  }

  // Syntaxpruefung: doppelte Bezeichner o. ae. wuerden hier auffallen.
  const datei = join(mkdtempSync(join(tmpdir(), 'mauerplan-')), 'bundle.mjs');
  writeFileSync(datei, code);
  execFileSync(process.execPath, ['--check', datei], { stdio: 'pipe' });
});
