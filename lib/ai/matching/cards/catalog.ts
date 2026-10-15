/**
 * The in-memory side of card retrieval: the composition row of every curated
 * card, its concept key, and the lexical + BM25 indexes. Loaded once per
 * process (~7.7k rows, ~0.6 s, ~60 MB) and re-read in the background every
 * 30 minutes, so a card migration applied while an instance is warm is picked
 * up without a restart.
 *
 * `null` means "not ready": the tables are missing or empty, or a card string
 * is not embedded yet (between a migration and its backfill), so a half-built
 * index never serves. The caller then uses the legacy matcher. A not-ready
 * answer is re-checked after a minute, so a fresh backfill is picked up
 * without a restart.
 */
import { sql } from 'drizzle-orm';
import { sourceBucket } from '@/lib/ai/matching/match-constants';
import type { MatchSource } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db/client';
import { type Bm25Index, buildBm25Index } from './bm25-index';
import { CATALOG_ROWS_SQL, type CatalogQueryRow } from './catalog-sql';
import { conceptKey } from './concept-key';
import { buildLexicalIndex, type LexicalIndex } from './lexical-index';

export interface CatalogRow {
  id: string;
  source: MatchSource;
  state: string;
  nameEn: string;
  namePrimary: string;
  concept: string;
  card: { food: string; namesVi: string[]; facets: string[] } | null;
}

export interface CardCatalog {
  rows: Map<string, CatalogRow>;
  lexical: LexicalIndex;
  bm25En: Bm25Index;
}

const NOT_READY_RETRY_MS = 60_000;
const READY_REFRESH_MS = 30 * 60_000;

interface CatalogState {
  cache: {
    at: number;
    ready: boolean;
    catalog: Promise<CardCatalog | null>;
  } | null;
  refreshing: boolean;
}

/**
 * Process-wide, not module-level: Next bundles this module separately into the
 * boot hook (`instrumentation.ts`) and into each route that matches meals, as
 * separate instances (seen in the prod image, 2026-10-14). With module-level
 * state the boot warm would load a catalog no route reads; on `globalThis`
 * every copy shares one load. It also outlives hot reloads in `next dev`:
 * after editing this file or the index builders, restart the dev server (or
 * wait for the 30-minute refresh) to see the change.
 */
const STATE_KEY = Symbol.for('kallo.cardCatalog');
const globals = globalThis as { [STATE_KEY]?: CatalogState };
globals[STATE_KEY] ??= { cache: null, refreshing: false };
const state = globals[STATE_KEY];

export function getCardCatalog(db: AppDb): Promise<CardCatalog | null> {
  const cache = state.cache;
  if (cache?.ready) {
    if (Date.now() - cache.at >= READY_REFRESH_MS && !state.refreshing)
      refresh(db);
    return cache.catalog;
  }
  if (cache && Date.now() - cache.at < NOT_READY_RETRY_MS) return cache.catalog;
  const entry = {
    at: Date.now(),
    ready: false,
    catalog: loadCatalog(db).catch((err) => {
      console.error(
        '[card-matching] catalog load failed; using legacy matcher:',
        err
      );
      return null;
    }),
  };
  entry.catalog.then((c) => {
    entry.ready = c !== null;
  });
  state.cache = entry;
  return entry.catalog;
}

/**
 * Re-read a ready catalog in the background; the loaded one serves until the
 * read finishes. A read that finds the cards mid-backfill hands back to the
 * legacy matcher (not ready) instead of mixing two card generations.
 */
function refresh(db: AppDb): void {
  state.refreshing = true;
  const at = Date.now();
  loadCatalog(db)
    .then((catalog) => {
      state.cache = {
        at,
        ready: catalog !== null,
        catalog: Promise.resolve(catalog),
      };
    })
    .catch((err) => {
      console.error(
        '[card-matching] catalog refresh failed; keeping the loaded catalog:',
        err
      );
      // Retry after the not-ready interval, not a full refresh interval.
      if (state.cache)
        state.cache.at = Date.now() - READY_REFRESH_MS + NOT_READY_RETRY_MS;
    })
    .finally(() => {
      state.refreshing = false;
    });
}

/** True once the catalog has loaded in this process (sync, no I/O). */
export function isCardCatalogReady(): boolean {
  return state.cache?.ready ?? false;
}

/** Visible for testing. */
export function __resetCardCatalogForTests() {
  state.cache = null;
  state.refreshing = false;
}

const present = (s: string | null | undefined): s is string =>
  typeof s === 'string' && s.trim().length > 0;

/**
 * The catalog from the catalog query's rows: shared by the database path
 * below and the search artifact (`search-index/`), whose catalog.json holds
 * the same rows, so both build identical indexes.
 */
export function buildCardCatalog(
  result: readonly CatalogQueryRow[]
): CardCatalog {
  const rows = new Map<string, CatalogRow>();
  const names = new Map<string, Set<string>>();
  for (const r of result) {
    const source = sourceBucket(r.source_code);
    if (!source) continue;
    const base = {
      id: r.id,
      source,
      state: r.state,
      nameEn: r.name_en ?? '',
      namePrimary: r.name_primary,
      card: r.food
        ? {
            food: r.food,
            namesVi: r.names_vi ?? [],
            facets: [
              r.part_cut,
              r.form_processing,
              r.cooking_method,
              r.fat_level,
              r.brand,
            ].filter(present),
          }
        : null,
    };
    rows.set(r.id, {
      ...base,
      concept: conceptKey({ ...base, sourceCode: r.source_code }),
    });
    names.set(
      r.id,
      new Set(
        [
          base.nameEn,
          base.namePrimary,
          base.card?.food,
          ...(r.aliases_en ?? []),
          ...(base.card?.namesVi ?? []),
        ].filter(present)
      )
    );
  }
  return {
    rows,
    lexical: buildLexicalIndex(names),
    bm25En: buildBm25Index(
      [...rows.values()].map((r) => ({ id: r.id, text: r.nameEn }))
    ),
  };
}

async function loadCatalog(db: AppDb): Promise<CardCatalog | null> {
  const t0 = Date.now();
  // Readiness and rows from one snapshot: a card migration committing between
  // two separate reads could load cards whose vectors are still NULL and mark
  // the catalog ready anyway.
  const result = await db.transaction(
    async (tx) => {
      // Its own statement: Postgres resolves table names when it parses a
      // statement, so on a database without the card tables a combined query
      // would fail instead of answering "not ready".
      const [table] = await tx.execute<{ present: boolean }>(sql`
        SELECT to_regclass('public.food_card_texts') IS NOT NULL AS present
      `);
      if (!table?.present) return null;
      const [state] = await tx.execute<{ ready: boolean }>(sql`
        SELECT EXISTS (SELECT 1 FROM food_card_text_rows)
          AND NOT EXISTS (SELECT 1 FROM food_card_texts WHERE embedding IS NULL) AS ready
      `);
      if (!state?.ready) return null;
      return tx.execute<CatalogQueryRow>(sql.raw(CATALOG_ROWS_SQL));
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  );
  if (!result) return null;

  const catalog = buildCardCatalog(result);
  console.info(
    `[card-matching] catalog loaded: ${catalog.rows.size} rows in ${Date.now() - t0}ms`
  );
  return catalog;
}
