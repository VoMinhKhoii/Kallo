/**
 * The in-memory side of card retrieval: every matchable composition row with
 * its card, its concept key, and the lexical + BM25 indexes. Loaded once per
 * process (~7.7k rows, ~0.6 s, ~60 MB) — cards only change through a
 * migration and a deploy.
 *
 * `null` means "not ready": the tables are missing or empty, or a card string
 * is not embedded yet (between a migration and its backfill), so a half-built
 * index never serves. The caller then uses the legacy matcher. A not-ready
 * answer is re-checked after a minute, so a fresh backfill is picked up
 * without a restart.
 */
import { sql } from 'drizzle-orm';
import {
  MATCHABLE_SOURCE_CODES,
  sourceBucket,
} from '@/lib/ai/matching/match-constants';
import type { MatchSource } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db/client';
import { type Bm25Index, buildBm25Index } from './bm25-index';
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

type CatalogQueryRow = {
  id: string;
  source_code: string;
  state: string;
  name_en: string | null;
  name_primary: string;
  food: string | null;
  aliases_en: string[] | null;
  names_vi: string[] | null;
  part_cut: string | null;
  form_processing: string | null;
  cooking_method: string | null;
  fat_level: string | null;
  brand: string | null;
};

const NOT_READY_RETRY_MS = 60_000;
let cache: {
  at: number;
  ready: boolean;
  catalog: Promise<CardCatalog | null>;
} | null = null;

export function getCardCatalog(db: AppDb): Promise<CardCatalog | null> {
  if (cache && (cache.ready || Date.now() - cache.at < NOT_READY_RETRY_MS)) {
    return cache.catalog;
  }
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
  cache = entry;
  return entry.catalog;
}

/** True once the catalog has loaded in this process (sync, no I/O). */
export function isCardCatalogReady(): boolean {
  return cache?.ready ?? false;
}

/** Visible for testing. */
export function __resetCardCatalogForTests() {
  cache = null;
}

const present = (s: string | null | undefined): s is string =>
  typeof s === 'string' && s.trim().length > 0;

async function loadCatalog(db: AppDb): Promise<CardCatalog | null> {
  const t0 = Date.now();
  // Readiness and rows from one snapshot: a card migration committing between
  // two separate reads could load cards whose vectors are still NULL and mark
  // the catalog ready anyway.
  const result = await db.transaction(
    async (tx) => {
      const [state] = await tx.execute<{ ready: boolean }>(sql`
        SELECT to_regclass('public.food_card_vectors') IS NOT NULL
          AND EXISTS (SELECT 1 FROM food_card_vectors)
          AND NOT EXISTS (SELECT 1 FROM food_card_vectors WHERE embedding IS NULL) AS ready
      `);
      if (!state?.ready) return null;
      return tx.execute<CatalogQueryRow>(sql`
        SELECT v.id, s.code AS source_code, v.state, v.name_en, v.name_primary,
               c.food, c.aliases_en, c.names_vi, c.part_cut, c.form_processing,
               c.cooking_method, c.fat_level, c.brand
        FROM vietnamese_food_composition v
        JOIN ingredient_sources s ON s.id = v.source_id
        LEFT JOIN food_cards c ON c.food_composition_id = v.id
        WHERE s.code IN (${sql.join(
          MATCHABLE_SOURCE_CODES.map((c) => sql`${c}`),
          sql`, `
        )})
      `);
    },
    { isolationLevel: 'repeatable read', accessMode: 'read only' }
  );
  if (!result) return null;

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
  const catalog: CardCatalog = {
    rows,
    lexical: buildLexicalIndex(names),
    bm25En: buildBm25Index(
      [...rows.values()].map((r) => ({ id: r.id, text: r.nameEn }))
    ),
  };
  console.info(
    `[card-matching] catalog loaded: ${rows.size} rows in ${Date.now() - t0}ms`
  );
  return catalog;
}
