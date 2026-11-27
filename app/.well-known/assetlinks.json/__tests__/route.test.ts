import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { INVITE_PATH_PREFIXES } from '@/lib/app-links/associations';

// `cacheLife()` only works inside a Next render; here it is a no-op.
vi.mock('next/cache', () => ({ cacheLife: () => undefined }));

async function fetchAssetLinks() {
  const { GET } = await import('@/app/.well-known/assetlinks.json/route');
  const response = await GET();
  return { response, body: await response.json() };
}

describe('/.well-known/assetlinks.json', () => {
  it('serves JSON', async () => {
    const { response } = await fetchAssetLinks();
    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toContain('application/json');
  });

  it('lets the Play app, signed by Play or by our upload key, handle links', async () => {
    const { body } = await fetchAssetLinks();
    expect(body).toHaveLength(1);
    expect(body[0].relation).toEqual([
      'delegate_permission/common.handle_all_urls',
    ]);
    expect(body[0].target.namespace).toBe('android_app');
    expect(body[0].target.package_name).toBe('fit.kallo.app');
    const fingerprints: string[] = body[0].target.sha256_cert_fingerprints;
    expect(fingerprints).toHaveLength(2);
    for (const fingerprint of fingerprints) {
      // 32 bytes as colon-separated uppercase hex, the only form Android reads.
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });

  it('matches the paths the Android manifest claims', () => {
    // The manifest is the other half of the App Link; a prefix added on one
    // side and not the other leaves those links in the browser.
    const manifest = readFileSync(
      join(
        process.cwd(),
        'apps/mobile-flutter/android/app/src/main/AndroidManifest.xml'
      ),
      'utf8'
    );
    const claimed = [...manifest.matchAll(/android:pathPrefix="([^"]+)"/g)].map(
      (match) => match[1]
    );
    expect(claimed.sort()).toEqual([...INVITE_PATH_PREFIXES].sort());
  });
});
