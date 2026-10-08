/**
 * The in-memory side of card retrieval: every matchable composition row with
 * its card, its concept key, and the lexical + BM25 indexes. Loaded once per
 * process (~7.7k rows, ~0.6 s, ~60 MB) — cards only change through a migration
 * and a deploy.
 *
 * `null` means "not ready" (tables missing, empty, or any card string not
 * embedded yet — e.g. between a migration and its backfill, so a half-built
 * index never serves); the caller then uses the legacy matcher. A not-ready answer is re-checked after a minute, so a fresh
 * backfill is picked up without a restart.
 */
import { sql } from 'drizzle-orm';
import { MATCHING_SOURCE_BUCKETS } from '@/lib/ai/matching/match-constants';
import type { AppDb } from '@/lib/infra/db/client';
import { type Bm25Index, buildBm25Index } from './bm25-index';
import { conceptKey } from './concept-key';
import { buildLexicalIndex, type LexicalIndex } from './lexical-index';

export interface CatalogRow {
  id: string;
  sourceCode: string;
  state: string;
  nameEn: string;
  namePrimary: string;
  concept: string;
  card: {
    food: string;
    namesVi: string[];
    facets: string[];
  } | null;
}

export interface CardCatalog {
  rows: Map<string, CatalogRow>;
  lexical: LexicalIndex;
  bm25En: Bm25Index;
}

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

async function loadCatalog(db: AppDb): Promise<CardCatalog | null> {
  const [ready] = (await db.execute(sql`
    SELECT to_regclass('public.food_card_vectors') IS NOT NULL
      AND EXISTS (SELECT 1 FROM food_card_vectors)
      AND NOT EXISTS (SELECT 1 FROM food_card_vectors WHERE embedding IS NULL) AS ready
  `)) as unknown as { ready: boolean }[];
  if (!ready?.ready) return null;

  const t0 = Date.now();
  const result = (await db.execute(sql`
    SELECT v.id, s.code AS source_code, v.state, v.name_en, v.name_primary,
           c.food, c.aliases_en, c.names_vi, c.part_cut, c.form_processing,
           c.cooking_method, c.fat_level, c.brand
    FROM vietnamese_food_composition v
    JOIN ingredient_sources s ON s.id = v.source_id
    LEFT JOIN food_cards c ON c.food_composition_id = v.id
    WHERE s.code IN (${sql.join(
      Object.keys(MATCHING_SOURCE_BUCKETS).map((c) => sql`${c}`),
      sql`, `
    )})
  `)) as unknown as Record<string, unknown>[];

  const rows = new Map<string, CatalogRow>();
  const names = new Map<string, Set<string>>();
  for (const r of result) {
    const id = r.id as string;
    const row: CatalogRow = {
      id,
      sourceCode: r.source_code as string,
      state: r.state as string,
      nameEn: (r.name_en as string) ?? '',
      namePrimary: (r.name_primary as string) ?? '',
      concept: '',
      card: r.food
        ? {
            food: r.food as string,
            namesVi: (r.names_vi as string[]) ?? [],
            facets: [
              r.part_cut,
              r.form_processing,
              r.cooking_method,
              r.fat_level,
              r.brand,
            ].filter((f): f is string => typeof f === 'string' && f.length > 0),
          }
        : null,
    };
    row.concept = conceptKey(row);
    rows.set(id, row);
    names.set(
      id,
      new Set(
        [
          row.nameEn,
          row.namePrimary,
          row.card?.food,
          ...((r.aliases_en as string[]) ?? []),
          ...(row.card?.namesVi ?? []),
        ].filter(
          (n): n is string => typeof n === 'string' && n.trim().length > 0
        )
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
