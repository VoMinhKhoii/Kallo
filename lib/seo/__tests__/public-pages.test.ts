import { describe, expect, it } from 'vitest';
import { locales } from '@/i18n/config';
import { sitePage, sitePagePaths } from '@/lib/seo/public-pages';

describe('sitePage', () => {
  it('names every path its locale lists', () => {
    for (const locale of locales) {
      for (const path of sitePagePaths(locale)) {
        expect(sitePage(locale, path), `${locale}${path}`).not.toBeNull();
      }
    }
  });

  it('keeps each page to the locales it exists in', () => {
    // Each locale has its own dishes.
    expect(sitePage('vi', '/calories/pho-bo')).toEqual({
      kind: 'food',
      key: { locale: 'vi', slug: 'pho-bo' },
    });
    expect(sitePage('en', '/calories/pho-bo')).toBeNull();
    // Comparison and alternatives pages are English only.
    expect(sitePage('en', '/compare/kallo-vs-cal-ai')).not.toBeNull();
    expect(sitePage('vi', '/compare/kallo-vs-cal-ai')).toBeNull();
    expect(sitePage('vi', '/alternatives/cal-ai')).toBeNull();
    // Calculators and pricing exist everywhere.
    expect(sitePage('vi', '/tools/bmi-calculator')).toEqual({
      kind: 'tool',
      slug: 'bmi-calculator',
    });
    expect(sitePage('vi', '/pricing')).toEqual({ kind: 'pricing' });
  });

  it('rejects a folder, a mistyped slug or a page nested too deep', () => {
    for (const path of [
      '/compare',
      '/alternatives',
      '/tools/nope',
      '/calories/chicken-burrito/extra',
      '/data/meal-calorie-variation/extra',
      '/pricing/annual',
      '/docs/overview',
      '',
    ]) {
      expect(sitePage('en', path), path).toBeNull();
    }
  });
});
