import { rmSync } from 'node:fs';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/infra/db/client';

const dbCatalog = { rows: new Map(), lexical: {}, bm25En: {}, from: 'db' };
const getCardCatalog = vi.fn(async () => dbCatalog);
vi.mock('../../catalog', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../../catalog')>()),
  getCardCatalog: () => getCardCatalog(),
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
const { overwrite, textVector, writeFixture } = await import(
  './artifact-fixture'
);

const db = {} as AppDb;
const far = () => Date.now() + 60_000;
const dirs: string[] = [];

async function settled() {
  for (let i = 0; i < 200; i++) {
    const status = cardIndexStatus();
    if (status === 'ready' || status === 'failed') return status;
    await new Promise((r) => setTimeout(r, 25));
  }
  return cardIndexStatus();
}

beforeEach(() => {
  __resetCardIndexForTests();
  getCardCatalog.mockClear();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  __resetCardIndexForTests();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
  for (const d of dirs.splice(0)) rmSync(d, { recursive: true, force: true });
});

describe('card search index', () => {
  it('is disabled without a pinned build, and matching uses the database', async () => {
    vi.stubEnv('CARD_INDEX_URI', '');
    expect(cardIndexStatus()).toBe('disabled');
    const backend = await resolveCardBackend(db, far());
    expect(backend).toEqual({ kind: 'db', catalog: dbCatalog });
  });

  it('honours the kill switch even with a build pinned', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    vi.stubEnv('CARD_INDEX_URI', fx.uri);
    vi.stubEnv('CARD_INDEX_ENABLED', 'false');
    expect(cardIndexStatus()).toBe('disabled');
    expect((await resolveCardBackend(db, far()))?.valueOf()).toMatchObject({
      kind: 'db',
    });
  });

  it('loads the build, self-tests it in the worker, and serves from it', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    vi.stubEnv('CARD_INDEX_URI', fx.uri);

    expect(await settled()).toBe('ready');
    const backend = await resolveCardBackend(db, far());

    expect(backend).toMatchObject({ kind: 'index', build: 'fixture-build' });
    if (!backend || backend === 'expired' || backend.kind !== 'index') return;
    expect(backend.catalog.rows.size).toBe(120);
    expect(getCardCatalog).not.toHaveBeenCalled();
    const [hits] = await searchCardIndex([textVector(fx.texts, 7)], 2_000);
    expect(hits[0].id).toBe('row_7');
    expect(hits[0].similarity).toBeGreaterThan(0.999);
    for (let i = 1; i < hits.length; i++) {
      expect(hits[i - 1].similarity).toBeGreaterThanOrEqual(hits[i].similarity);
    }
  });

  it('waits for a loading build within the catalog wait', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    vi.stubEnv('CARD_INDEX_URI', fx.uri);

    // The first call starts the load and waits for its catalog.
    const backend = await resolveCardBackend(db, far());

    expect(backend).toMatchObject({ kind: 'index' });
  });

  it('refuses a build whose file does not match its manifest', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    overwrite(fx.dir, 'texts.f16', (b) => {
      b[100] ^= 0xff;
      return b;
    });
    vi.stubEnv('CARD_INDEX_URI', fx.uri);

    expect(await settled()).toBe('failed');
    expect(await resolveCardBackend(db, far())).toEqual({
      kind: 'db',
      catalog: dbCatalog,
    });
  });

  it('refuses a manifest format it does not know', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    overwrite(fx.dir, 'manifest.json', (b) =>
      JSON.stringify({ ...JSON.parse(b.toString()), format: 2 })
    );
    vi.stubEnv('CARD_INDEX_URI', fx.uri);

    expect(await settled()).toBe('failed');
  });

  it('reports expired when the deadline passes with no catalog', async () => {
    vi.stubEnv('CARD_INDEX_URI', '');
    getCardCatalog.mockImplementationOnce(() => new Promise(() => {}));
    expect(await resolveCardBackend(db, Date.now() + 30)).toBe('expired');
    expect(await resolveCardBackend(db, Date.now() - 1)).toBe('expired');
  });

  it('hands back to the legacy matcher when the database has no catalog', async () => {
    vi.stubEnv('CARD_INDEX_URI', '');
    getCardCatalog.mockResolvedValueOnce(null as never);
    expect(await resolveCardBackend(db, far())).toBeNull();
  });
});

describe('separately bundled copies of the module', () => {
  it('serve from the one build and worker the boot copy loaded', async () => {
    const fx = writeFixture();
    dirs.push(fx.dir);
    vi.stubEnv('CARD_INDEX_URI', fx.uri);
    // The boot hook's copy starts the load.
    expect(await settled()).toBe('ready');

    // A route's copy (Next bundles them separately) sees the same state.
    vi.resetModules();
    const routeCopy = await import('../search-index');
    expect(routeCopy.cardIndexStatus()).toBe('ready');
    const backend = await routeCopy.resolveCardBackend(db, far());
    expect(backend).toMatchObject({ kind: 'index', build: 'fixture-build' });
    const [hits] = await routeCopy.searchCardIndex(
      [textVector(fx.texts, 3)],
      2_000
    );
    expect(hits[0].id).toBe('row_3');
  });
});
