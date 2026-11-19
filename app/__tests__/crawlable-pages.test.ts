import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * React outlines a Suspense boundary over 12.8 KB: the content ships as a
 * hidden block after the footer and a script moves it into place, so a crawler
 * that runs no JavaScript sees an empty page. Tests and `tsc` cannot see that,
 * and the page looks right in a browser, so this holds the line in the source.
 */
const PUBLIC_PAGES = [
  'app/[locale]/docs/[...slug]/page.tsx',
  'app/[locale]/calories/page.tsx',
  'app/[locale]/calories/[food]/page.tsx',
  'app/[locale]/tools/page.tsx',
  'app/[locale]/tools/[tool]/page.tsx',
  'app/[locale]/data/meal-calorie-variation/page.tsx',
  // The alternatives and "Kallo vs" pages render their article here.
  'components/seo/vendor-article.tsx',
];

describe('public pages render their article outside Suspense', () => {
  it.each(PUBLIC_PAGES)('%s', (path) => {
    const source = readFileSync(path, 'utf8');
    const article = source.search(/<article|<Content\b/);
    expect(article).toBeGreaterThan(-1);
    expect(source.slice(0, article)).not.toContain('<Suspense fallback');
  });
});
