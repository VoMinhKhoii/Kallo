import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  androidAssetLinks,
  appleAppSiteAssociation,
  INVITE_PATH_PREFIXES,
} from '@/lib/app-links/associations';

describe('appleAppSiteAssociation', () => {
  it('claims invite links that carry a slug, in every locale and bare', () => {
    expect(appleAppSiteAssociation.applinks.details).toEqual([
      {
        appIDs: ['ZNG57U88R5.com.khoivo.nham'],
        components: [
          { '/': '/en/invite/?*' },
          { '/': '/vi/invite/?*' },
          { '/': '/invite/?*' },
        ],
      },
    ]);
  });
});

describe('androidAssetLinks', () => {
  it('lets the Play app, signed by Play or by our upload key, handle links', () => {
    expect(androidAssetLinks).toHaveLength(1);
    const [statement] = androidAssetLinks;
    expect(statement.relation).toEqual([
      'delegate_permission/common.handle_all_urls',
    ]);
    expect(statement.target.namespace).toBe('android_app');
    expect(statement.target.package_name).toBe('fit.kallo.app');
    const fingerprints = statement.target.sha256_cert_fingerprints;
    expect(fingerprints).toHaveLength(2);
    for (const fingerprint of fingerprints) {
      // 32 bytes as colon-separated uppercase hex, the only form Android reads.
      expect(fingerprint).toMatch(/^([0-9A-F]{2}:){31}[0-9A-F]{2}$/);
    }
  });
});

describe('INVITE_PATH_PREFIXES', () => {
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
