import { describe, expect, it } from 'vitest';
import { GET, generateStaticParams } from '@/app/md/[locale]/[...slug]/route';
import { locales } from '@/i18n/config';
import { DOCS_SLUGS } from '@/lib/domain/docs/navigation';

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
    expect(params).toHaveLength(locales.length * (DOCS_SLUGS.length + 2));

    for (const locale of locales) {
      expect(params).toContainEqual({ locale, slug: ['index'] });
      expect(params).toContainEqual({ locale, slug: ['not-found'] });
      for (const slug of DOCS_SLUGS) {
        expect(params).toContainEqual({
          locale,
          slug: ['docs', ...slug.split('/')],
        });
      }
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
