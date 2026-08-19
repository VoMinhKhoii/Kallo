/** Filesystem walk + line counting. No rule logic lives here. */
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { isExcluded, limitFor, REPO_ROOT, SCAN } from './config.mjs';

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules' || entry.name.startsWith('.')) continue;
      yield* walk(full);
    } else if (entry.isFile()) {
      yield full;
    }
  }
}

export function countLines(file) {
  const text = readFileSync(file, 'utf8');
  if (text.length === 0) return 0;
  const newlines = (text.match(/\n/g) ?? []).length;
  return text.endsWith('\n') ? newlines : newlines + 1;
}

const toRel = (full) =>
  path.relative(REPO_ROOT, full).split(path.sep).join('/');

/** Every scanned source file, excluded ones dropped. */
export function scanFiles() {
  const files = [];
  for (const { roots, exts } of SCAN) {
    for (const root of roots) {
      const abs = path.join(REPO_ROOT, root);
      if (!existsSync(abs)) continue;
      for (const full of walk(abs)) {
        const rel = toRel(full);
        if (!exts.some((ext) => rel.endsWith(ext))) continue;
        if (isExcluded(rel)) continue;
        files.push({ rel, lines: countLines(full), limit: limitFor(rel) });
      }
    }
  }
  return files.sort((a, b) => b.lines - a.lines);
}

/**
 * Direct entry count per folder across the whole repo: source files plus
 * FILES only — a subfolder does not count. The rule exists to stop 40 modules
 * being dumped flat in one directory, which is a real cost to read. A folder
 * holding nothing but well-named subfolders is a directory index, and reads as
 * one line per concern; capping that would only force junk-drawer grouping.
 * Subfolder sprawl is still worth watching, so it is reported separately as
 * `subfolders` rather than folded into the failing count.
 *
 * `.sql` is included so supabase/migrations is measured (and then exempted
 * explicitly, rather than silently invisible).
 */
export function scanFolders(extraRoots = ['supabase', 'scripts']) {
  const roots = [...new Set([...SCAN.flatMap((s) => s.roots), ...extraRoots])];
  const counted = new Set(['.ts', '.tsx', '.dart', '.sql', '.mjs', '.js']);
  const folders = new Map();
  const subfolderCounts = new Map();

  const visit = (dir) => {
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }
    let count = 0;
    let subfolders = 0;
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === 'node_modules' || entry.name.startsWith('.'))
          continue;
        subfolders += 1;
        visit(full);
      } else if (
        entry.isFile() &&
        counted.has(path.extname(entry.name)) &&
        !entry.name.endsWith('.g.dart') &&
        !entry.name.endsWith('.freezed.dart')
      ) {
        count += 1;
      }
    }
    folders.set(toRel(dir), count);
    subfolderCounts.set(toRel(dir), subfolders);
  };

  for (const root of roots) {
    const abs = path.join(REPO_ROOT, root);
    if (existsSync(abs)) visit(abs);
  }
  return { folders, subfolderCounts };
}
