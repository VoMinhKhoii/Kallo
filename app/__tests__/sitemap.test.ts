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
  it('lists the English food hub and each English page once', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(
      urls.filter((url) => url === `${SITE_URL}/en/calories`)
    ).toHaveLength(1);
    for (const slug of FOOD_SLUGS.en) {
      expect(
        urls.filter((url) => url === `${SITE_URL}/en/calories/${slug}`)
      ).toHaveLength(1);
    }
  });

  it('lists the Vietnamese food hub and each Vietnamese page once', async () => {
    const urls = (await sitemap()).map((entry) => entry.url);
    expect(
      urls.filter((url) => url === `${SITE_URL}/vi/calories`)
    ).toHaveLength(1);
    for (const slug of FOOD_SLUGS.vi) {
      expect(
        urls.filter((url) => url === `${SITE_URL}/vi/calories/${slug}`)
      ).toHaveLength(1);
    }
  });

  it('never lists a slug under the other locale', async () => {
    const urls = new Set((await sitemap()).map((entry) => entry.url));
    for (const slug of FOOD_SLUGS.en) {
      expect(urls.has(`${SITE_URL}/vi/calories/${slug}`), slug).toBe(false);
    }
    for (const slug of FOOD_SLUGS.vi) {
      expect(urls.has(`${SITE_URL}/en/calories/${slug}`), slug).toBe(false);
    }
  });

  it('pairs the two hubs, but no food page, as language alternates', async () => {
    const entries = await sitemap();
    const hub = entries.find((e) => e.url === `${SITE_URL}/vi/calories`);
    expect(hub?.alternates?.languages).toEqual({
      en: `${SITE_URL}/en/calories`,
      vi: `${SITE_URL}/vi/calories`,
      'x-default': `${SITE_URL}/en/calories`,
    });
    const pages = entries.filter((e) => /\/calories\/[^/]+$/.test(e.url));
    expect(pages).toHaveLength(FOOD_SLUGS.en.length + FOOD_SLUGS.vi.length);
    for (const page of pages) expect(page.alternates, page.url).toBeUndefined();
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
