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

/** Lower-cased methods whose handler body calls a capped reader. */
function cappedMethods(file: string): string[] {
  const source = readFileSync(path.join(process.cwd(), 'app', file), 'utf8');
  const exports = [...source.matchAll(METHOD_EXPORT)];
  return exports
    .filter((match, i) => {
      const end = exports[i + 1]?.index ?? source.length;
      return CAPPED_READER.test(source.slice(match.index, end));
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
  });

  it('lists PAYLOAD_TOO_LARGE on every operation whose handler caps its body', () => {
    const missing = cappedOperations
      .filter(({ op }) => !op?.responses['413'])
      .map(({ where }) => where);
    expect(missing).toEqual([]);
  });
});
