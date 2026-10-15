import { sql } from 'drizzle-orm';
import { fetchInediblePctForIds } from '@/lib/ai/cache/nutrition-cache';
import {
  NUTRITION_CACHE_SELECT_COLUMNS,
  type NutritionCacheRow,
  parseNutritionRow,
} from '@/lib/ai/cache/nutrition-rows';
import type { MatchInfo } from '@/lib/ai/matching/match-constants';
import { batchFetchNutrition } from '@/lib/ai/matching/nutrition-batch';
import type { NutritionPer100g } from '@/lib/ai/types/matching';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * What every matcher hands the pipeline: per ingredient, the candidates Call 2
 * chooses from (best first), with their nutrition attached.
 */
export interface IngredientV2MatchResult {
  ingredientIndex: number;
  candidates: V2MatchCandidate[];
  /** Card retrieval only: where its vector search ran (recorded in traces). */
  retrieval?: CardRetrieval;
}

/**
 * `index`: the in-container search artifact (`build` names it); `db`:
 * `match_food_card_texts`; `none`: the vector arm failed and the lexical arms
 * alone ranked the candidates.
 */
export interface CardRetrieval {
  vectorSource: 'index' | 'db' | 'none';
  build?: string;
}

export interface V2MatchCandidate {
  info: MatchInfo;
  nutrition: NutritionPer100g | null;
  inediblePct: number | null;
  /**
   * How Call 2 sees this candidate, owned by the matcher that produced it:
   * the legacy matcher shows the row's names and its similarity; card
   * retrieval shows the card label and a rank score (its order is the signal).
   */
  prompt: { name: string; nameEn: string | null; score: number };
}

/**
 * Batch-fetch nutrition + inedible pct for all unique candidate ids and
 * attach them to the candidates in place (the last step of every matcher).
 *
 * USDA rows are intentionally not back-filled: `inedible_portion_pct` is
 * VN-FCT–specific and USDA imports leave it NULL, so they stay `null` by
 * design rather than paying a roundtrip that returns nothing.
 */
export async function attachCandidateNutrition(
  results: IngredientV2MatchResult[],
  db: AppDb,
  opts: { fresh?: boolean } = {}
): Promise<void> {
  const uniqueIds = new Set<string>();
  for (const r of results) {
    for (const c of r.candidates) uniqueIds.add(c.info.foodCompositionId);
  }
  if (uniqueIds.size === 0) return;
  if (opts.fresh) return attachFresh(results, [...uniqueIds], db);

  const ids = Array.from(uniqueIds);
  // Nutrition reads prime inedible values (including NULLs), so consult that
  // cache afterwards rather than racing a redundant second query.
  const nutritionMap = await batchFetchNutrition(ids, db);
  const inedibleMap = await fetchInediblePctForIds(ids, db);
  for (const r of results) {
    for (const c of r.candidates) {
      const id = c.info.foodCompositionId;
      const foodData = nutritionMap.get(id);
      c.nutrition = foodData ?? null;
      if (foodData?.foodGroupEn) c.info.foodGroupEn = foodData.foodGroupEn;
      c.inediblePct = inedibleMap.get(id) ?? null;
    }
  }
}

/**
 * One query for the candidates' nutrition, inedible % and food group, past
 * the process cache, and only rows Postgres still has: a candidate whose row
 * is gone is dropped. For candidates from the search artifact, which can
 * predate a row's deletion (a meal item naming a deleted row fails its
 * insert). The row's presence is the liveness check, never its inedible %,
 * which most rows lack.
 */
async function attachFresh(
  results: IngredientV2MatchResult[],
  ids: string[],
  db: AppDb
): Promise<void> {
  const rows = await db.execute<NutritionCacheRow>(
    sql`SELECT ${sql.raw(NUTRITION_CACHE_SELECT_COLUMNS.join(', '))} FROM vietnamese_food_composition WHERE id IN (${sql.join(
      ids.map((id) => sql`${id}`),
      sql`, `
    )})`
  );
  const live = new Map(rows.map((row) => [row.id, row]));
  for (const r of results) {
    r.candidates = r.candidates.filter((c) =>
      live.has(c.info.foodCompositionId)
    );
    for (const c of r.candidates) {
      const row = live.get(c.info.foodCompositionId) as NutritionCacheRow;
      c.nutrition = parseNutritionRow(row);
      if (typeof row.type_en === 'string' && row.type_en.length > 0) {
        c.info.foodGroupEn = row.type_en;
      }
      const inedible = row.inedible_portion_pct;
      const parsed = inedible == null ? Number.NaN : Number(inedible);
      c.inediblePct = Number.isFinite(parsed) ? parsed : null;
    }
  }
}
