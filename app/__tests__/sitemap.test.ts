import { describe, expect, it, vi } from 'vitest';
import { locales } from '@/i18n/config';

// As in robots.test.ts: the routing module is stubbed to the locale list.
vi.mock('@/i18n/routing', () => ({
  routing: { locales, defaultLocale: 'en' },
}));
// The docs' dates come from MDX frontmatter, which Vitest cannot import; the
// docs entries are not what this file tests.
vi.mock('@/lib/domain/docs/loader', () => ({
  loadFrontmatter: async () => null,
}));

const { default: sitemap } = await import('@/app/sitemap');
const { FOOD_SLUGS } = await import('@/lib/seo/food-pages/pages');
const { SITE_URL } = await import('@/lib/seo/site');

describe('sitemap', () => {
  it('lists each food page once, in English only', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    for (const slug of FOOD_SLUGS) {
      expect(
        urls.filter((url) => url === `${SITE_URL}/en/calories/${slug}`)
      ).toHaveLength(1);
    }
    expect(urls.some((url) => url.includes('/vi/calories/'))).toBe(false);
  });
});
