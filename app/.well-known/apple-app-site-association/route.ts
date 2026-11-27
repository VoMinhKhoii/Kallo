import { cacheLife } from 'next/cache';
import { appleAppSiteAssociation } from '@/lib/app-links/associations';

/**
 * iOS Universal Links: tells iOS that kallo.fit invite links open the Kallo
 * app (`applinks:kallo.fit` in `Runner.entitlements`). Apple's CDN fetches this
 * when the app is installed and refreshes it about once a day, so it must be
 * served as JSON, over https, with no redirect. The document itself is
 * `lib/app-links/associations.ts`.
 *
 * Static: built in a `'use cache'` function so the handler prerenders.
 */
async function body(): Promise<string> {
  'use cache';
  cacheLife('max');
  return JSON.stringify(appleAppSiteAssociation, null, 2);
}

export async function GET(): Promise<Response> {
  return new Response(await body(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
