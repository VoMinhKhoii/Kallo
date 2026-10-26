import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';

// `app/robots.ts` reads `routing` from `@/i18n/routing`, which holds nothing but
// the locale config — unlike `@/i18n/navigation`, which the global setup mocks —
// so it is stubbed to the same locale list rather than pulled in for real.
vi.mock('@/i18n/routing', () => ({
  routing: { locales, defaultLocale: 'en' },
}));

const { default: robots } = await import('@/app/robots');

import {
  isKnownNonMarkdownPath,
  ROBOTS_DISALLOWED_PREFIXES,
} from '@/lib/seo/private-paths';

const rules = robots().rules as { disallow: string[] };

describe('robots.txt', () => {
  it('disallows every private surface, per locale', () => {
    // robots path matching is a literal prefix from the start of the path, so
    // a bare /dashboard would not match /en/dashboard.
    for (const locale of locales) {
      for (const prefix of ROBOTS_DISALLOWED_PREFIXES) {
        expect(rules.disallow).toContain(`/${locale}${prefix}`);
      }
    }
    expect(rules.disallow).toContain('/api/');
    expect(rules.disallow).toContain('/auth/');
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toBe('https://kallo.fit/sitemap.xml');
  });

  it('carries no Yandex-only Host directive', () => {
    expect(robots()).not.toHaveProperty('host');
  });
});

describe('isKnownNonMarkdownPath', () => {
  it('matches a prefix and its children, not a lookalike', () => {
    expect(isKnownNonMarkdownPath('/dashboard')).toBe(true);
    expect(isKnownNonMarkdownPath('/dashboard/anything')).toBe(true);
    expect(isKnownNonMarkdownPath('/dashboards')).toBe(false);
    expect(isKnownNonMarkdownPath('/docs/overview')).toBe(false);
  });
});
