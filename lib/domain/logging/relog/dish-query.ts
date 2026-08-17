// Candidate query for the MÓN group of the `/` picker: distinct dishes the
// user has logged before. A "dish" is a group of meal_items rows sharing
// (meal_item_order, meal_item_name) inside one meal — the same grouping
// buildMealItemGroupsFromRows performs on read.
import { sql } from 'drizzle-orm';
import {
  eligibleSourceMeal,
  matchesQuery,
  prefixBoost,
  queryCte,
  type RelogExecutor,
  scoreExpr,
  toIsoString,
  toNullableNumber,
} from '@/lib/domain/logging/relog/match';
import type { RelogDishCandidate } from '@/lib/domain/logging/relog/relog';

const NAME = sql`mi.meal_item_name`;

function toDishCandidate(row: Record<string, unknown>): RelogDishCandidate {
  return {
    kind: 'dish',
    sourceMealId: String(row.meal_id),
    mealItemOrder: Number(row.meal_item_order),
    name: String(row.meal_item_name),
    ingredientCount: Number(row.ingredient_count),
    occurrenceCount: Number(row.occurrence_count),
    lastLoggedAt: toIsoString(row.last_logged_at),
    totalGrams: toNullableNumber(row.total_grams),
    caloriesKcal: toNullableNumber(row.calories_kcal),
    proteinG: toNullableNumber(row.protein_g),
    carbohydrateG: toNullableNumber(row.carbohydrate_g),
    fatG: toNullableNumber(row.fat_g),
  };
}

/**
 * The user's past dishes, deduplicated by case-folded name and ranked by the
 * shared frequency×recency score. An empty `query` returns their top staples.
 *
 * Dedup identity is `lower(btrim(meal_item_name))` on the ACCENTED text — never
 * unaccented, which would merge "bò" (beef) and "bơ" (butter) dishes. The
 * ingredient set is deliberately NOT part of that key: the same dish analyzed
 * twice decomposes slightly differently, and that drift is exactly what relog
 * exists to escape. The picker shows one "Phở bò"; the subtitle discloses which
 * instance you get.
 *
 * Payload identity is `(meal_id, meal_item_order)` of the MOST RECENT
 * occurrence — the user's latest accepted numbers, including manual gram edits
 * made after saving (the amount editor writes into meal_items). Averaging
 * across instances would synthesize numbers that never existed. The
 * `meal_id, meal_item_order` tie-break keeps the choice stable across calls,
 * which matters because Enter must pick what the user saw.
 *
 * The macro columns on meal_items are the stored (already goal-adjusted)
 * values, so these SUMs equal what buildPersistedMealItemGroup computes on
 * read — picker subtitle, staged total and persisted group nutrition agree by
 * construction.
 *
 * No index is added for this. `meals_user_logged_at_idx (user_id, logged_at)`
 * bounds the meal set and `meal_items_meal_order_idx (meal_id, …)` serves the
 * join; one user over the lookback window is a few thousand rows.
 */
export async function loadRelogDishCandidates(
  exec: RelogExecutor,
  opts: { userId: string; query: string; limit: number }
): Promise<RelogDishCandidate[]> {
  const rows = await exec.execute(sql`
    WITH ${queryCte(opts.query)},
    dishes AS (
      SELECT
        mi.meal_id,
        mi.meal_item_order,
        mi.meal_item_name,
        lower(btrim(mi.meal_item_name)) AS dish_key,
        m.logged_at,
        count(*)                AS ingredient_count,
        sum(mi.estimated_grams) AS total_grams,
        sum(mi.calories_kcal)   AS calories_kcal,
        sum(mi.protein_g)       AS protein_g,
        sum(mi.carbohydrate_g)  AS carbohydrate_g,
        sum(mi.fat_g)           AS fat_g
      FROM meal_items mi
      JOIN meals m ON m.id = mi.meal_id
      CROSS JOIN q
      WHERE ${eligibleSourceMeal(opts.userId)}
        AND btrim(mi.meal_item_name) <> ''
        AND ${matchesQuery(NAME)}
      GROUP BY mi.meal_id, mi.meal_item_order, mi.meal_item_name, m.logged_at
    ),
    ranked AS (
      SELECT
        d.*,
        count(*)         OVER (PARTITION BY d.dish_key) AS occurrence_count,
        max(d.logged_at) OVER (PARTITION BY d.dish_key) AS last_logged_at,
        row_number()     OVER (
          PARTITION BY d.dish_key
          ORDER BY d.logged_at DESC, d.meal_id, d.meal_item_order
        ) AS rn
      FROM dishes d
    )
    SELECT
      r.meal_id, r.meal_item_order, r.meal_item_name, r.ingredient_count,
      r.total_grams, r.calories_kcal, r.protein_g, r.carbohydrate_g, r.fat_g,
      r.occurrence_count, r.last_logged_at
    FROM ranked r
    CROSS JOIN q
    WHERE r.rn = 1
    ORDER BY
      ${prefixBoost(sql`r.meal_item_name`)} DESC,
      ${scoreExpr(sql`r.occurrence_count`, sql`r.last_logged_at`)} DESC,
      r.last_logged_at DESC,
      r.meal_item_name ASC
    LIMIT ${opts.limit}
  `);
  return rows.map(toDishCandidate);
}
