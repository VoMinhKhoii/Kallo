import { describe, expect, it } from 'vitest';
import { pageProblems, robotsProblems } from '../crawl-check';

const URL = 'https://kallo.fit/en/calories/pad-thai';

function page({
  head = `<title>Pad thai calories</title><meta name="description" content="x"/><link rel="canonical" href="${URL}"/>`,
  body = '<main><article><h1>Pad thai</h1></article></main><footer></footer>',
} = {}) {
  return `<html><head>${head}</head><body>${body}</body></html>`;
}

describe('pageProblems', () => {
  it('passes a page a crawler can read', () => {
    expect(pageProblems(URL, page())).toEqual([]);
  });

  it('catches the article streamed hidden after the footer', () => {
    // What every food page shipped before #561: the shell, then the footer,
    // then the article in a hidden block a script moves into place.
    const body =
      '<main><template id="B:1"></template></main><footer></footer><div hidden id="S:1"><article><h1>Pad thai</h1></article></div>';
    expect(pageProblems(URL, page({ body }))).toEqual([
      '<h1> comes after the footer (article outlined into a hidden block)',
    ]);
  });

  it('catches noindex, a foreign canonical and a missing description', () => {
    const head =
      '<title>t</title><meta name="robots" content="noindex"/><link rel="canonical" href="https://kallo.fit/en"/>';
    expect(pageProblems(URL, page({ head }))).toEqual([
      'canonical is https://kallo.fit/en',
      'no meta description',
      'noindex',
    ]);
  });

  it('catches a page with no <main> or <h1>', () => {
    expect(pageProblems(URL, page({ body: '<div></div>' }))).toEqual([
      'no <main>',
      'no <h1>',
    ]);
  });
});

describe('robotsProblems', () => {
  const ok =
    'User-Agent: *\nAllow: /\nDisallow: /api/\n\nSitemap: https://kallo.fit/sitemap.xml\n';

  it('passes the live shape', () => {
    expect(robotsProblems(ok)).toEqual([]);
  });

  it('catches a site-wide block and a missing sitemap line', () => {
    expect(robotsProblems('User-Agent: *\nDisallow: /\n')).toEqual([
      'robots.txt disallows the whole site',
      'robots.txt does not name the sitemap',
    ]);
  });
});
