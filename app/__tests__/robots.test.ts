import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';

// The global setup mocks `@/i18n/navigation` for component tests and does not
// export `routing`, which `app/robots.ts` reads. Importing the real module here
// is not an option either — it builds next-intl's navigation helpers, which
// pull in `next/navigation`. The locale list is the only piece robots needs.
vi.mock('@/i18n/navigation', () => ({
  routing: { locales, defaultLocale: 'en' },
}));

const { default: robots } = await import('@/app/robots');

import {
  isKnownNonMarkdownPath,
  PRIVATE_PATH_PREFIXES,
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

  it('does not advertise the admin surface', () => {
    // Listing /admin would tell an attacker it exists. It is gated by
    // ADMIN_EMAILS; a robots entry only helps enumeration.
    expect(rules.disallow.join(' ')).not.toContain('admin');
  });

  it('keeps /admin in the negotiation list even though robots omits it', () => {
    // The two lists diverge on exactly one entry, and on purpose. If they ever
    // silently converge, markdown negotiation would start answering /admin
    // paths with a 404 instead of letting them render.
    expect(PRIVATE_PATH_PREFIXES).toContain('/admin');
    expect(ROBOTS_DISALLOWED_PREFIXES).not.toContain('/admin');
    expect(isKnownNonMarkdownPath('/admin/health')).toBe(true);
  });

  it('points at the sitemap', () => {
    expect(robots().sitemap).toBe('https://kallo.fit/sitemap.xml');
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
