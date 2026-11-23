import boost from './search-boost.json';

/**
 * Food pages Google already ranks just short of the top three: an average
 * position of 4 to 15 over the last 90 days, from Search Console. These move
 * the most from a few more internal links, so the other pages' link lists
 * put them first.
 *
 * `search-boost.json` is written by the weekly SEO review
 * (`gsc.py anchors --write <repo>` in the kallo-seo-routine skill) and lands
 * through a PR like any other change. A slug that no longer has a page is
 * ignored.
 */
const STRIKING = new Set(Object.keys(boost.pages));

export function inStrikingDistance(slug: string): boolean {
  return STRIKING.has(slug);
}
