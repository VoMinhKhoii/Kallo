import { renameSync, rmSync } from 'node:fs';
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
  cardIndexSettled,
  cardIndexStatus,
  resolveCardBackend,
  STARTUP_HOLD_MS,
  searchCardIndex,
} = await import('../search-index');
const { writeFixture } = await import('./artifact-fixture');
const { reportError } = await import(
  '@/lib/infra/telemetry/monitoring/report-error'
);

const db = {} as AppDb;
let dir = '';

async function until(status: string) {
  for (let i = 0; i < 200 && cardIndexStatus() !== status; i++) {
    await new Promise((r) => setTimeout(r, 10));
  }
  return cardIndexStatus();
}

/**
 * Moves the clock (`Date` faked) past a retry's backoff, then makes the call a
 * request would: retries start on calls, never on a timer.
 */
async function afterBackoff(ms = 20_000) {
  vi.setSystemTime(Date.now() + ms);
  cardIndexStatus();
  await new Promise((r) => setTimeout(r, 0));
}

beforeEach(() => {
  __resetCardIndexForTests();
  spawned.length = 0;
  vi.mocked(reportError).mockClear();
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

    vi.useFakeTimers({ toFake: ['Date'] });
    spawned[0].onFailure(new Error('worker missed 3 searches'));
    expect(cardIndexStatus()).toBe('failed');
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toEqual({
      kind: 'db',
      catalog: dbCatalog,
    });
    // A failure a retry can repair is logged, not sent to Sentry.
    expect(reportError).not.toHaveBeenCalled();

    // Nothing retries on its own once the backoff passes: an idle container
    // has no CPU, and the reads would only time out.
    vi.setSystemTime(Date.now() + 2_000);
    await new Promise((r) => setTimeout(r, 20));
    expect(spawned).toHaveLength(1);

    // The next request starts the retry, and takes the database path itself.
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toEqual({
      kind: 'db',
      catalog: dbCatalog,
    });
    expect(spawned).toHaveLength(2);
    expect(await until('ready')).toBe('ready');
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toMatchObject({
      kind: 'index',
    });
  });

  it('retries a failed artifact load on the next request, without making it wait', async () => {
    __resetCardIndexForTests();
    renameSync(dir, `${dir}-away`);
    try {
      expect(await until('failed')).toBe('failed');
    } finally {
      renameSync(`${dir}-away`, dir);
    }
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(Date.now() + 2_000);

    const t0 = performance.now();
    expect(await resolveCardBackend(db, Date.now() + 60_000)).toEqual({
      kind: 'db',
      catalog: dbCatalog,
    });
    expect(performance.now() - t0).toBeLessThan(1_000);
    expect(await until('ready')).toBe('ready');
    expect(reportError).not.toHaveBeenCalled();
  });

  it('gives up after three failed retries and stays on the database path', async () => {
    expect(await until('ready')).toBe('ready');
    vi.useFakeTimers({ toFake: ['Date'] });
    for (let attempt = 0; attempt < 4; attempt++) {
      spawned.at(-1)?.onFailure(new Error('crash'));
      await afterBackoff();
    }
    expect(spawned).toHaveLength(4); // the first + three retries
    expect(cardIndexStatus()).toBe('failed');
    // Only giving up reaches Sentry: from here on every meal on this
    // container searches the database.
    expect(reportError).toHaveBeenCalledTimes(1);
  });

  it('treats a worker that cannot start as a failure to retry, not a crash', async () => {
    __resetCardIndexForTests();
    spawned.length = 0;
    spawnFailures.next = 1;

    expect(await until('failed')).toBe('failed');
    expect(spawned).toHaveLength(0);

    // The first call after its backoff starts the worker.
    vi.useFakeTimers({ toFake: ['Date'] });
    await afterBackoff(2_000);
    expect(await until('ready')).toBe('ready');
    expect(spawned).toHaveLength(1);
  });

  it('ignores a load that finishes after the state was reset', async () => {
    vi.stubEnv('CARD_INDEX_URI', 'file:///no/such/card-build');
    expect(cardIndexStatus()).toBe('loading');
    __resetCardIndexForTests();
    vi.stubEnv('CARD_INDEX_URI', '');
    expect(cardIndexStatus()).toBe('disabled');

    // The old load fails after the reset: the new state must not see it.
    await new Promise((r) => setTimeout(r, 50));
    expect(cardIndexStatus()).toBe('disabled');
    expect(console.error).not.toHaveBeenCalled();
  });

  describe('startup probe (cardIndexSettled)', () => {
    it('holds a new container until its build is ready', async () => {
      expect(cardIndexSettled(0)).toBe(false); // loading
      expect(await until('ready')).toBe('ready');
      expect(cardIndexSettled(0)).toBe(true);
    });

    it('never holds a container past STARTUP_HOLD_MS', () => {
      expect(cardIndexStatus()).toBe('loading');
      expect(cardIndexSettled(STARTUP_HOLD_MS - 1)).toBe(false);
      expect(cardIndexSettled(STARTUP_HOLD_MS)).toBe(true);
    });

    it('lets a container start at once when the index is disabled', () => {
      __resetCardIndexForTests();
      vi.stubEnv('CARD_INDEX_ENABLED', 'false');
      expect(cardIndexSettled(0)).toBe(true);
    });

    it('lets go once a build that cannot be read has used up its retries', async () => {
      __resetCardIndexForTests();
      vi.stubEnv('CARD_INDEX_URI', 'file:///no/such/card-build');
      vi.useFakeTimers({ toFake: ['Date'] });
      expect(cardIndexSettled(0)).toBe(false); // the first read is under way
      // Retry backoffs on the fake clock, each started by the probe's next
      // call; the failing reads themselves are real file I/O, so the wait is
      // bounded by real time (performance.now is not faked), not event-loop
      // turns: on a busy CI runner the reads queue behind other work in
      // libuv's thread pool.
      const deadline = performance.now() + 10_000;
      while (!cardIndexSettled(0) && performance.now() < deadline) {
        await new Promise((r) => setTimeout(r, 5));
        vi.setSystemTime(Date.now() + 8_000);
      }
      // Four reads (the first + three retries 2, 4 and 8 s apart) fail, all
      // inside the hold: the container may take traffic on the database path.
      expect(cardIndexSettled(0)).toBe(true);
      expect(cardIndexStatus()).toBe('failed');
      expect(spawned).toHaveLength(0);
    }, 20_000);

    it('holds while a retry is pending, and lets go once the retries ran out', async () => {
      expect(await until('ready')).toBe('ready');
      vi.useFakeTimers({ toFake: ['Date'] });
      // Three failures schedule the three retries: each time a retry is
      // still to come, so the container keeps waiting for it.
      for (let attempt = 0; attempt < 3; attempt++) {
        spawned.at(-1)?.onFailure(new Error('crash'));
        expect(cardIndexStatus()).toBe('failed');
        expect(cardIndexSettled(0)).toBe(false);
        await afterBackoff();
      }
      // The last retry fails too: nothing more will come.
      spawned.at(-1)?.onFailure(new Error('crash'));
      expect(cardIndexSettled(0)).toBe(true);
    });
  });

  it('skips the worker when too little time is left, without a strike', async () => {
    expect(await until('ready')).toBe('ready');
    await expect(searchCardIndex([[1]], 100)).rejects.toThrow(/skipped/);
    expect(spawned[0].search).not.toHaveBeenCalled();
    expect(cardIndexStatus()).toBe('ready');
  });

  it('starts the retry allowance over after a long healthy run', async () => {
    expect(await until('ready')).toBe('ready');
    vi.useFakeTimers({ toFake: ['Date'] });
    // Use up the three retries in one incident.
    for (let attempt = 0; attempt < 3; attempt++) {
      spawned.at(-1)?.onFailure(new Error('crash'));
      await afterBackoff();
    }
    expect(spawned).toHaveLength(4);
    expect(await until('ready')).toBe('ready');

    // Hours of healthy serving later, a new incident gets retries again.
    vi.setSystemTime(Date.now() + 11 * 60_000);
    spawned.at(-1)?.onFailure(new Error('crash'));
    await afterBackoff(2_000);
    expect(spawned).toHaveLength(5);
    expect(await until('ready')).toBe('ready');
  });
});
