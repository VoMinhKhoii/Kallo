import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import type { PathItem } from '@/lib/api/openapi/components';
import { openApiDocument } from '@/lib/api/openapi/document';

/**
 * The spec is hand-written; the routes are not. This walks `app/api` and holds
 * the two honest to each other, so adding a route without documenting it — or
 * documenting one that no longer exists — fails here rather than shipping a
 * spec an agent will act on and be wrong about.
 */

const API_ROOT = path.join(process.cwd(), 'app', 'api');

/**
 * Route families excluded from the published spec, each for a stated reason.
 * Listed here rather than left to memory, so removing one is a deliberate act.
 */
const EXCLUDED = new Map([
  [
    '/api/webhooks/revenuecat',
    'signature-verified provider callback — no caller should ever invoke it',
  ],
  [
    '/api/auth/send-email',
    'Supabase Auth hook — signature-verified, provider-invoked only',
  ],
  ['/api/supabase-proxy/{path}', 'internal auth plumbing'],
  [
    '/api/analyze-meal/debug',
    'admin-only, and answers 404 rather than 403 to everyone else — documenting it would undo that',
  ],
  [
    '/api/analyze-meal',
    'server-sent events, not a request/response operation the spec models',
  ],
  ['/api/og/macro-card/{shareId}', 'internal Open Graph image renderer'],
  ['/api/{unmatched}', 'the catch-all that JSON-404s every unhandled path'],
]);

const HTTP_METHODS = ['get', 'post', 'put', 'patch', 'delete'] as const;

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(full, out);
    else if (/^route\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

/** `app/api/v1/meals/[mealId]/route.ts` → `/api/v1/meals/{mealId}`. */
function toSpecPath(file: string): string {
  const rel = path.relative(process.cwd(), file);
  return `/${rel
    .replace(/^app\//, '')
    .replace(/\/route\.tsx?$/, '')
    .split('/')
    .map((segment) =>
      segment.startsWith('[')
        ? `{${segment.replace(/[[\]]|\.\.\./g, '')}}`
        : segment
    )
    .join('/')}`;
}

function exportedMethods(file: string): string[] {
  const source = readFileSync(file, 'utf8');
  const declared = [
    ...source.matchAll(
      /export\s+(?:async\s+)?(?:function|const)\s+(GET|POST|PUT|PATCH|DELETE)\b/g
    ),
  ].map((match) => match[1].toLowerCase());
  return [...new Set(declared)].sort();
}

const routes = walk(API_ROOT)
  .map((file) => ({ path: toSpecPath(file), methods: exportedMethods(file) }))
  .filter((route) => !EXCLUDED.has(route.path));

const paths = openApiDocument().paths as Record<string, PathItem>;

describe('the spec matches the routes on disk', () => {
  it('found the route tree', () => {
    // A broken walk would make every other assertion vacuously pass.
    expect(routes.length).toBeGreaterThan(50);
  });

  it('documents every route file', () => {
    const undocumented = routes
      .filter((route) => !(route.path in paths))
      .map((route) => route.path);
    expect(undocumented).toEqual([]);
  });

  it('documents every exported method of every route', () => {
    const missing: string[] = [];
    for (const route of routes) {
      const documented = Object.keys(paths[route.path] ?? {}).sort();
      for (const method of route.methods) {
        if (!documented.includes(method)) {
          missing.push(`${method.toUpperCase()} ${route.path}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('documents no method a route does not export', () => {
    const byPath = new Map(routes.map((route) => [route.path, route.methods]));
    const phantom: string[] = [];
    for (const [specPath, item] of Object.entries(paths)) {
      const actual = byPath.get(specPath);
      if (!actual) {
        phantom.push(`${specPath} (no such route)`);
        continue;
      }
      for (const method of HTTP_METHODS) {
        if (item[method] && !actual.includes(method)) {
          phantom.push(`${method.toUpperCase()} ${specPath}`);
        }
      }
    }
    expect(phantom).toEqual([]);
  });

  it('excludes exactly the route families it claims to', () => {
    // Every exclusion must still exist on disk. A stale entry would silently
    // start hiding a route that was later added at that path.
    const onDisk = new Set(walk(API_ROOT).map(toSpecPath));
    const stale = [...EXCLUDED.keys()].filter((route) => !onDisk.has(route));
    expect(stale).toEqual([]);
  });
});
