import { cacheLife } from 'next/cache';
import {
  ANDROID_CERT_SHA256,
  ANDROID_PACKAGE,
} from '@/lib/app-links/associations';

/**
 * Android App Links: proves to Android that the Kallo app may open kallo.fit
 * links (the `autoVerify` intent filter in `AndroidManifest.xml`). Android
 * fetches this at install time; it must be JSON over https with no redirect.
 * The paths themselves live in the manifest, not here.
 *
 * Static: built in a `'use cache'` function so the handler prerenders.
 */
async function assetLinks(): Promise<string> {
  'use cache';
  cacheLife('max');

  return JSON.stringify(
    [
      {
        relation: ['delegate_permission/common.handle_all_urls'],
        target: {
          namespace: 'android_app',
          package_name: ANDROID_PACKAGE,
          sha256_cert_fingerprints: [...ANDROID_CERT_SHA256],
        },
      },
    ],
    null,
    2
  );
}

export async function GET(): Promise<Response> {
  return new Response(await assetLinks(), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=3600',
    },
  });
}
