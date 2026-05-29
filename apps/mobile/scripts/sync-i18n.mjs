// Copies the shared web message catalogs (../../messages/*.json) into the app
// so Metro can bundle them — Metro cannot resolve runtime values from the repo
// root, so the catalogs are vendored here. `messages/` on the web stays the
// single source of truth; re-run this after editing it:
//
//   node scripts/sync-i18n.mjs
//
import { copyFileSync, mkdirSync, readdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const srcDir = join(here, '../../../messages');
const destDir = join(here, '../src/i18n/messages');

mkdirSync(destDir, { recursive: true });
let count = 0;
for (const file of readdirSync(srcDir)) {
  if (!file.endsWith('.json')) continue;
  copyFileSync(join(srcDir, file), join(destDir, file));
  count += 1;
}
console.log(`Synced ${count} message catalog(s) → src/i18n/messages/`);
