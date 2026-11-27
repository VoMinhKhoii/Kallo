import { cacheLife } from 'next/cache';
import { androidAssetLinks } from '@/lib/app-links/associations';

/**
 * Android App Links: proves to Android that the Kallo app may open kallo.fit
 * links (the `autoVerify` intent filter in `AndroidManifest.xml`). Android
 * fetches this at install time; it must be JSON over https with no redirect.
 * The document itself is `lib/app-links/associations.ts`.
 *
 * Static: built in a `'use cache'` function so the handler prerenders.
 */
async function body(): Promise<string> {
  'use cache';
  cacheLife('max');
  return JSON.stringify(androidAssetLinks, null, 2);
}

export async function GET(): Promise<Response> {
  return new Response(await body(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
