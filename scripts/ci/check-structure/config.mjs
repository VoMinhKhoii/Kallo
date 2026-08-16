/**
 * Structure-gate limits and exemptions.
 *
 * Rules enforced (see AGENTS.md "File & Folder Organization"):
 *   1. file size      — 400 lines/source file, 200 lines/component or widget
 *   2. folder size    — 10 direct entries per folder (a subfolder counts as 1)
 *   3. test placement — every *.test.ts(x) lives inside a __tests__/ folder
 *   4. no barrels     — no re-export index.ts hubs outside app/
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../..'
);

export const FILE_LIMIT = 400;
export const COMPONENT_LIMIT = 200;
export const IDEAL_LIMIT = 200; // >IDEAL and <=limit is a warning, not a failure
export const FOLDER_LIMIT = 10;

export const SCAN = [
  {
    roots: ['app', 'components', 'lib', 'hooks', 'i18n'],
    exts: ['.ts', '.tsx'],
  },
  { roots: ['apps/mobile-flutter/lib'], exts: ['.dart'] },
];

/** Folders whose entry count is fixed by an external tool contract. */
export const FOLDER_EXEMPT = new Map([
  [
    'supabase/migrations',
    'Supabase CLI requires flat <timestamp>_name.sql; append-only ledger, not a module',
  ],
  [
    'components/ui',
    'shadcn CLI-managed — `bunx shadcn add` resolves @/components/ui/<name> flat',
  ],
]);

/**
 * Files whose length is data, not logic. Structure review still applies.
 *
 * The bar: the file declares a table, a catalogue, or verbatim prompt text and
 * nothing that branches on it. A file that mixes a table with the functions
 * that read it does NOT qualify — split the table out and exempt only the
 * table (that is what `lib/ai/prompts/{text,build}/`,
 * `lib/ai/portion/data/` and `reference-target-tables.ts` are).
 */
export const SIZE_EXEMPT = new Map([
  [
    'lib/db/schema.ts',
    'Drizzle schema source of truth — Domain A stays one declaration site',
  ],
  [
    'lib/nutrition/catalog/reference-target-tables.ts',
    'published RDA/RNI/DRI tables with citations — no resolution logic',
  ],
  [
    'lib/ai/portion/data/priors.ts',
    'the PORTION_PRIORS table — one sourced grams band per concept, no lookup logic',
  ],
  [
    'lib/ai/portion/data/vessel-tables.ts',
    'vessel dimensions, density/fill constants and the piece-tier art manifest',
  ],
  [
    'lib/ai/prompts/text/decomposition.ts',
    'verbatim Call-1 prompt text — bytes are load-bearing for model output',
  ],
  [
    'lib/ai/prompts/text/decomposition-v2.ts',
    'verbatim V2 Call-1 prompt text — bytes are load-bearing for model output',
  ],
  [
    'lib/ai/prompts/text/nutrition.ts',
    'verbatim Call-2 prompt text — bytes are load-bearing for model output',
  ],
]);

export function isExcluded(rel) {
  return (
    rel.startsWith('components/ui/') || // shadcn CLI-managed
    rel.includes('/__tests__/') ||
    /\.test\.[a-z]+$/.test(rel) ||
    rel.endsWith('_test.dart') ||
    rel.endsWith('.g.dart') ||
    rel.endsWith('.freezed.dart')
  );
}

/**
 * Component/widget files get the tighter limit.
 *
 * Dart note: `controls/` and `panels/` hold widgets too. Before this was
 * fixed, settings/controls/country_select.dart (419 lines) was judged at 400
 * while its near-duplicate onboarding/widgets/country_select.dart was judged
 * at 200 — the same widget, two limits.
 */
export function isComponentFile(rel) {
  if (rel.endsWith('.tsx')) {
    if (rel.startsWith('components/')) return true;
    if (rel.startsWith('app/') && rel.includes('/_components/')) return true;
  }
  if (rel.endsWith('.dart')) {
    if (/\/(widgets|controls|panels)\//.test(rel)) return true;
    if (rel.startsWith('apps/mobile-flutter/lib/shell/')) return true;
  }
  return false;
}

export function limitFor(rel) {
  return isComponentFile(rel) ? COMPONENT_LIMIT : FILE_LIMIT;
}
