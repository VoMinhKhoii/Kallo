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
const { FOOD_SLUGS } = await import('@/lib/seo/food-pages/slugs');
const { SITE_URL } = await import('@/lib/seo/site');
const { TOOL_SLUGS } = await import('@/lib/seo/tools/slugs');

describe('sitemap', () => {
  it('lists the food hub and each food page once, in English only', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(
      urls.filter((url) => url === `${SITE_URL}/en/calories`)
    ).toHaveLength(1);
    for (const slug of FOOD_SLUGS) {
      expect(
        urls.filter((url) => url === `${SITE_URL}/en/calories/${slug}`)
      ).toHaveLength(1);
    }
    expect(urls.some((url) => url.includes('/vi/calories/'))).toBe(false);
  });

  it('lists the tools hub and every tool once per locale, with alternates', async () => {
    const entries = await sitemap();
    for (const locale of locales) {
      for (const path of ['/tools', ...TOOL_SLUGS.map((s) => `/tools/${s}`)]) {
        const hits = entries.filter(
          (entry) => entry.url === `${SITE_URL}/${locale}${path}`
        );
        expect(hits, path).toHaveLength(1);
        expect(hits[0].alternates?.languages).toMatchObject({
          en: `${SITE_URL}/en${path}`,
          vi: `${SITE_URL}/vi${path}`,
        });
      }
    }
  });
});
