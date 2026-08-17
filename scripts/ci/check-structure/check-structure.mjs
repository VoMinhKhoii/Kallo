#!/usr/bin/env node
/**
 * Structure gate — file size, folder size, test placement, barrel files.
 *
 * Usage:
 *   node scripts/ci/check-structure/check-structure.mjs                  # check (CI)
 *   node scripts/ci/check-structure/check-structure.mjs --write-baseline # refresh ratchet
 *   node scripts/ci/check-structure/check-structure.mjs --strict         # fail on advisory rules
 *
 * Size rules fail on regression (ratcheted via file-size-baseline.json).
 * Folder / test-placement / barrel rules were advisory during the consolidation
 * stack; they are now enforced — CI and `bun check:structure` both pass
 * --strict. Split guidance lives in AGENTS.md "File & Folder Organization".
 */
import {
  diffAgainstBaseline,
  readBaseline,
  writeBaseline,
} from './baseline.mjs';
import { FOLDER_LIMIT, IDEAL_LIMIT } from './config.mjs';
import {
  aboveIdealBand,
  barrelFiles,
  misplacedTests,
  oversizeFiles,
  oversizeFolders,
} from './rules.mjs';
import { scanFiles, scanFolders } from './scan.mjs';

const strict = process.argv.includes('--strict');

const files = scanFiles();
const overFiles = oversizeFiles(files);
const { folders, subfolderCounts } = scanFolders();
const overFolders = oversizeFolders(folders);
// Advisory only: a folder of folders is a directory index, not a dumping
// ground. Reported so sprawl stays visible without forcing junk-drawer nesting.
const SUBFOLDER_SPRAWL = 15;
const sprawling = [...subfolderCounts.entries()]
  .filter(([, n]) => n > SUBFOLDER_SPRAWL)
  .sort((a, b) => b[1] - a[1]);

if (process.argv.includes('--write-baseline')) {
  const { fileCount, folderCount } = writeBaseline({
    oversizeFiles: overFiles,
    oversizeFolders: overFolders,
  });
  console.log(
    `Baseline written: ${fileCount} frozen file(s), ${folderCount} frozen folder(s).`
  );
  process.exit(0);
}

const frozen = readBaseline();

const fileDiff = diffAgainstBaseline(
  overFiles.map((f) => ({ key: f.rel, value: f.lines, limit: f.limit })),
  frozen.files,
  { label: 'split it along a real seam before merging', unit: 'lines' }
);

const folderDiff = diffAgainstBaseline(
  overFolders.map((f) => ({ key: f.dir, value: f.count, limit: FOLDER_LIMIT })),
  frozen.folders,
  {
    label: 'name the missing sub-concern and split the folder',
    unit: 'entries',
  }
);

const tests = misplacedTests();
const barrels = barrelFiles();
const wide = aboveIdealBand(files);

const hardFailures = fileDiff.failures;
const softFailures = [
  ...folderDiff.failures,
  ...tests.map((t) => `${t} — test outside a __tests__/ folder`),
  ...barrels.map((b) => `${b.rel} — barrel file (${b.kind})`),
];

for (const f of hardFailures) console.error(`  FAIL ${f}`);
for (const f of softFailures)
  console[strict ? 'error' : 'log'](`  ${strict ? 'FAIL' : 'WARN'} ${f}`);

const failed = hardFailures.length + (strict ? softFailures.length : 0);
if (failed > 0) {
  console.error(`\ncheck-structure: ${failed} violation(s)`);
  console.error(
    `Limits: ${IDEAL_LIMIT * 2} lines/source file, ${IDEAL_LIMIT} lines/component or widget, ${FOLDER_LIMIT} entries/folder.`
  );
  process.exit(1);
}

console.log(
  `check-structure: OK — ${overFiles.length} frozen file(s), ${overFolders.length} frozen folder(s), ` +
    `${softFailures.length} advisory warning(s), ${wide.length} file(s) above the ${IDEAL_LIMIT}-line ideal.`
);

for (const [dir, n] of sprawling) {
  console.log(
    `  NOTE ${dir} — ${n} subfolders; group them by function if it stops scanning cleanly`
  );
}

const stale = [...fileDiff.stale, ...folderDiff.stale];
if (stale.length > 0) {
  console.log(
    `  ${stale.length} baseline entr${stale.length === 1 ? 'y' : 'ies'} shrank or resolved — run with --write-baseline to ratchet down.`
  );
}
