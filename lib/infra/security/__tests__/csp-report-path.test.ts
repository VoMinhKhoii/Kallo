import { describe, expect, it } from 'vitest';
import { routeTemplate } from '@/lib/infra/security/csp-report-path';

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
  ])('redacts %s', (path, expected) => {
    expect(routeTemplate(path)).toBe(expected);
  });

  it('drops the query string that carries auth-link and waitlist tokens', () => {
    expect(routeTemplate('/auth/callback?code=secret')).toBe('/auth/callback');
    expect(routeTemplate('/auth/verify?token_hash=secret&type=email')).toBe(
      '/auth/verify'
    );
    expect(routeTemplate('/en/waitlist/confirm?token=secret')).toBe(
      '/en/waitlist/confirm'
    );
  });

  it('keeps static route words and build asset filenames', () => {
    expect(routeTemplate('/en/settings')).toBe('/en/settings');
    expect(routeTemplate('/_next/static/chunks/2-7bhno9t4lal.js')).toBe(
      '/_next/static/chunks/2-7bhno9t4lal.js'
    );
    expect(routeTemplate('/gsi/client')).toBe('/gsi/client');
  });

  it('redacts unknown segments by default, including encoded and malformed ones', () => {
    expect(routeTemplate('/en/something-new/value')).toBe('/en/:param/:param');
    expect(routeTemplate('/en/invite/%E0%A4%A')).toBe('/en/invite/:param');
    expect(routeTemplate('/')).toBe('/');
  });
});
