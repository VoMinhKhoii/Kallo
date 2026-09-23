import { readdirSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { APP_ROUTE_PATTERNS } from '@/lib/infra/security/app-route-patterns';
import { routeTemplate } from '@/lib/infra/security/csp-report-path';

const APP_ROOT = path.join(process.cwd(), 'app');
const ROUTE_FILE = /^(?:page\.tsx|route\.tsx?)$/;

/** Every page / route handler under app/, as the URL pattern Next serves. */
function routePatternsOnDisk(dir = APP_ROOT, out = new Set<string>()) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== '__tests__') routePatternsOnDisk(full, out);
    } else if (ROUTE_FILE.test(entry.name)) {
      const url = path
        .relative(APP_ROOT, dir)
        .split(path.sep)
        .filter((segment) => segment && !/^\(.*\)$/.test(segment))
        .join('/');
      out.add(`/${url}`);
    }
  }
  return out;
}

describe('APP_ROUTE_PATTERNS', () => {
  // The redaction is only as good as this list: a `[param]` route missing
  // from it would be matched by a broader pattern, or not at all. Fails the
  // moment a page or route handler is added, moved or removed under app/.
  it('matches the route tree on disk exactly', () => {
    expect([...routePatternsOnDisk()].sort()).toEqual(
      [...APP_ROUTE_PATTERNS].sort()
    );
  });
});

describe('routeTemplate', () => {
  // Every dynamic route under app/ whose segment is a capability or an id.
  it.each([
    ['/en/invite/Xk9pQ2rT', '/en/invite/:param'],
    ['/vi/circle/7c9e6679-7425-40de-944b-e07fc1f09c7a', '/vi/circle/:param'],
    ['/en/circle/g/42f1', '/en/circle/g/:param'],
    ['/en/admin/feedback/123', '/en/admin/feedback/:param'],
    ['/en/admin/prompts/decomposition-v2', '/en/admin/prompts/:param'],
    ['/en/admin/requests/abc', '/en/admin/requests/:param'],
    ['/api/v1/groups/invite/Xk9pQ2rT', '/api/v1/groups/invite/:param'],
    ['/api/v1/groups/shares/s1', '/api/v1/groups/shares/:param'],
    ['/api/og/macro-card/s1', '/api/og/macro-card/:param'],
    ['/api/v1/meals/pending/a1', '/api/v1/meals/pending/:param'],
    [
      '/api/v1/chat-groups/g1/members/u1',
      '/api/v1/chat-groups/:param/members/:param',
    ],
    ['/api/v1/weight/2026-09-01', '/api/v1/weight/:param'],
  ])('redacts %s', (input, expected) => {
    expect(routeTemplate(input)).toBe(expected);
  });

  // Codex round 2 on #382: an invite handle may legitimately be spelled like
  // a route word. Position decides, never spelling.
  it.each([
    ['/en/invite/settings', '/en/invite/:param'],
    ['/en/invite/profile', '/en/invite/:param'],
    ['/en/circle/settings', '/en/circle/:param'],
    ['/api/v1/groups/invite/dashboard', '/api/v1/groups/invite/:param'],
  ])('redacts %s even though the value looks like a route word', (input, expected) => {
    expect(routeTemplate(input)).toBe(expected);
  });

  it('prefers the static route over a dynamic sibling, as Next does', () => {
    expect(routeTemplate('/en/circle/friends')).toBe('/en/circle/friends');
    expect(routeTemplate('/api/v1/groups/invite/accept')).toBe(
      '/api/v1/groups/invite/accept'
    );
  });

  it('drops the query string that carries auth-link tokens', () => {
    expect(routeTemplate('/auth/callback?code=secret')).toBe('/auth/callback');
    expect(routeTemplate('/auth/verify?token_hash=secret&type=email')).toBe(
      '/auth/verify'
    );
    expect(routeTemplate('/api/v1/waitlist/confirm?token=secret')).toBe(
      '/api/v1/waitlist/confirm'
    );
  });

  it('keeps our locales, static pages, metadata routes and build assets', () => {
    expect(routeTemplate('/en/settings')).toBe('/en/settings');
    expect(routeTemplate('/vi')).toBe('/vi');
    expect(routeTemplate('/')).toBe('/');
    expect(routeTemplate('/robots.txt')).toBe('/robots.txt');
    expect(routeTemplate('/_next/static/chunks/2-7bhno9t4lal.js')).toBe(
      '/_next/static/chunks/2-7bhno9t4lal.js'
    );
  });

  it('redacts catch-all tails and an unknown locale', () => {
    expect(routeTemplate('/en/docs/account/premium')).toBe(
      '/en/docs/:param/:param'
    );
    expect(routeTemplate('/en/anything/else')).toBe('/en/:param/:param');
    expect(routeTemplate('/xx/settings')).toBe('/:param/settings');
  });

  it('leaves nothing from an unknown or third-party path but its shape', () => {
    // Multi-segment paths fall into `[locale]/[...rest]`: every segment is a
    // dynamic position there, so every one is redacted.
    expect(routeTemplate('/gsi/client')).toBe('/:param/:param');
    expect(routeTemplate('/steal/tok_abc')).toBe('/:param/:param');
    expect(routeTemplate('/_next/static/chunks/not-an-asset')).toBe(
      '/:param/:param/:param/:param'
    );
    expect(routeTemplate('/tok_abc')).toBe('/:param');
  });
});
