import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PathItem } from '@/lib/api/openapi/components';
import { openApiDocument } from '@/lib/api/openapi/document';
import { routeInventory } from '@/lib/api/route-inventory';

/**
 * Every handler that reads its body through a byte-capped reader can answer
 * 413 `PAYLOAD_TOO_LARGE`, and the spec must say so. `readJsonBody` caps every
 * caller at once, so a new capped route -- or a new caller of the shared
 * helper -- must not be able to ship with that 413 undocumented. This walks the
 * `bodyBound: true` routes in `route-inventory.ts`, finds each exported method
 * whose handler calls a capped reader, and requires its documented operation
 * to list a 413. (The multipart upload routes guard `content-length` by hand
 * and answer 400, so they correctly fall outside this check.)
 */

const CAPPED_READER = /\b(?:readJsonBody|readBoundedJson|readBoundedBody)\(/;
const METHOD_EXPORT =
  /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

/** `api/v1/meals/[mealId]/route.ts` -> `/api/v1/meals/{mealId}`. */
function toSpecPath(file: string): string {
  return `/${file
    .replace(/\/route\.tsx?$/, '')
    .replace(/\[(?:\.\.\.)?([^\]]+)\]/g, '{$1}')}`;
}

const FUNCTION_EXPORT = /export\s+(?:async\s+)?function\s+(\w+)/g;
const RELATIVE_IMPORT = /import\s*\{([^}]*)\}\s*from\s*'(\.{1,2}\/[^']+)'/g;

function readModule(base: string): string | undefined {
  for (const candidate of [`${base}.ts`, `${base}.tsx`, `${base}/index.ts`]) {
    try {
      return readFileSync(candidate, 'utf8');
    } catch {
      // Try the next extension.
    }
  }
  return undefined;
}

/**
 * Names the route imports from a same-folder helper (`./_lib/...`, `../...`)
 * whose own body calls a capped reader. A route that reads its body through
 * such a helper -- `analyze-meal` via `validateRequest` -- caps it just the
 * same, and a scan of the route file alone would miss it.
 */
function cappedHelpers(source: string, routeDir: string): string[] {
  const names: string[] = [];
  for (const [, imported, from] of source.matchAll(RELATIVE_IMPORT)) {
    const helper = readModule(path.resolve(routeDir, from));
    if (!helper) continue;
    const fns = [...helper.matchAll(FUNCTION_EXPORT)];
    const capped = new Set(
      fns
        .filter((match, i) => {
          const end = fns[i + 1]?.index ?? helper.length;
          return CAPPED_READER.test(helper.slice(match.index, end));
        })
        .map((match) => match[1])
    );
    for (const name of imported.split(',')) {
      const local = name.trim().split(/\s+as\s+/);
      if (capped.has(local[0])) names.push(local[1] ?? local[0]);
    }
  }
  return names;
}

/**
 * Lower-cased methods whose handler body calls a capped reader, directly or
 * through a same-folder helper.
 */
function cappedMethods(file: string): string[] {
  const full = path.join(process.cwd(), 'app', file);
  const source = readFileSync(full, 'utf8');
  const helpers = cappedHelpers(source, path.dirname(full));
  const callsCapped = (slice: string) =>
    CAPPED_READER.test(slice) ||
    helpers.some((name) => new RegExp(`\\b${name}\\(`).test(slice));
  const exports = [...source.matchAll(METHOD_EXPORT)];
  return exports
    .filter((match, i) => {
      const end = exports[i + 1]?.index ?? source.length;
      return callsCapped(source.slice(match.index, end));
    })
    .map((match) => match[1].toLowerCase());
}

const paths = openApiDocument().paths as Record<string, PathItem>;

const cappedOperations = Object.entries(routeInventory)
  .filter(([file, entry]) => entry[1] && file.startsWith('api/'))
  .flatMap(([file]) => {
    const item = paths[toSpecPath(file)];
    // Undocumented routes are drift.test.ts's concern (its EXCLUDED list).
    if (!item) return [];
    return cappedMethods(file).map((method) => ({
      where: `${method.toUpperCase()} ${toSpecPath(file)}`,
      op: item[method as keyof PathItem],
    }));
  });

describe('bounded-body operations document their 413', () => {
  it('found the capped handlers', () => {
    // A broken walk would make the real assertion vacuously pass.
    expect(cappedOperations.length).toBeGreaterThan(30);
    // Reads its body through `_lib/request-validation.ts`, not directly.
    expect(cappedOperations.map(({ where }) => where)).toContain(
      'POST /api/analyze-meal'
    );
  });

  it('lists PAYLOAD_TOO_LARGE on every operation whose handler caps its body', () => {
    const missing = cappedOperations
      .filter(({ op }) => !op?.responses['413'])
      .map(({ where }) => where);
    expect(missing).toEqual([]);
  });
});
