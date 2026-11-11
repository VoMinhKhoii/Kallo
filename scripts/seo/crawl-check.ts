/**
 * Read the site the way a crawler that runs no JavaScript does, and fail on
 * the regressions that take pages out of search without anything else
 * noticing: a page turns noindex, a canonical points elsewhere, a 200 becomes
 * a 404, robots.txt blocks everything, or the article ships hidden after the
 * footer (React outlines a Suspense boundary over 12.8 KB; on 2026-11-07 every
 * food, tool and data page did this while Lighthouse scored 100).
 *
 * CI runs it against the fresh build; the prod deploy runs it against the
 * candidate revision before it takes traffic.
 *
 * Usage:
 *   bun scripts/seo/crawl-check.ts <base-url> [--live https://kallo.fit]
 *
 * `--live` also fetches the live sitemap: a page live lists that the build
 * answers 404 for was deleted without a redirect. ORIGIN_SHARED_SECRET, when
 * set, is sent as X-Origin-Verify (Cloud Run behind the origin lock).
 */

import { SITE_URL } from '@/lib/seo/site';
import { isMainModule } from '../_lib/runtime';
import { sitemapUrls } from './indexnow';

const UA = 'Mozilla/5.0 (compatible; kallo-crawl-check/1.0)';
const UNKNOWN_FOOD_PAGE = '/en/calories/not-a-real-food-crawl-check';

/** What is wrong with one page's HTML, as a crawler reads it. */
export function pageProblems(canonicalUrl: string, html: string): string[] {
  const problems: string[] = [];
  const canonical = /<link[^>]+rel="canonical"[^>]+href="([^"]+)"/.exec(
    html
  )?.[1];
  if (canonical?.replace(/\/$/, '') !== canonicalUrl.replace(/\/$/, '')) {
    problems.push(`canonical is ${canonical ?? 'missing'}`);
  }
  const titles = html.match(/<title[ >]/g)?.length ?? 0;
  if (titles !== 1) problems.push(`${titles} <title> tags`);
  if (!/<meta[^>]+name="description"/.test(html)) {
    problems.push('no meta description');
  }
  if (/<meta[^>]+name="robots"[^>]+noindex/.test(html)) {
    problems.push('noindex');
  }
  if (!html.includes('<main')) problems.push('no <main>');
  const h1 = html.indexOf('<h1');
  const footer = html.indexOf('<footer');
  if (h1 < 0) {
    problems.push('no <h1>');
  } else if (footer >= 0 && h1 > footer) {
    problems.push(
      '<h1> comes after the footer (article outlined into a hidden block)'
    );
  }
  return problems;
}

/** What is wrong with robots.txt. */
export function robotsProblems(robots: string): string[] {
  const problems: string[] = [];
  if (/^Disallow:\s*\/\s*$/im.test(robots)) {
    problems.push('robots.txt disallows the whole site');
  }
  if (!robots.includes(`Sitemap: ${SITE_URL}/sitemap.xml`)) {
    problems.push('robots.txt does not name the sitemap');
  }
  return problems;
}

function fetchPage(base: string, path: string) {
  const headers: Record<string, string> = { 'User-Agent': UA };
  const secret = process.env.ORIGIN_SHARED_SECRET;
  if (secret) headers['X-Origin-Verify'] = secret;
  // Not following redirects: a sitemap URL that redirects is a problem too.
  return fetch(new URL(path, base), {
    headers,
    redirect: 'manual',
    signal: AbortSignal.timeout(30_000),
  });
}

async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (t: T) => Promise<R>
) {
  const out: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const i = next++;
      out[i] = await fn(items[i]);
    }
  };
  await Promise.all(Array.from({ length: limit }, worker));
  return out;
}

/** Fetch each URL's path from `base`, six at a time, and collect `rule`'s problems. */
async function checkEach(
  base: string,
  urls: string[],
  rule: (url: string, res: Response) => Promise<string[]> | string[]
) {
  const results = await mapLimit(urls, 6, async (url) => {
    const { pathname } = new URL(url);
    const res = await fetchPage(base, pathname);
    return (await rule(url, res)).map((p) => `${pathname}: ${p}`);
  });
  return results.flat();
}

async function robotsFileProblems(base: string) {
  const robots = await fetchPage(base, '/robots.txt');
  return robots.ok
    ? robotsProblems(await robots.text())
    : [`robots.txt: HTTP ${robots.status}`];
}

function sitemapPageProblems(base: string, urls: string[]) {
  return checkEach(base, urls, async (url, res) => {
    if (res.status !== 200) return [`HTTP ${res.status}`];
    if (/noindex/i.test(res.headers.get('x-robots-tag') ?? '')) {
      return ['X-Robots-Tag noindex'];
    }
    return pageProblems(url, await res.text());
  });
}

async function unknownPageProblems(base: string) {
  const { status } = await fetchPage(base, UNKNOWN_FOOD_PAGE);
  return status === 404
    ? []
    : [`${UNKNOWN_FOOD_PAGE}: HTTP ${status}, expected 404`];
}

/** Pages the live sitemap lists that this build answers 404 or 410 for. */
async function removedPageProblems(base: string, live: string, ours: string[]) {
  const liveSitemap = await fetchPage(live, '/sitemap.xml');
  if (!liveSitemap.ok) {
    console.warn(
      `live sitemap HTTP ${liveSitemap.status}; skipped the removed-page check`
    );
    return [];
  }
  const kept = new Set(ours);
  const dropped = sitemapUrls(await liveSitemap.text()).filter(
    (u) => !kept.has(u)
  );
  return checkEach(base, dropped, (_url, res) =>
    res.status === 404 || res.status === 410
      ? [`live page now answers ${res.status}; redirect it instead`]
      : []
  );
}

export async function crawlCheck(base: string, live?: string) {
  const robots = await robotsFileProblems(base);
  const sitemap = await fetchPage(base, '/sitemap.xml');
  if (!sitemap.ok) return [...robots, `sitemap.xml: HTTP ${sitemap.status}`];
  const urls = sitemapUrls(await sitemap.text());
  if (urls.length === 0) return [...robots, 'sitemap.xml lists no URLs'];

  const problems = [
    ...robots,
    ...(await sitemapPageProblems(base, urls)),
    ...(await unknownPageProblems(base)),
    ...(live ? await removedPageProblems(base, live, urls) : []),
  ];
  console.log(`checked ${urls.length} sitemap URLs on ${base}`);
  return problems;
}

async function main() {
  const args = process.argv.slice(2);
  const [base] = args;
  const validLive = args.length === 3 && args[1] === '--live';
  if (!base || !(args.length === 1 || validLive)) {
    console.error(
      'usage: bun scripts/seo/crawl-check.ts <base-url> [--live <url>]'
    );
    process.exit(2);
  }
  const problems = await crawlCheck(base, validLive ? args[2] : undefined);
  for (const p of problems) console.error(`PROBLEM ${p}`);
  if (problems.length > 0) process.exit(1);
  console.log('no problems');
}

if (isMainModule(import.meta)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
