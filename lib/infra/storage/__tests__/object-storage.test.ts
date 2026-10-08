import {
  DeleteObjectsCommand,
  ListObjectsV2Command,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { mockClient } from 'aws-sdk-client-mock';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertObjectStorageConfigured,
  listObjects,
  putObject,
  removeObjects,
  removePrefix,
  signedReadUrl,
} from '@/lib/infra/storage/object-storage';

const legacy = vi.hoisted(() => ({
  from: vi.fn(),
  list: vi.fn(),
  remove: vi.fn(),
}));
vi.mock('@/lib/infra/supabase/admin', () => ({
  createAdminClient: () => ({ storage: { from: legacy.from } }),
}));

const s3 = mockClient(S3Client);
const ACCOUNT = '0123456789abcdef0123456789abcdef';

beforeEach(() => {
  s3.reset();
  vi.clearAllMocks();
  legacy.from.mockReturnValue({ list: legacy.list, remove: legacy.remove });
  legacy.list.mockResolvedValue({ data: [], error: null });
  legacy.remove.mockResolvedValue({ data: [], error: null });
  vi.stubEnv('R2_ACCOUNT_ID', ACCOUNT);
  vi.stubEnv('R2_ACCESS_KEY_ID', 'test-access-key');
  vi.stubEnv('R2_SECRET_ACCESS_KEY', 'test-secret');
  vi.stubEnv('R2_BUCKET_PREFIX', 'kallo-test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('configuration', () => {
  it.each([
    'R2_ACCOUNT_ID',
    'R2_ACCESS_KEY_ID',
    'R2_SECRET_ACCESS_KEY',
    'R2_BUCKET_PREFIX',
  ])('fails loudly without %s, before any request', async (name) => {
    vi.stubEnv(name, '');

    expect(() => assertObjectStorageConfigured()).toThrow(name);
    await expect(
      putObject('avatars', 'u/a.webp', new Uint8Array([1]), {
        contentType: 'image/webp',
      })
    ).rejects.toThrow('Object storage requires');
    expect(s3.calls()).toHaveLength(0);
  });
});

describe('putObject', () => {
  it('writes to the prefixed bucket and never overwrites', async () => {
    s3.on(PutObjectCommand).resolves({});
    const body = new Uint8Array([1, 2, 3]);

    await putObject('avatars', 'user-1/a.webp', body, {
      contentType: 'image/webp',
      cacheControl: 'public, max-age=300',
    });

    const [call] = s3.commandCalls(PutObjectCommand);
    expect(call?.args[0].input).toEqual({
      Bucket: 'kallo-test-avatars',
      Key: 'user-1/a.webp',
      Body: body,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=300',
      IfNoneMatch: '*',
    });
  });

  it.each([
    ['avatars', 'image/png', 10, 'does not accept image/png'],
    ['avatars', 'image/webp', 512_001, 'takes 1–512000 bytes'],
    ['nutrition-labels', 'image/jpeg', 4 * 1024 * 1024 + 1, 'takes 1–4194304'],
    ['nutrition-labels', 'image/gif', 10, 'does not accept image/gif'],
    ['feedback-screenshots', 'text/html', 10, 'does not accept text/html'],
    [
      'feedback-screenshots',
      'image/svg+xml',
      10,
      'does not accept image/svg+xml',
    ],
    ['feedback-screenshots', 'image/png', 0, 'takes 1–'],
  ] as const)('keeps the Supabase bucket rule: %s refuses %s at %i bytes', async (bucket, contentType, size, message) => {
    await expect(
      putObject(bucket, 'u/x', new Uint8Array(size), { contentType })
    ).rejects.toThrow(message);
    expect(s3.calls()).toHaveLength(0);
  });

  it('accepts the largest object each bucket allows', async () => {
    s3.on(PutObjectCommand).resolves({});

    await putObject('avatars', 'u/a.webp', new Uint8Array(512_000), {
      contentType: 'image/webp',
    });
    await putObject(
      'nutrition-labels',
      'u/l.png',
      new Uint8Array(4 * 1024 * 1024),
      { contentType: 'image/png' }
    );

    expect(s3.commandCalls(PutObjectCommand)).toHaveLength(2);
  });

  it('surfaces a refused write', async () => {
    s3.on(PutObjectCommand).rejects(new Error('PreconditionFailed'));

    await expect(
      putObject('nutrition-labels', 'u/x.jpg', new Uint8Array([1]), {
        contentType: 'image/jpeg',
      })
    ).rejects.toThrow('PreconditionFailed');
  });
});

describe('listObjects', () => {
  it('returns keys and modification times under the prefix', async () => {
    const when = new Date('2026-10-01T00:00:00Z');
    s3.on(ListObjectsV2Command).resolves({
      Contents: [{ Key: 'u/a.png', LastModified: when }, { Key: undefined }],
    });

    const objects = await listObjects('feedback-screenshots', 'u/');

    expect(objects).toEqual([{ key: 'u/a.png', lastModified: when }]);
    expect(s3.commandCalls(ListObjectsV2Command)[0]?.args[0].input).toEqual({
      Bucket: 'kallo-test-feedback-screenshots',
      Prefix: 'u/',
      ContinuationToken: undefined,
    });
  });

  it('follows continuation tokens past the first page', async () => {
    s3.on(ListObjectsV2Command)
      .resolvesOnce({
        Contents: [{ Key: 'u/1.png' }],
        IsTruncated: true,
        NextContinuationToken: 'next',
      })
      .resolvesOnce({ Contents: [{ Key: 'u/2.png' }], IsTruncated: false });

    const objects = await listObjects('feedback-screenshots', 'u/');

    expect(objects.map((o) => o.key)).toEqual(['u/1.png', 'u/2.png']);
    const calls = s3.commandCalls(ListObjectsV2Command);
    expect(calls).toHaveLength(2);
    expect(calls[1]?.args[0].input.ContinuationToken).toBe('next');
  });
});

describe('removeObjects', () => {
  it('batches deletes at 1000 keys', async () => {
    s3.on(DeleteObjectsCommand).resolves({});
    const keys = Array.from({ length: 1001 }, (_, i) => `u/${i}.jpg`);

    await removeObjects('nutrition-labels', keys);

    const calls = s3.commandCalls(DeleteObjectsCommand);
    expect(calls).toHaveLength(2);
    expect(calls[0]?.args[0].input.Delete?.Objects).toHaveLength(1000);
    expect(calls[1]?.args[0].input.Delete?.Objects).toEqual([
      { Key: 'u/1000.jpg' },
    ]);
  });

  it('also deletes the legacy Supabase copies of the same keys', async () => {
    s3.on(DeleteObjectsCommand).resolves({});

    await removeObjects('avatars', ['u/a.webp']);

    expect(legacy.from).toHaveBeenCalledWith('avatars');
    expect(legacy.remove).toHaveBeenCalledWith(['u/a.webp']);
  });

  it('throws when the legacy delete fails', async () => {
    s3.on(DeleteObjectsCommand).resolves({});
    legacy.remove.mockResolvedValue({ data: null, error: new Error('down') });

    await expect(removeObjects('avatars', ['u/a.webp'])).rejects.toThrow(
      'down'
    );
  });

  it('throws when R2 reports a per-key failure', async () => {
    s3.on(DeleteObjectsCommand).resolves({
      Errors: [{ Key: 'u/a.jpg', Code: 'InternalError' }],
    });

    await expect(removeObjects('avatars', ['u/a.jpg'])).rejects.toThrow(
      'InternalError'
    );
  });
});

describe('removePrefix', () => {
  it('lists and deletes until the prefix is empty', async () => {
    s3.on(ListObjectsV2Command)
      .resolvesOnce({ Contents: [{ Key: 'u/1.jpg' }, { Key: 'u/2.jpg' }] })
      .resolvesOnce({ Contents: [{ Key: 'u/3.jpg' }] })
      .resolves({ Contents: [] });
    s3.on(DeleteObjectsCommand).resolves({});

    await removePrefix('nutrition-labels', 'u/');

    const deleted = s3
      .commandCalls(DeleteObjectsCommand)
      .flatMap((call) => call.args[0].input.Delete?.Objects ?? []);
    expect(deleted).toEqual([
      { Key: 'u/1.jpg' },
      { Key: 'u/2.jpg' },
      { Key: 'u/3.jpg' },
    ]);
  });

  it('then purges the legacy prefix, including keys R2 never had', async () => {
    s3.on(ListObjectsV2Command).resolves({ Contents: [] });
    legacy.list
      .mockResolvedValueOnce({
        data: [{ id: '1', name: 'late.jpg' }],
        error: null,
      })
      .mockResolvedValueOnce({ data: [], error: null });

    await removePrefix('nutrition-labels', 'u/');

    expect(legacy.list).toHaveBeenCalledWith('u', { limit: 100, offset: 0 });
    expect(legacy.remove).toHaveBeenCalledWith(['u/late.jpg']);
  });

  it('stops on a legacy folder entry instead of looping on it', async () => {
    s3.on(ListObjectsV2Command).resolves({ Contents: [] });
    legacy.list.mockResolvedValue({
      data: [{ id: null, name: 'nested' }],
      error: null,
    });

    await removePrefix('avatars', 'u/');

    expect(legacy.list).toHaveBeenCalledTimes(1);
    expect(legacy.remove).not.toHaveBeenCalled();
  });

  it('fails closed when the legacy listing fails', async () => {
    s3.on(ListObjectsV2Command).resolves({ Contents: [] });
    legacy.list.mockResolvedValue({ data: null, error: new Error('down') });

    await expect(removePrefix('avatars', 'u/')).rejects.toThrow('down');
  });

  it('fails closed when a listing fails', async () => {
    s3.on(ListObjectsV2Command).rejects(new Error('unavailable'));

    await expect(removePrefix('avatars', 'u/')).rejects.toThrow('unavailable');
  });

  it.each([
    '',
    '/',
    'abc',
    '/abc/',
  ])('refuses the prefix %j so a purge never widens', async (prefix) => {
    await expect(removePrefix('avatars', prefix)).rejects.toThrow(
      'removePrefix'
    );
    expect(s3.calls()).toHaveLength(0);
    expect(legacy.from).not.toHaveBeenCalled();
  });
});

describe('at the free-tier cap', () => {
  beforeEach(async () => {
    const { resetUsageCapForTests } = await import(
      '@/lib/infra/storage/usage-cap'
    );
    resetUsageCapForTests();
    vi.stubEnv('CLOUDFLARE_ANALYTICS_TOKEN', 'analytics-token');
    vi.spyOn(console, 'error').mockImplementation(() => {});
    // Every meter over: 10M GetObject, 1M PutObject, 10 GB stored.
    vi.stubGlobal(
      'fetch',
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              data: {
                viewer: {
                  accounts: [
                    {
                      ops: [
                        {
                          sum: { requests: 1e6 },
                          dimensions: { actionType: 'PutObject' },
                        },
                        {
                          sum: { requests: 1e7 },
                          dimensions: { actionType: 'GetObject' },
                        },
                      ],
                      storage: [
                        { max: { payloadSize: 1e10, metadataSize: 0 } },
                      ],
                    },
                  ],
                },
              },
            })
          )
      )
    );
  });

  afterEach(async () => {
    vi.unstubAllGlobals();
    const { resetUsageCapForTests } = await import(
      '@/lib/infra/storage/usage-cap'
    );
    resetUsageCapForTests();
  });

  it('refuses writes and presigns without touching R2, but still deletes', async () => {
    s3.on(DeleteObjectsCommand).resolves({});

    await expect(
      putObject('avatars', 'u/a.webp', new Uint8Array([1]), {
        contentType: 'image/webp',
      })
    ).rejects.toMatchObject({ code: 'STORAGE_PAUSED' });
    await expect(
      signedReadUrl('feedback-screenshots', 'u/a.png', 300)
    ).rejects.toMatchObject({ code: 'STORAGE_PAUSED' });
    expect(s3.commandCalls(PutObjectCommand)).toHaveLength(0);

    await removeObjects('avatars', ['u/a.webp']);
    expect(s3.commandCalls(DeleteObjectsCommand)).toHaveLength(1);
  });
});

describe('signedReadUrl', () => {
  it('signs a path-style GET on the account origin with the given lifetime', async () => {
    const url = new URL(
      await signedReadUrl('feedback-screenshots', 'u/a b.png', 300)
    );

    expect(url.origin).toBe(`https://${ACCOUNT}.r2.cloudflarestorage.com`);
    expect(url.pathname).toBe('/kallo-test-feedback-screenshots/u/a%20b.png');
    expect(url.searchParams.get('X-Amz-Expires')).toBe('300');
    expect(url.searchParams.get('X-Amz-Signature')).toMatch(/^[0-9a-f]{64}$/);
    expect(url.searchParams.get('X-Amz-Credential')).toContain(
      'test-access-key/'
    );
  });
});
