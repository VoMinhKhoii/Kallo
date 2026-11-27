import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';

// `lib/seo/robots.ts` reads `routing` from `@/i18n/routing`, which holds
// nothing but the locale config — unlike `@/i18n/navigation`, which the global
// setup mocks — so it is stubbed to the same locale list rather than pulled in
// for real.
vi.mock('@/i18n/routing', () => ({
  routing: { locales, defaultLocale: 'en' },
}));

const { GET } = await import('@/app/robots.txt/route');

import { ROBOTS_DISALLOWED_PREFIXES } from '@/lib/seo/private-paths';

const response = GET();
const text = await response.text();
const lines = text.split('\n');

describe('robots.txt', () => {
  it('is plain text', () => {
    expect(response.headers.get('Content-Type')).toBe(
      'text/plain; charset=utf-8'
    );
  });

  it('disallows every private surface, per locale', () => {
    // robots path matching is a literal prefix from the start of the path, so
    // a bare /dashboard would not match /en/dashboard.
    for (const locale of locales) {
      for (const prefix of ROBOTS_DISALLOWED_PREFIXES) {
        expect(lines).toContain(`Disallow: /${locale}${prefix}`);
      }
    }
    expect(lines).toContain('Disallow: /api/');
    expect(lines).toContain('Disallow: /auth/');
  });

  it('opens one group for every crawler, with the content signal in it', () => {
    // A signal outside a User-Agent group belongs to no crawler.
    expect(lines.slice(0, 3)).toEqual([
      'User-Agent: *',
      'Content-Signal: search=yes, ai-input=yes, ai-train=yes',
      'Allow: /',
    ]);
    expect(text.match(/^User-Agent:/gm)).toHaveLength(1);
  });

  it('points at the sitemap and the feed', () => {
    expect(lines).toContain('Sitemap: https://kallo.fit/sitemap.xml');
    expect(lines).toContain('Sitemap: https://kallo.fit/feed.xml');
  });

  it('carries no Yandex-only Host directive', () => {
    expect(text).not.toMatch(/^Host:/im);
  });
});
