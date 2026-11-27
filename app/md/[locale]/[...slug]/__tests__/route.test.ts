import { describe, expect, it, vi } from 'vitest';
import { GET, generateStaticParams } from '@/app/md/[locale]/[...slug]/route';
import { locales } from '@/i18n/config';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';
import { negotiate } from '@/lib/infra/http/negotiate';
import { siteMarkdownPaths } from '@/lib/seo/markdown/site-pages';

// `cacheLife()` only works inside a Next render; the caching itself is Next's
// concern, so here it is a no-op and the function runs as plain code.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }));

function call(locale: string, slug: string[]) {
  return GET(new Request('https://kallo.fit/md'), {
    params: Promise.resolve({ locale, slug }),
  });
}

describe('generateStaticParams', () => {
  it('covers the landing page, the 404 and every doc in every locale', () => {
    // Load-bearing, not an optimisation: `content/` is not copied into the
    // standalone Docker image, so anything not prerendered here would ENOENT
    // in production.
    const params = generateStaticParams();
    const sitePages = locales.flatMap(siteMarkdownPaths).length;
    expect(params).toHaveLength(
      locales.length * (DOCS_SLUGS.length + 2) + sitePages
    );

    for (const locale of locales) {
      expect(params).toContainEqual({ locale, slug: ['index'] });
      expect(params).toContainEqual({ locale, slug: ['not-found'] });
      for (const slug of DOCS_SLUGS) {
        expect(params).toContainEqual({
          locale,
          slug: ['docs', ...slug.split('/')],
        });
      }
      for (const path of siteMarkdownPaths(locale)) {
        expect(params).toContainEqual({
          locale,
          slug: path.slice(1).split('/'),
        });
      }
    }
  });
});

describe('the public pages outside the docs', () => {
  // Every page the route lists must render, and the proxy must send its URL
  // here: the two lists are kept apart so the proxy never loads the copy.
  it.each(
    locales
  )('renders every one in %s, and negotiation routes each one here', async (locale) => {
    const paths = siteMarkdownPaths(locale);
    expect(paths.length).toBeGreaterThan(5);
    for (const path of paths) {
      const url = `/${locale}${path}`;
      expect(
        negotiate({ pathname: url, accept: 'text/markdown', method: 'GET' }),
        url
      ).toEqual({ kind: 'markdown', rewriteTo: `/md${url}` });

      const response = await call(locale, path.slice(1).split('/'));
      expect(response.status, url).toBe(200);
      const body = await response.text();
      expect(body.match(/^# /gm), url).toHaveLength(1);
      expect(body, url).not.toMatch(/undefined|\[object Object\]|NaN/);
      // Links are absolute: an agent has no base URL to resolve against.
      expect(body, url).not.toMatch(/\]\(\//);
    }
  });

  it('carries the food page numbers: the summary table and each meal', async () => {
    const body = await (
      await call('en', ['calories', 'chicken-burrito'])
    ).text();
    expect(body).toMatch(
      /^\| Meal \| Calories \| Protein \| Carbs \| Fat \|$/m
    );
    expect(body.match(/^### /gm)?.length).toBeGreaterThanOrEqual(4);
    // Translations are mocked to their keys here: the card's `total`.
    expect(body).toMatch(/\| \*\*total\*\* \| \d+ kcal \| \d+g \|/);
    expect(body).toContain('https://kallo.fit/en/data/meal-calorie-variation');
  });

  it('writes a Vietnamese food page in Vietnamese', async () => {
    const body = await (await call('vi', ['calories', 'pho-bo'])).text();
    expect(body).toMatch(/^\| Bữa \| Calo \| Đạm \| Tinh bột \| Chất béo \|$/m);
    expect(body).not.toContain('**Total**');
  });

  it('gives pricing the plans and the new-account offer', async () => {
    const body = await (await call('en', ['pricing'])).text();
    // Translations are mocked to their keys here.
    for (const key of ['plans.free.name', 'plans.premium.name', 'offerNote']) {
      expect(body).toContain(key);
    }
    // Lifetime cannot be bought on the web, and the page does not show it.
    expect(body).not.toContain('lifetime');
    expect(body).toContain('https://kallo.fit/en/docs/account/premium');
  });

  it('404s a page the locale does not have', async () => {
    for (const slug of [
      ['calories', 'pho-bo'],
      ['compare', 'kallo-vs-cal-ai'],
      ['tools', 'nope'],
    ]) {
      const locale = slug[0] === 'compare' ? 'vi' : 'en';
      expect((await call(locale, slug)).status, slug.join('/')).toBe(404);
    }
  });
});

describe('the markdown route', () => {
  it('serves a doc as markdown with a title, a body and the right headers', async () => {
    const response = await call('en', ['docs', 'overview']);
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe(
      'text/markdown; charset=utf-8'
    );
    // Without Accept in Vary a CDN can hand the cached HTML to an agent that
    // asked for Markdown.
    expect(response.headers.get('Vary')).toContain('Accept');
    // The canonical URL is the HTML page; this must never compete with it.
    expect(response.headers.get('X-Robots-Tag')).toBe('noindex');

    const body = await response.text();
    expect(body.startsWith('# ')).toBe(true);
    expect(body).toContain('Last updated:');
    expect(body).toContain('https://kallo.fit/en/docs/overview');
    expect(body.length).toBeGreaterThan(500);
  });

  it('serves the Vietnamese tree too', async () => {
    const body = await (await call('vi', ['docs', 'overview'])).text();
    expect(body).toContain('https://kallo.fit/vi/docs/overview');
  });

  it('serves a nested doc slug', async () => {
    const response = await call('en', ['docs', 'logging', 'barcode']);
    expect(response.status).toBe(200);
    expect(await response.text()).toContain('/en/docs/logging/barcode');
  });

  it('serves the landing page', async () => {
    const response = await call('en', ['index']);
    expect(response.status).toBe(200);
    const body = await response.text();
    expect(body.startsWith('# ')).toBe(true);
    expect(body.match(/^# /gm)).toHaveLength(1);
    expect(body.match(/^## /gm)?.length).toBeGreaterThanOrEqual(4);
    expect(body.length).toBeGreaterThan(500);
    expect(body).toContain('/openapi.json');
  });

  it.each([
    'en',
    'vi',
  ])('serves substantial About, Contact and Privacy trust pages in %s', async (locale) => {
    for (const slug of [
      ['company', 'about'],
      ['company', 'contact'],
      ['legal', 'privacy'],
    ]) {
      const response = await call(locale, ['docs', ...slug]);
      expect(response.status, `${locale}/${slug.join('/')}`).toBe(200);

      const body = await response.text();
      expect(body.startsWith('# '), `${locale}/${slug.join('/')}`).toBe(true);
      expect(body.length, `${locale}/${slug.join('/')}`).toBeGreaterThan(500);
    }
  });

  it('answers the 404 slug with a 404 and recovery links', async () => {
    const response = await call('en', ['not-found']);
    expect(response.status).toBe(404);
    expect(response.headers.get('Content-Type')).toContain('text/markdown');

    const body = await response.text();
    for (const link of ['/llms.txt', '/sitemap.xml', '/openapi.json']) {
      expect(body).toContain(link);
    }
  });

  it('404s an unknown doc slug rather than rendering an empty page', async () => {
    const response = await call('en', ['docs', 'no-such-doc']);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('/llms.txt');
  });

  it('falls back to English for an unknown locale', async () => {
    const response = await call('de', ['index']);
    expect(response.status).toBe(404);
    expect(await response.text()).toContain('/en/docs/overview');
  });
});
