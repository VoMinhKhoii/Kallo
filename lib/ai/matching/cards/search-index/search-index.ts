/**
 * In-container card search. The deploy pins each Cloud Run revision to one
 * search artifact build (`CARD_INDEX_URI`, built by
 * `scripts/data/food-cards/search-artifact/`); this module loads it once per
 * process (the catalog on the main thread, the vectors and HNSW index in a
 * worker thread) and decides, per matching call, between it and today's
 * database path (`resolveCardBackend`).
 *
 *   disabled  no CARD_INDEX_URI, or CARD_INDEX_ENABLED=false: the database path
 *   loading   the build is being read; a call waits briefly for its catalog
 *   ready     catalog and worker loaded, and the worker's self-test passed
 *   failed    the build or the worker failed: the database path, while the
 *             load is retried (at most 3 times, with backoff)
 *
 * The state lives on globalThis: Next bundles this module separately into the
 * boot hook and each route, as separate instances (see `catalog.ts`).
 */
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { AppDb } from '@/lib/infra/db/client';
import { reportError } from '@/lib/infra/telemetry/monitoring/report-error';
import { buildCardCatalog, type CardCatalog, getCardCatalog } from '../catalog';
import type { CatalogQueryRow } from '../catalog-sql';
import type { VectorHit } from '../vector-arm';
import { readArtifactFile, readVerifiedFile } from './artifact-fetch.mjs';
import { type Manifest, ManifestSchema } from './manifest';
import {
  DEFAULT_HANG_RULE,
  type SearchWorker,
  spawnSearchWorker,
} from './worker-client';

export type CardIndexStatus = 'disabled' | 'loading' | 'ready' | 'failed';

/** Longest a single worker search may take before the call goes lexical-only. */
export const SEARCH_TIMEOUT_MS = DEFAULT_HANG_RULE.fullTimeoutMs;
/**
 * Below this much time left, a call skips the worker and uses the lexical
 * arms: a search squeezed into a sliver of time would only time out.
 */
export const MIN_SEARCH_BUDGET_MS = 250;
const MAX_RETRIES = 3;
/** Healthy this long after a recovery, the retry allowance starts over. */
const RETRY_RESET_AFTER_MS = 10 * 60_000;

interface State {
  started: boolean;
  status: CardIndexStatus;
  uri: string | null;
  manifest: Manifest | null;
  catalog: CardCatalog | null;
  catalogLoad: Promise<CardCatalog | null> | null;
  worker: SearchWorker | null;
  workerReady: Promise<boolean> | null;
  retries: number;
  /** The retries ran out: this process serves from the database for good. */
  gaveUp: boolean;
  readySince: number | null;
}

const STATE_KEY = Symbol.for('kallo.cardIndex');
const globals = globalThis as { [STATE_KEY]?: State };
const fresh = (): State => ({
  started: false,
  status: 'disabled',
  uri: null,
  manifest: null,
  catalog: null,
  catalogLoad: null,
  worker: null,
  workerReady: null,
  retries: 0,
  gaveUp: false,
  readySince: null,
});
globals[STATE_KEY] ??= fresh();
const state = () => globals[STATE_KEY] as State;

function config(): { uri: string } | { reason: string } {
  if (!readBooleanEnv('CARD_INDEX_ENABLED', true)) {
    return { reason: 'CARD_INDEX_ENABLED=false' };
  }
  const uri = process.env.CARD_INDEX_URI?.trim();
  return uri ? { uri } : { reason: 'CARD_INDEX_URI is not set' };
}

function fail(scope: string, err: unknown) {
  const s = state();
  // After a long healthy run this is a new incident, not a repeat of the
  // last: three retries per incident, not per process lifetime.
  if (
    s.readySince !== null &&
    Date.now() - s.readySince >= RETRY_RESET_AFTER_MS
  ) {
    s.retries = 0;
  }
  s.readySince = null;
  s.status = 'failed';
  console.error(`[card-index] ${scope} failed; using the database path:`, err);
  reportError(err, 'card-index');
  if (s.retries >= MAX_RETRIES) {
    s.gaveUp = true;
    return;
  }
  const delay = 2_000 * 2 ** s.retries;
  s.retries++;
  // Unref'd: a pending retry never keeps the process alive. A retry that
  // outlives its state (reset in tests) does nothing.
  setTimeout(() => {
    if (state() !== s) return;
    if (s.catalog) spawnWorker();
    else loadBuild();
  }, delay).unref();
}

function spawnWorker() {
  const s = state();
  if (!s.uri || !s.manifest) return;
  const t0 = Date.now();
  let worker: SearchWorker;
  try {
    worker = spawnSearchWorker(s.uri, s.manifest, (err) => {
      if (state().worker !== worker) return;
      s.worker = null;
      s.workerReady = null;
      fail('search worker', err);
    });
  } catch (err) {
    // The thread could not even start (a missing file, no memory): the same
    // bounded retry as any other failure, never an uncaught exception.
    fail('search worker', err);
    return;
  }
  s.worker = worker;
  s.workerReady = worker.ready.then(
    (ms) => {
      if (s.worker !== worker) return false;
      s.status = 'ready';
      s.readySince = Date.now();
      console.info(
        `[card-index] ready ${s.manifest?.buildId}: worker loaded in ${ms} ms (${Date.now() - t0} ms since spawn), rss ${Math.round(process.memoryUsage().rss / 1e6)} MB`
      );
      return true;
    },
    () => false
  );
}

function loadBuild() {
  const s = state();
  const uri = s.uri as string;
  s.status = 'loading';
  const t0 = Date.now();
  s.catalogLoad = (async () => {
    const manifest = ManifestSchema.parse(
      JSON.parse(
        (await readArtifactFile(uri, 'manifest.json', 10_000)).toString('utf8')
      )
    );
    const rows = JSON.parse(
      (
        await readVerifiedFile(
          uri,
          'catalog.json',
          manifest.files['catalog.json'],
          10_000
        )
      ).toString('utf8')
    ) as CatalogQueryRow[];
    // A load that outlived its state (reset in tests) must not touch the new one.
    if (state() !== s) return null;
    const catalog = buildCardCatalog(rows);
    s.manifest = manifest;
    s.catalog = catalog;
    console.info(
      `[card-index] catalog ${manifest.buildId}: ${catalog.rows.size} rows in ${Date.now() - t0} ms`
    );
    spawnWorker();
    return catalog;
  })().catch((err) => {
    if (state() === s) fail('artifact load', err);
    return null;
  });
}

/** Start loading the pinned build, once per process. Safe to call often. */
export function startCardIndex(): void {
  const s = state();
  if (s.started) return;
  s.started = true;
  const cfg = config();
  if ('reason' in cfg) {
    s.status = 'disabled';
    console.info(
      `[card-index] disabled (${cfg.reason}); using the database path`
    );
    return;
  }
  s.uri = cfg.uri;
  loadBuild();
}

/** For /api/healthz and the deploy smoke check. */
export function cardIndexStatus(): CardIndexStatus {
  startCardIndex();
  return state().status;
}

/**
 * The longest the startup probe holds a new container back while its build
 * loads. Past it the container takes traffic anyway (searching the database
 * until the build arrives), so a build that cannot load never stops
 * containers from starting.
 */
export const STARTUP_HOLD_MS = 15_000;

/**
 * For the startup probe (`app/api/startupz`): whether a new container may take
 * traffic. Cloud Run gives a starting container full CPU and none between
 * requests once it serves, and loading the build at throttled CPU timed out
 * every attempt (measured 2026-10-15), so the load happens before traffic:
 * true once the build is ready, the index is disabled, the retries ran out, or
 * STARTUP_HOLD_MS passed since the process started.
 */
export function cardIndexSettled(uptimeMs = process.uptime() * 1000): boolean {
  startCardIndex();
  const s = state();
  if (s.status === 'ready' || s.status === 'disabled' || s.gaveUp) return true;
  return uptimeMs >= STARTUP_HOLD_MS;
}

/** Whether a build is configured (loading, ready or failed), not disabled. */
export function cardIndexConfigured(): boolean {
  startCardIndex();
  return state().status !== 'disabled';
}

const TIMED_OUT = Symbol('timed out');

function within<T>(p: Promise<T>, ms: number): Promise<T | typeof TIMED_OUT> {
  if (ms <= 0) return Promise.resolve(TIMED_OUT);
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    p,
    new Promise<typeof TIMED_OUT>((resolve) => {
      timer = setTimeout(() => resolve(TIMED_OUT), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/**
 * The build's catalog when this process serves from the build: waits up to
 * `waitMs` while it loads; null when disabled, failed, or still loading after
 * the wait.
 */
export async function cardIndexCatalog(
  waitMs: number
): Promise<CardCatalog | null> {
  startCardIndex();
  const s = state();
  if (s.status === 'disabled' || s.status === 'failed') return null;
  if (s.catalog) return s.catalog;
  const loaded = await within(s.catalogLoad ?? Promise.resolve(null), waitMs);
  return loaded === TIMED_OUT || state().status === 'failed' ? null : loaded;
}

export function cardIndexBuild(): string | null {
  return state().manifest?.buildId ?? null;
}

/**
 * Vector search in the worker: waits for it to finish loading within
 * `timeoutMs`, then searches within what is left (at most SEARCH_TIMEOUT_MS).
 * Throws when the worker is unavailable or too slow; the caller then degrades
 * that call to the lexical arms. Repeated timeouts restart the worker.
 */
export async function searchCardIndex(
  embeddings: number[][],
  timeoutMs: number
): Promise<VectorHit[][]> {
  const s = state();
  const worker = s.worker;
  const ready = s.workerReady;
  if (!worker || !ready) throw new Error('card index worker unavailable');
  const t0 = Date.now();
  const loaded = await within(ready, timeoutMs);
  if (loaded !== true) {
    throw new Error(
      loaded === TIMED_OUT
        ? 'card index worker still loading'
        : 'card index worker failed'
    );
  }
  const budget = Math.min(SEARCH_TIMEOUT_MS, timeoutMs - (Date.now() - t0));
  if (budget < MIN_SEARCH_BUDGET_MS) {
    throw new Error(`card index search skipped: ${budget} ms left`);
  }
  // Timeouts are counted on the worker's handle (`worker-client.ts`), which
  // replaces a worker that keeps missing full-length searches.
  return worker.search(embeddings, budget);
}

/** How long a call waits for the build's catalog before taking the DB path. */
export const CATALOG_WAIT_MS = 3_000;

export type CardBackend =
  | {
      kind: 'index';
      catalog: CardCatalog;
      build: string | null;
      search: (
        embeddings: number[][],
        timeoutMs: number
      ) => Promise<VectorHit[][]>;
    }
  | { kind: 'db'; catalog: CardCatalog };

/**
 * Where one matching call's catalog and vectors come from, never mixed:
 *   the build      its catalog is loaded (within CATALOG_WAIT_MS while it
 *                  loads); vector search goes to the worker
 *   the database   disabled or failed, or the build's catalog did not arrive
 *                  in time: today's path (`getCardCatalog` + SQL search)
 *   null           no catalog yet and time left: the caller's legacy matcher
 *   'expired'      the deadline passed waiting for a catalog: no new work
 */
export async function resolveCardBackend(
  db: AppDb,
  deadlineAt: number
): Promise<CardBackend | null | 'expired'> {
  const remaining = () => deadlineAt - Date.now();
  const catalog = await cardIndexCatalog(
    Math.min(CATALOG_WAIT_MS, remaining())
  );
  if (catalog) {
    return {
      kind: 'index',
      catalog,
      build: cardIndexBuild(),
      search: searchCardIndex,
    };
  }
  if (remaining() <= 0) return 'expired';
  const fromDb = await within(getCardCatalog(db), remaining());
  if (fromDb === TIMED_OUT) return 'expired';
  return fromDb ? { kind: 'db', catalog: fromDb } : null;
}

/** Visible for testing: forget everything, including a running worker. */
export function __resetCardIndexForTests() {
  const old = state();
  globals[STATE_KEY] = fresh();
  old.worker?.terminate(); // after the swap, so its failure handler no-ops
}
