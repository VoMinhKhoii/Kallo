import { randomUUID } from 'node:crypto';
import { afterAll, describe as describeBase, expect, it } from 'vitest';

import {
  listObjects,
  putObject,
  removeObjects,
  removePrefix,
  signedReadUrl,
} from '@/lib/infra/storage/object-storage';

/**
 * The storage module against REAL R2: path-style requests, the conditional
 * put, DeleteObjects' checksum, presigned GETs and the public avatar domain.
 * Writes only under a random `it-<uuid>/` prefix and purges it afterwards.
 *
 * Needs the R2_* variables (docs/STORAGE.md) pointed at a NON-production
 * prefix, plus R2_INTEGRATION_TEST=1 to acknowledge the writes:
 *   R2_INTEGRATION_TEST=1 bun --env-file=.env.local run test -- \
 *     lib/infra/storage/__tests__/object-storage.r2.test.ts
 */
const optedIn =
  process.env.R2_INTEGRATION_TEST === '1' &&
  Boolean(process.env.R2_BUCKET_PREFIX) &&
  !process.env.R2_BUCKET_PREFIX?.includes('prod');
const describe = optedIn ? describeBase : describeBase.skip;

const PREFIX = `it-${randomUUID()}/`;
const BYTES = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

describe('object storage on R2', () => {
  afterAll(async () => {
    await removePrefix('avatars', PREFIX);
    await removePrefix('feedback-screenshots', PREFIX);
  });

  it('writes once, refuses an overwrite, lists and deletes', async () => {
    const key = `${PREFIX}a.png`;
    await putObject('feedback-screenshots', key, BYTES, {
      contentType: 'image/png',
    });
    await expect(
      putObject('feedback-screenshots', key, BYTES, {
        contentType: 'image/png',
      })
    ).rejects.toMatchObject({ $metadata: { httpStatusCode: 412 } });

    const listed = await listObjects('feedback-screenshots', PREFIX);
    expect(listed.map((o) => o.key)).toEqual([key]);
    expect(listed[0]?.lastModified).toBeInstanceOf(Date);

    await removeObjects('feedback-screenshots', [key]);
    expect(await listObjects('feedback-screenshots', PREFIX)).toEqual([]);
  });

  it('serves a private object only through its presigned URL', async () => {
    const key = `${PREFIX}private.png`;
    await putObject('feedback-screenshots', key, BYTES, {
      contentType: 'image/png',
    });

    const url = await signedReadUrl('feedback-screenshots', key, 60);
    const signed = await fetch(url);
    expect(signed.status).toBe(200);
    expect(signed.headers.get('content-type')).toBe('image/png');
    expect(new Uint8Array(await signed.arrayBuffer())).toEqual(BYTES);

    const unsigned = await fetch(url.split('?')[0] as string);
    expect(unsigned.ok).toBe(false);
  });

  it('serves avatars publicly from the avatar domain with cache headers', async () => {
    const base = process.env.NEXT_PUBLIC_AVATAR_BASE_URL;
    expect(base).toBeTruthy();
    const key = `${PREFIX}face.webp`;
    await putObject('avatars', key, BYTES, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=300',
    });

    const res = await fetch(`${base?.replace(/\/+$/, '')}/${key}`);
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    // The public domain serves objects, never a listing of the bucket.
    const root = await fetch(`${base?.replace(/\/+$/, '')}/`);
    expect(root.ok).toBe(false);
  });

  it('purges every object under a prefix', async () => {
    const keys = Array.from({ length: 3 }, (_, i) => `${PREFIX}p/${i}.png`);
    for (const key of keys) {
      await putObject('avatars', key, BYTES, { contentType: 'image/png' });
    }
    await removePrefix('avatars', `${PREFIX}p/`);
    expect(await listObjects('avatars', `${PREFIX}p/`)).toEqual([]);
  });
});
