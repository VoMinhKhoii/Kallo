import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import {
  assertReadsWithinCap,
  assertWritesWithinCap,
  fetchR2Usage,
  judgeUsage,
  readsWithinCap,
  resetUsageCapForTests,
} from '@/lib/infra/storage/usage-cap';

const ACCOUNT = '0123456789abcdef0123456789abcdef';

/** A GraphQL Analytics answer with these totals. */
function analytics({ storage = [0], ops = {} as Record<string, number> } = {}) {
  return new Response(
    JSON.stringify({
      data: {
        viewer: {
          accounts: [
            {
              ops: Object.entries(ops).map(([actionType, requests]) => ({
                sum: { requests },
                dimensions: { actionType },
              })),
              storage: storage.map((payloadSize) => ({
                max: { payloadSize, metadataSize: 0 },
                dimensions: { bucketName: 'b' },
              })),
            },
          ],
        },
      },
      errors: null,
    }),
    { status: 200 }
  );
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetUsageCapForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('R2_ACCOUNT_ID', ACCOUNT);
  vi.stubEnv('CLOUDFLARE_ANALYTICS_TOKEN', 'analytics-token');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('judgeUsage — 95% of each free-tier meter', () => {
  const quiet = { storageBytes: 0, classA: 0, classB: 0 };

  it.each([
    ['storage', { storageBytes: 9.5e9 }, { writes: false, reads: true }],
    [
      'storage just under',
      { storageBytes: 9.5e9 - 1 },
      { writes: true, reads: true },
    ],
    ['Class A', { classA: 950_000 }, { writes: false, reads: true }],
    ['Class A just under', { classA: 949_999 }, { writes: true, reads: true }],
    ['Class B', { classB: 9_500_000 }, { writes: true, reads: false }],
    [
      'Class B just under',
      { classB: 9_499_999 },
      { writes: true, reads: true },
    ],
  ])('%s', (_name, usage, expected) => {
    expect(judgeUsage({ ...quiet, ...usage })).toEqual(expected);
  });
});

describe('fetchR2Usage', () => {
  it('sums the whole account by pricing class and ignores free deletes', async () => {
    fetchMock.mockResolvedValue(
      analytics({
        storage: [1000, 2000],
        ops: {
          PutObject: 10,
          ListObjects: 5,
          GetObject: 7,
          HeadObject: 1,
          DeleteObject: 99,
          DeleteObjects: 99,
        },
      })
    );
    const now = Date.parse('2026-10-05T12:00:00Z');

    const usage = await fetchR2Usage(ACCOUNT, 'analytics-token', now);

    expect(usage).toEqual({ storageBytes: 3000, classA: 15, classB: 8 });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe('https://api.cloudflare.com/client/v4/graphql');
    expect(new Headers(init.headers).get('authorization')).toBe(
      'Bearer analytics-token'
    );
    const { variables } = JSON.parse(init.body as string);
    expect(variables.accountTag).toBe(ACCOUNT);
    // Trailing 31 days: covers any billing period-to-date.
    expect(variables.since).toBe('2026-09-04T12:00:00.000Z');
    expect(variables.until).toBe('2026-10-05T12:00:00.000Z');
  });

  it('rejects a GraphQL error or a non-200', async () => {
    fetchMock.mockResolvedValueOnce(
      new Response(JSON.stringify({ errors: [{ message: 'no access' }] }))
    );
    await expect(fetchR2Usage(ACCOUNT, 't')).rejects.toThrow('no access');

    fetchMock.mockResolvedValueOnce(new Response('', { status: 401 }));
    await expect(fetchR2Usage(ACCOUNT, 't')).rejects.toThrow('401');
  });
});

describe('the cap', () => {
  it('lets everything through while under the cap', async () => {
    fetchMock.mockResolvedValue(analytics());

    await expect(assertWritesWithinCap()).resolves.toBeUndefined();
    await expect(assertReadsWithinCap()).resolves.toBeUndefined();
    expect(readsWithinCap()).toBe(true);
  });

  it('stops uploads at the storage or Class A cap', async () => {
    fetchMock.mockResolvedValue(analytics({ ops: { PutObject: 950_000 } }));

    await expect(assertWritesWithinCap()).rejects.toMatchObject({
      code: 'STORAGE_PAUSED',
      status: 503,
    });
    await expect(assertReadsWithinCap()).resolves.toBeUndefined();
  });

  it('stops photo links and avatar URLs at the Class B cap', async () => {
    fetchMock.mockResolvedValue(analytics({ ops: { GetObject: 9_500_000 } }));

    await expect(assertReadsWithinCap()).rejects.toMatchObject({
      code: 'STORAGE_PAUSED',
    });
    expect(readsWithinCap()).toBe(false);
    await expect(assertWritesWithinCap()).resolves.toBeUndefined();
  });

  it('reads usage once per 5 minutes, not per request', async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(async () => analytics());

    await assertWritesWithinCap();
    await assertWritesWithinCap();
    await assertReadsWithinCap();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(5 * 60 * 1000);
    await assertWritesWithinCap();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the last good answer through a short analytics outage', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(analytics());
    await assertWritesWithinCap();

    vi.advanceTimersByTime(5 * 60 * 1000);
    fetchMock.mockRejectedValue(new Error('network'));
    await expect(assertWritesWithinCap()).resolves.toBeUndefined();
  });

  it('with no usage known at all, stops uploads but keeps reads', async () => {
    fetchMock.mockRejectedValue(new Error('network'));

    await expect(assertWritesWithinCap()).rejects.toMatchObject({
      code: 'STORAGE_PAUSED',
    });
    await expect(assertReadsWithinCap()).resolves.toBeUndefined();
  });

  it('stops uploads once the last good answer is over an hour old', async () => {
    vi.useFakeTimers();
    fetchMock.mockResolvedValueOnce(analytics());
    await assertWritesWithinCap();

    fetchMock.mockRejectedValue(new Error('network'));
    vi.advanceTimersByTime(61 * 60 * 1000);
    await expect(assertWritesWithinCap()).rejects.toMatchObject({
      code: 'STORAGE_PAUSED',
    });
  });

  it('is off, and says so, without the analytics token', async () => {
    vi.stubEnv('CLOUDFLARE_ANALYTICS_TOKEN', '');

    await expect(assertWritesWithinCap()).resolves.toBeUndefined();
    expect(readsWithinCap()).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
    expect(console.warn).toHaveBeenCalledWith(
      expect.stringContaining('cap is OFF')
    );
  });
});
