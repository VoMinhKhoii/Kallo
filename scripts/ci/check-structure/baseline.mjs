/** Ratchet baseline I/O: frozen violations may shrink, never grow. */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { REPO_ROOT } from './config.mjs';

export const BASELINE_PATH = path.join(REPO_ROOT, 'file-size-baseline.json');

const NOTE =
  'Ratchet baseline for scripts/ci/check-structure. Frozen legacy violations: ' +
  'may shrink, never grow. Do not add entries by hand — split the file or the ' +
  'folder instead (see AGENTS.md "File & Folder Organization").';

export function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return { files: {}, folders: {} };
  const raw = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
  return { files: raw.files ?? {}, folders: raw.folders ?? {} };
}

export function writeBaseline({ oversizeFiles, oversizeFolders }) {
  const files = Object.fromEntries(
    oversizeFiles.map(({ rel, lines }) => [rel, lines])
  );
  const folders = Object.fromEntries(
    oversizeFolders.map(({ dir, count }) => [dir, count])
  );
  writeFileSync(
    BASELINE_PATH,
    `${JSON.stringify({ note: NOTE, files, folders }, null, 2)}\n`
  );
  return {
    fileCount: Object.keys(files).length,
    folderCount: Object.keys(folders).length,
  };
}

/**
 * A frozen entry fails only if it grew. Anything absent from the baseline is
 * a new violation. `stale` lists baseline keys that no longer violate (or no
 * longer exist) so the ratchet can be tightened.
 */
export function diffAgainstBaseline(current, frozen, { label, unit }) {
  const failures = [];
  for (const { key, value, limit } of current) {
    const was = frozen[key];
    if (was === undefined) {
      failures.push(
        `${key} — ${value} ${unit} > ${limit} (new violation): ${label}`
      );
    } else if (value > was) {
      failures.push(
        `${key} — grew ${was} → ${value} ${unit} (limit ${limit}): shrink it back or split it`
      );
    }
  }
  const stale = Object.keys(frozen).filter(
    (key) => !current.some((c) => c.key === key && c.value === frozen[key])
  );
  return { failures, stale };
}
