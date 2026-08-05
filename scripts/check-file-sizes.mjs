#!/usr/bin/env node
/**
 * File-size ratchet gate.
 *
 * Limits: 400 lines per source file (web .ts/.tsx, Flutter .dart),
 * 200 lines per component/widget file. Legacy violations are frozen in
 * file-size-baseline.json: they may shrink but never grow, and no new
 * violation may be introduced. Files whose length is data rather than
 * logic are exempt (EXEMPT below, each with a justification).
 *
 * Usage:
 *   node scripts/check-file-sizes.mjs                  # check (CI)
 *   node scripts/check-file-sizes.mjs --write-baseline # refresh baseline
 *
 * Split guidance lives in .claude/skills/thermo-nuclear-code-quality-review/
 * and AGENTS.md "File & Folder Organization".
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..'
);
const BASELINE_PATH = path.join(REPO_ROOT, 'file-size-baseline.json');

const FILE_LIMIT = 400;
const COMPONENT_LIMIT = 200;

const SCAN = [
  {
    roots: ['app', 'components', 'lib', 'hooks', 'i18n'],
    exts: ['.ts', '.tsx'],
  },
  { roots: ['apps/mobile-flutter/lib'], exts: ['.dart'] },
];

// Permanent exemptions: files whose length comes from data, not logic.
// Bar for adding one: "would splitting reduce concepts per file, or just
// scatter one table across files?" Structure review still applies to them.
const EXEMPT = new Map([
  [
    'lib/db/schema.ts',
    'Drizzle schema source of truth — Domain A stays one declaration site',
  ],
  [
    'lib/nutrition/catalog/reference-targets.ts',
    'pure data catalog of reference nutrition targets',
  ],
  [
    'lib/ai/prompts/nutrition.ts',
    'prompt text — splitting hurts prompt legibility',
  ],
  [
    'lib/ai/prompts/grounded-estimation.ts',
    'prompt text — splitting hurts prompt legibility',
  ],
  [
    'lib/ai/prompts/decomposition.ts',
    'prompt text — splitting hurts prompt legibility',
  ],
]);

function isExcluded(rel) {
  return (
    rel.startsWith('components/ui/') || // shadcn CLI-managed
    rel.includes('/__tests__/') ||
    /\.test\.[a-z]+$/.test(rel) ||
    rel.endsWith('.g.dart') ||
    rel.endsWith('.freezed.dart')
  );
}

function isComponentFile(rel) {
  if (rel.endsWith('.tsx')) {
    if (rel.startsWith('components/')) return true;
    if (rel.startsWith('app/') && rel.includes('/_components/')) return true;
  }
  if (rel.endsWith('.dart')) {
    if (rel.includes('/widgets/')) return true;
    if (rel.startsWith('apps/mobile-flutter/lib/shell/')) return true;
  }
  return false;
}

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

function countLines(file) {
  const text = readFileSync(file, 'utf8');
  if (text.length === 0) return 0;
  const newlines = (text.match(/\n/g) ?? []).length;
  return text.endsWith('\n') ? newlines : newlines + 1;
}

function scan() {
  const files = [];
  for (const { roots, exts } of SCAN) {
    for (const root of roots) {
      const abs = path.join(REPO_ROOT, root);
      if (!existsSync(abs)) continue;
      for (const full of walk(abs)) {
        const rel = path.relative(REPO_ROOT, full).split(path.sep).join('/');
        if (!exts.some((ext) => rel.endsWith(ext)) || isExcluded(rel)) continue;
        const limit = isComponentFile(rel) ? COMPONENT_LIMIT : FILE_LIMIT;
        const lines = countLines(full);
        if (lines > limit && !EXEMPT.has(rel))
          files.push({ rel, lines, limit });
      }
    }
  }
  return files.sort((a, b) => b.lines - a.lines);
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) return {};
  return JSON.parse(readFileSync(BASELINE_PATH, 'utf8')).files ?? {};
}

const overLimit = scan();

if (process.argv.includes('--write-baseline')) {
  const files = Object.fromEntries(
    overLimit.map(({ rel, lines }) => [rel, lines])
  );
  const baseline = {
    note: 'Ratchet baseline for scripts/check-file-sizes.mjs. Frozen legacy oversize files: may shrink, never grow. Do not add entries by hand — split the file instead (see AGENTS.md "File & Folder Organization").',
    files,
  };
  writeFileSync(BASELINE_PATH, `${JSON.stringify(baseline, null, 2)}\n`);
  console.log(`Baseline written: ${overLimit.length} frozen violations.`);
  process.exit(0);
}

const baseline = readBaseline();
const failures = [];
for (const { rel, lines, limit } of overLimit) {
  const frozen = baseline[rel];
  if (frozen === undefined) {
    failures.push(
      `${rel} — ${lines} lines > ${limit} (new violation): split it along a real seam before merging.`
    );
  } else if (lines > frozen) {
    failures.push(
      `${rel} — grew ${frozen} → ${lines} lines (limit ${limit}): shrink it back or split it; growing baselined files is not allowed.`
    );
  }
}

const tightenable = Object.keys(baseline).filter(
  (rel) => !overLimit.some((f) => f.rel === rel && f.lines === baseline[rel])
);

if (failures.length > 0) {
  console.error(`check-file-sizes: ${failures.length} violation(s)\n`);
  for (const f of failures) console.error(`  FAIL ${f}`);
  console.error(
    '\nLimits: 400 lines/source file, 200 lines/component or widget file.'
  );
  console.error(
    'Split guidance: .claude/skills/thermo-nuclear-code-quality-review/SKILL.md'
  );
  process.exit(1);
}

console.log(
  `check-file-sizes: OK (${overLimit.length} frozen legacy files in baseline)`
);
if (tightenable.length > 0) {
  console.log(
    `  ${tightenable.length} baseline entr${tightenable.length === 1 ? 'y' : 'ies'} shrank or resolved — run \`node scripts/check-file-sizes.mjs --write-baseline\` to ratchet down.`
  );
}
