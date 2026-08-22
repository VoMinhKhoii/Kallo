/** The structure rules. Each returns a list of plain-string findings. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import {
  FOLDER_EXEMPT,
  FOLDER_LIMIT,
  IDEAL_LIMIT,
  REPO_ROOT,
  SIZE_EXEMPT,
} from './config.mjs';

const toRel = (full) =>
  path.relative(REPO_ROOT, full).split(path.sep).join('/');

function* walkAll(dir) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walkAll(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

const TS_ROOTS = ['app', 'components', 'lib', 'hooks', 'i18n', 'scripts'];

/** Files over their limit, minus data-file exemptions. */
export function oversizeFiles(files) {
  return files.filter((f) => f.lines > f.limit && !SIZE_EXEMPT.has(f.rel));
}

/** Files inside the limit but above the 100–200 ideal band. Advisory only. */
export function aboveIdealBand(files) {
  return files.filter(
    (f) =>
      f.lines > IDEAL_LIMIT && f.lines <= f.limit && !SIZE_EXEMPT.has(f.rel)
  );
}

/** Folders with more than FOLDER_LIMIT direct entries, minus tool-contract exemptions. */
export function oversizeFolders(folders) {
  return [...folders.entries()]
    .filter(([dir, count]) => count > FOLDER_LIMIT && !FOLDER_EXEMPT.has(dir))
    .map(([dir, count]) => ({ dir, count }))
    .sort((a, b) => b.count - a.count);
}

/** Every *.test.ts(x) must sit inside a __tests__/ folder. */
export function misplacedTests() {
  const found = [];
  for (const root of TS_ROOTS) {
    const abs = path.join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    for (const full of walkAll(abs)) {
      const rel = toRel(full);
      if (!/\.test\.tsx?$/.test(rel)) continue;
      if (!rel.includes('/__tests__/')) found.push(rel);
    }
  }
  for (const name of readdirSync(REPO_ROOT)) {
    if (/\.test\.tsx?$/.test(name)) found.push(name);
  }
  return found.sort();
}

const REEXPORT_ONLY =
  /^\s*(export\s+(\*|\{[^}]*\})\s+from\s+|export\s+type\s+\{[^}]*\}\s+from\s+|\/\/|\/\*|\*|$)/;

/**
 * No barrel index.ts hubs outside app/ (AGENTS.md). Two shapes, two fixes:
 * a pure re-export hub gets deleted and its importers rewritten; a real module
 * that merely happens to be called index.ts gets renamed after its concern.
 */
export function barrelFiles() {
  const found = [];
  for (const root of TS_ROOTS.filter((r) => r !== 'app')) {
    const abs = path.join(REPO_ROOT, root);
    if (!existsSync(abs)) continue;
    for (const full of walkAll(abs)) {
      const rel = toRel(full);
      if (!/(^|\/)index\.tsx?$/.test(rel)) continue;
      const lines = readFileSync(full, 'utf8')
        .split('\n')
        .filter((l) => l.trim().length > 0);
      const pure = lines.every((l) => REEXPORT_ONLY.test(l));
      found.push({
        rel,
        kind: pure ? 'pure re-export hub' : 'real module named index',
      });
    }
  }
  return found.sort((a, b) => a.rel.localeCompare(b.rel));
}
