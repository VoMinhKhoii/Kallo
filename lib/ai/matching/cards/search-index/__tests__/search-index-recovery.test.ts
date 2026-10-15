import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/infra/db/client';

class FakeTimeout extends Error {}
interface Fake {
  onFailure: (err: Error) => void;
  search: ReturnType<typeof vi.fn>;
  terminate: ReturnType<typeof vi.fn>;
}
const spawned: Fake[] = [];
const spawnFailures = { next: 0 };
vi.mock('../worker-client', () => ({
  DEFAULT_HANG_RULE: { fullTimeoutMs: 2_000, minStrikeSpanMs: 2_000 },
  spawnSearchWorker: (
    _uri: string,
    _m: unknown,
    onFailure: (e: Error) => void
  ) => {
    if (spawnFailures.next > 0) {
      spawnFailures.next--;
      throw new Error('cannot start a thread');
    }
    const fake: Fake = {
      onFailure,
      search: vi.fn(async () => {
        throw new FakeTimeout('slow');
      }),
      terminate: vi.fn(() => onFailure(new Error('terminated'))),
    };
    spawned.push(fake);
    return {
      ready: Promise.resolve(1),
      search: fake.search,
      terminate: fake.terminate,
    };
  },
}));
const dbCatalog = { rows: new Map(), from: 'db' };
vi.mock('../../catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../catalog')>()),
  getCardCatalog: async () => dbCatalog,
}));
vi.mock('@/lib/infra/telemetry/monitoring/report-error', () => ({
  reportError: vi.fn(),
}));

const {
  __resetCardIndexForTests,
  cardIndexStatus,
  resolveCardBackend,
  searchCardIndex,
} = await import('../search-index');
const { writeFixture } = await import('./artifact-fixture');

const db = {} as AppDb;
let dir = '';

async function until(status: string) {
  for (let i = 0; i < 200 && cardIndexStatus() !== status; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  return cardIndexStatus();
}

beforeEach(() => {
  __resetCardIndexForTests();
  spawned.length = 0;
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
  const fx = writeFixture();
  dir = fx.dir;
  vi.stubEnv('CARD_INDEX_URI', fx.uri);
});

afterEach(() => {
  __resetCardIndexForTests();
  vi.useRealTimers();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  rmSync(dir, { recursive: true, force: true });
});

describe('card search index recovery', () => {
  it('uses the database while a failed worker is replaced, then serves again', async () => {
    expect(await until('ready')).toBe('ready');
    // A search error alone does not fail the index (the worker client decides
    // when a worker is hung; see worker-client.test.ts).
    await expect(searchCardIndex([[1]], 1_000)).rejects.toBeInstanceOf(
      FakeTimeout
    );
    expect(cardIndexStatus()).toBe('ready');

    vi.useFakeTimers({ toFake: ['setTimeout'] });
    spawned[0].onFailure(new Error('worker missed 3 searches'));
    expect(cardIndexStatus()).toBe('failed');
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toEqual({
      kind: 'db',
      catalog: dbCatalog,
    });

    // The retry respawns the worker after its backoff, and serving resumes.
    await vi.advanceTimersByTimeAsync(2_000);
    vi.useRealTimers();
    expect(spawned).toHaveLength(2);
    expect(await until('ready')).toBe('ready');
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toMatchObject({
      kind: 'index',
    });
  });

  it('gives up after three failed retries and stays on the database path', async () => {
    expect(await until('ready')).toBe('ready');
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    for (let attempt = 0; attempt < 4; attempt++) {
      spawned.at(-1)?.onFailure(new Error('crash'));
      await vi.advanceTimersByTimeAsync(20_000);
    }
    expect(spawned).toHaveLength(4); // the first + three retries
    expect(cardIndexStatus()).toBe('failed');
  });

  it('treats a worker that cannot start as a failure to retry, not a crash', async () => {
    __resetCardIndexForTests();
    spawned.length = 0;
    spawnFailures.next = 1;

    expect(await until('failed')).toBe('failed');
    expect(spawned).toHaveLength(0);

    // The retry after its backoff starts the worker.
    vi.useFakeTimers({ toFake: ['setTimeout'] });
    await vi.advanceTimersByTimeAsync(2_000);
    vi.useRealTimers();
    expect(await until('ready')).toBe('ready');
    expect(spawned).toHaveLength(1);
  });

  it('skips the worker when too little time is left, without a strike', async () => {
    expect(await until('ready')).toBe('ready');
    await expect(searchCardIndex([[1]], 100)).rejects.toThrow(/skipped/);
    expect(spawned[0].search).not.toHaveBeenCalled();
    expect(cardIndexStatus()).toBe('ready');
  });

  it('starts the retry allowance over after a long healthy run', async () => {
    expect(await until('ready')).toBe('ready');
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    // Use up the three retries in one incident.
    for (let attempt = 0; attempt < 3; attempt++) {
      spawned.at(-1)?.onFailure(new Error('crash'));
      await vi.advanceTimersByTimeAsync(20_000);
    }
    expect(spawned).toHaveLength(4);
    vi.useRealTimers();
    expect(await until('ready')).toBe('ready');

    // Hours of healthy serving later, a new incident gets retries again.
    vi.useFakeTimers({ toFake: ['setTimeout', 'Date'] });
    vi.setSystemTime(Date.now() + 11 * 60_000);
    spawned.at(-1)?.onFailure(new Error('crash'));
    await vi.advanceTimersByTimeAsync(2_000);
    vi.useRealTimers();
    expect(spawned).toHaveLength(5);
    expect(await until('ready')).toBe('ready');
  });
});
