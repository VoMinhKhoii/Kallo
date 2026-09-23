import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { routeInventory } from '@/lib/api/route-inventory';

/**
 * KALLO-08: a protected route must authenticate BEFORE it reads the body, so
 * an anonymous caller learns nothing but 401 and cannot make the server buffer
 * or parse a byte. The behavioural suite (`protected-body-routes.test.ts`)
 * covers the routes it lists; this source scan covers every `session` route in
 * `route-inventory.ts`, so a new handler -- or one that only authenticates
 * inside the action it delegates to -- cannot ship with the order reversed.
 *
 * For each exported method whose handler reads the body, the first auth-guard
 * call must come before the first body read. Comments are stripped first, so
 * prose that mentions `req.formData()` does not count as a read.
 */

const BODY_READ =
  /\b(?:readJsonBody|readBoundedJson|readBoundedBody)\(|\.(?:json|formData|arrayBuffer|text)\(\)/;
const AUTH_GUARD =
  /\b(?:requireUserId|requireUserWithAvatar|requireAuthAndProfile|requireSessionUser)\(|\.auth\.getUser\(/;
const METHOD_EXPORT =
  /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g;

/**
 * Session routes allowed to read before authenticating, each with its reason.
 * `/api/analyze-meal` reads its capped body alongside `getUser()` for latency
 * and still answers 401 first; it reads in `_lib`, so the scan cannot see it
 * anyway, but it is listed so the exception stays deliberate.
 */
const EXEMPT = new Map([
  ['api/analyze-meal/route.ts', 'parallel capped read; 401 still wins'],
]);

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

/** `[method, bodyReadAt, authAt]` for every handler that reads the body. */
function bodyReadingHandlers(file: string) {
  const source = stripComments(
    readFileSync(path.join(process.cwd(), 'app', file), 'utf8')
  );
  const exports = [...source.matchAll(METHOD_EXPORT)];
  return exports.flatMap((match, i) => {
    const handler = source.slice(match.index, exports[i + 1]?.index);
    const read = handler.search(BODY_READ);
    if (read === -1) return [];
    // A guard defined as a local helper (e.g. avatar's `requireSessionUser`)
    // lives outside the handler; only the CALL inside the handler counts.
    return [{ method: match[1], read, auth: handler.search(AUTH_GUARD) }];
  });
}

const sessionRoutes = Object.entries(routeInventory)
  .filter(([file, [auth]]) => auth === 'session' && !EXEMPT.has(file))
  .map(([file]) => file);

const handlers = sessionRoutes.flatMap((file) =>
  bodyReadingHandlers(file).map((h) => ({ ...h, where: `${h.method} ${file}` }))
);

describe('session routes authenticate before reading the body', () => {
  it('found the body-reading handlers', () => {
    // A broken scan would make the real assertion vacuously pass.
    expect(handlers.length).toBeGreaterThan(35);
  });

  it('calls an auth guard before the first body read in every handler', () => {
    const reversed = handlers
      .filter(({ read, auth }) => auth === -1 || auth > read)
      .map(({ where }) => where);
    expect(reversed).toEqual([]);
  });

  it('exempts only session routes that still exist', () => {
    const stale = [...EXEMPT.keys()].filter(
      (file) =>
        routeInventory[file as keyof typeof routeInventory]?.[0] !== 'session'
    );
    expect(stale).toEqual([]);
  });
});
