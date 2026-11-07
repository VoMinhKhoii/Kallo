import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * React outlines a Suspense boundary over 12.8 KB: the content ships as a
 * hidden block after the footer and a script moves it into place, so a crawler
 * that runs no JavaScript sees an empty page. Tests and `tsc` cannot see that,
 * and the page looks right in a browser, so this holds the line in the source.
 */
const PUBLIC_PAGES = [
  'app/[locale]/calories/page.tsx',
  'app/[locale]/calories/[food]/page.tsx',
  'app/[locale]/tools/page.tsx',
  'app/[locale]/tools/[tool]/page.tsx',
  'app/[locale]/data/meal-calorie-variation/page.tsx',
];

describe('public pages render their article outside Suspense', () => {
  it.each(PUBLIC_PAGES)('%s', (path) => {
    const source = readFileSync(path, 'utf8');
    expect(source).toContain('<article');
    const beforeArticle = source.slice(0, source.indexOf('<article'));
    expect(beforeArticle).not.toContain('<Suspense fallback');
  });
});
