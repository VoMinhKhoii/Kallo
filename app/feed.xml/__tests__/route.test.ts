import { describe, expect, it } from 'vitest';
import { GET } from '@/app/feed.xml/route';
import { pagesOf } from '@/lib/seo/food-pages/pages';
import { FOOD_PAGE_LOCALES } from '@/lib/seo/food-pages/slugs';

describe('/feed.xml', () => {
  it('lists every food page once, in Atom', async () => {
    const response = GET();
    const body = await response.text();
    expect(response.headers.get('Content-Type')).toContain(
      'application/atom+xml'
    );
    const total = FOOD_PAGE_LOCALES.flatMap(pagesOf).length;
    expect(body.match(/<entry /g)).toHaveLength(total);
    const ids = [...body.matchAll(/<id>(.*?)<\/id>/g)].map((m) => m[1]);
    expect(new Set(ids.slice(1)).size).toBe(total);
  });

  it('escapes page copy, so a title cannot break the XML', async () => {
    const body = await GET().text();
    expect(body).not.toMatch(/&(?!amp;|lt;|gt;)/);
  });
});
