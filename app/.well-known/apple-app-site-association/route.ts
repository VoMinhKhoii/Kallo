import { cacheLife } from 'next/cache';
import { INVITE_PATH_PREFIXES, IOS_APP_ID } from '@/lib/app-links/associations';

/**
 * iOS Universal Links: tells iOS that kallo.fit invite links open the Kallo
 * app (`applinks:kallo.fit` in `Runner.entitlements`). Apple's CDN fetches this
 * when the app is installed and refreshes it about once a day, so it must be
 * served as JSON, over https, with no redirect.
 *
 * Static: built in a `'use cache'` function so the handler prerenders.
 */
async function appSiteAssociation(): Promise<string> {
  'use cache';
  cacheLife('max');

  return JSON.stringify(
    {
      applinks: {
        details: [
          {
            appIDs: [IOS_APP_ID],
            // `?*`: at least one character after the prefix, so a bare
            // `/en/invite/` with no slug stays on the web.
            components: INVITE_PATH_PREFIXES.map((prefix) => ({
              '/': `${prefix}?*`,
            })),
          },
        ],
      },
    },
    null,
    2
  );
}

export async function GET(): Promise<Response> {
  return new Response(await appSiteAssociation(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
