import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { routeInventory } from '@/lib/api/route-inventory';
import { rateLimitPolicies } from '@/lib/infra/rate-limit/limiter/limiter';

/**
 * The anti-erosion gate. `route-inventory.ts` is a hand-maintained declaration
 * of how every route handler is protected; this test proves it stays in
 * one-to-one correspondence with the route files on disk. A new route that
 * nobody declared fails here -- with an actionable message -- rather than
 * shipping unguarded and unnoticed. A declaration for a route that was deleted
 * fails too, so the map cannot rot into a list of endpoints that no longer
 * exist.
 *
 * Coverage alone was not enough, because a declaration can be honestly written
 * and then quietly falsified by a later edit to the route. Two of its three
 * claims are therefore checked against the route SOURCE:
 *
 *  - `bodyBound` versus what the file actually calls. Both directions are a
 *    lie worth failing on: claiming a bound that is not there hides an
 *    unbounded buffer from review, and claiming none when the route bounds its
 *    body makes the map read as if a hole existed.
 *  - a named `RateLimitPolicyName` versus a real `assertRateLimit(` call. Some
 *    routes limit at the edge and some delegate to an action (the web calls
 *    the same action directly, so the guard belongs there); the entry names
 *    that file in `guardedIn`, and the check follows it.
 *
 * `auth` and `none-cheap` stay unverified on purpose -- both are judgements
 * about what a route COSTS and who may call it, which no regex can make. That
 * is the review gate, not a machine check.
 */

const APP_ROOT = path.join(process.cwd(), 'app');
const REPO_ROOT = process.cwd();

/**
 * A body read with no ceiling on it. `readJsonBody` (lib/api/auth.ts) is a thin
 * `request.json()` wrapper that maps malformed JSON to a 400 -- it adds no cap,
 * so it counts as a read, not as a bound.
 */
const BODY_READ =
  /\breq(uest)?\.(json|formData|text|arrayBuffer)\(|readJsonBody\(/;
const BOUNDED = /readBounded(Json|Body|WebhookBody)|['"]content-length['"]/;

/** Every `route.ts`/`route.tsx` under `app`, as `app`-relative POSIX paths --
 *  the same key shape `route-inventory.ts` uses. */
function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/^route\.tsx?$/.test(entry.name)) {
      out.push(path.relative(APP_ROOT, full).split(path.sep).join('/'));
    }
  }
  return out;
}

const routeFiles = walk(APP_ROOT);
const declared = new Set(Object.keys(routeInventory));
const entries = Object.entries(routeInventory) as [
  string,
  readonly [string, boolean, string, string?],
][];

function readSource(repoRelativePath: string): string {
  return readFileSync(path.join(REPO_ROOT, repoRelativePath), 'utf8');
}

describe('route inventory covers every route handler', () => {
  it('found the route tree', () => {
    // A broken walk would make the coverage assertions vacuously pass.
    expect(routeFiles.length).toBeGreaterThan(50);
  });

  it('reaches beyond app/api', () => {
    // The walk used to start at `app/api`, which is how six handlers -- two of
    // them anonymous endpoints that call GoTrue -- stayed outside the map.
    expect(routeFiles).toContain('auth/verify/route.ts');
    expect(routeFiles).toContain('auth/callback/route.ts');
  });

  it('declares every route file on disk', () => {
    const undeclared = routeFiles.filter((file) => !declared.has(file));
    expect(
      undeclared,
      `These route files are not in lib/api/route-inventory.ts -- add each one, ` +
        `declaring its auth, body-bound status, and rate-limit:\n  ${undeclared
          .map((file) => `app/${file}`)
          .join('\n  ')}`
    ).toEqual([]);
  });

  it('has no stale entries', () => {
    const onDisk = new Set(routeFiles);
    const stale = [...declared].filter((file) => !onDisk.has(file));
    expect(
      stale,
      `These lib/api/route-inventory.ts entries have no route file -- remove them:\n  ${stale
        .map((file) => `app/${file}`)
        .join('\n  ')}`
    ).toEqual([]);
  });
});

describe('the declarations agree with the route source', () => {
  it('never claims a body bound the route does not have', () => {
    const wrong = entries
      .filter(([file, [, bodyBound]]) => {
        if (!bodyBound) return false;
        const source = readSource(`app/${file}`);
        return BODY_READ.test(source) && !BOUNDED.test(source);
      })
      .map(([file]) => file);
    expect(
      wrong,
      `These entries declare bodyBound: true but read the body with no cap -- ` +
        `use readBoundedJson/readBoundedBody (or an explicit content-length ` +
        `guard), or correct the declaration:\n  ${wrong
          .map((file) => `app/${file}`)
          .join('\n  ')}`
    ).toEqual([]);
  });

  it('never hides a body bound the route does have', () => {
    const wrong = entries
      .filter(
        ([file, [, bodyBound]]) =>
          !bodyBound && BOUNDED.test(readSource(`app/${file}`))
      )
      .map(([file]) => file);
    expect(
      wrong,
      `These entries declare bodyBound: false but the route DOES bound its ` +
        `body -- flip the declaration to true:\n  ${wrong
          .map((file) => `app/${file}`)
          .join('\n  ')}`
    ).toEqual([]);
  });

  it('applies every policy it names, at the route or in the file it delegates to', () => {
    const missing = entries
      .filter(([, [, , rateLimit]]) => rateLimit in rateLimitPolicies)
      .filter(
        ([file, [, , , guardedIn]]) =>
          // `guardedIn` names the action that carries the guard for the routes
          // that delegate; without it, the call must be in the route itself.
          !/assertRateLimit\(/.test(readSource(guardedIn ?? `app/${file}`))
      )
      .map(([file, [, , rateLimit, guardedIn]]) =>
        guardedIn
          ? `${file} -> ${guardedIn} (${rateLimit})`
          : `${file} (${rateLimit})`
      );
    expect(
      missing,
      `These entries name a rate-limit policy that nothing applies -- add the ` +
        `assertRateLimit call, point guardedIn at the file that has it, or ` +
        `stop claiming the policy:\n  ${missing.join('\n  ')}`
    ).toEqual([]);
  });

  it('checked a meaningful number of policy claims', () => {
    // Guards the assertion above against a typo that filters everything out.
    const named = entries.filter(
      ([, [, , rateLimit]]) => rateLimit in rateLimitPolicies
    );
    expect(named.length).toBeGreaterThan(10);
  });
});
