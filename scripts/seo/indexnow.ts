/**
 * Tell the IndexNow search engines which public pages exist, instead of waiting
 * for them to come and read the sitemap. IndexNow is Bing's protocol — and Bing
 * is also the index behind ChatGPT search, Copilot and DuckDuckGo — shared with
 * Yandex, Naver and Seznam. Google does not take part; it only reads the
 * sitemap.
 *
 * The engines prove the site is ours by fetching `public/<key>.txt`, so the key
 * is public by design, not a secret. Run this after a deploy that adds or
 * changes a public page (landing, pricing, docs). Resubmitting pages that have
 * not changed is what the protocol asks you not to do.
 *
 * Usage:
 *   bun scripts/seo/indexnow.ts             # every URL in the live sitemap
 *   bun scripts/seo/indexnow.ts <url> ...   # just these
 */

import { SITE_URL } from '@/lib/seo/site';
import { isMainModule } from '../_lib/runtime';

export const INDEXNOW_KEY = '7f3f1fbb3d4fed4ce067e1c9439987b4';
const ENDPOINT = 'https://api.indexnow.org/indexnow';

/** The page URLs a sitemap lists, once each. */
export function sitemapUrls(xml: string): string[] {
  return [
    ...new Set(Array.from(xml.matchAll(/<loc>([^<]+)<\/loc>/g), (m) => m[1])),
  ];
}

export function indexNowPayload(urlList: string[]) {
  return {
    host: new URL(SITE_URL).host,
    key: INDEXNOW_KEY,
    keyLocation: `${SITE_URL}/${INDEXNOW_KEY}.txt`,
    urlList,
  };
}

async function main() {
  const args = process.argv.slice(2);
  const urls = args.length
    ? args
    : sitemapUrls(await (await fetch(`${SITE_URL}/sitemap.xml`)).text());

  const response = await fetch(ENDPOINT, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json; charset=utf-8' },
    body: JSON.stringify(indexNowPayload(urls)),
  });

  // 200 accepted; 202 accepted while the key file is still being checked.
  console.log(`IndexNow answered ${response.status} for ${urls.length} URLs`);
  if (!response.ok) {
    console.error(await response.text());
    process.exit(1);
  }
}

if (isMainModule(import.meta)) {
  main().catch((error) => {
    console.error(error);
    process.exit(1);
  });
}
