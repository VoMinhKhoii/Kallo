// Candidate query for the BỮA ĂN group of the `/` picker: whole past meals.
// Same search as dish-query.ts one level up — identical matching, ranking,
// window and eligibility, sharing the fragments in match.ts.
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
import type { RelogMealCandidate } from '@/lib/domain/logging/relog/relog';

const RAW_INPUT = sql`m.raw_input`;

function toMealCandidate(row: Record<string, unknown>): RelogMealCandidate {
  return {
    kind: 'meal',
    sourceMealId: String(row.meal_id),
    name: String(row.raw_input),
    dishCount: Number(row.dish_count),
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
 * The user's past meals, deduplicated by case-folded `raw_input` and ranked by
 * the shared score. Picking one stages it as a single reference; the server
 * expands it into that meal's dishes at commit.
 *
 * `raw_input` is a WEAKER dedup key than a dish name and that is an accepted
 * cost of this group: it is free text, so "phở bò với trà đá" and "phở bò +
 * trà đá" both appear where dishes would have collapsed to one. Normalizing
 * harder (stripping punctuation, sorting tokens) would start merging genuinely
 * different meals, which is worse. Dishes are the precise group and render
 * first; meals are the convenience one.
 *
 * The INNER JOIN to meal_items drops meals with no item rows — there would be
 * nothing to copy, and a zero-item write would read as a cheat meal
 * downstream. It also makes the cheat exclusion redundant rather than
 * load-bearing (cheat meals carry no item rows).
 *
 * Nutrition is summed from the ITEM ROWS, not read off `meals.*`, so the
 * subtitle equals what the writer will actually produce (which sums the copied
 * rows). Reading the stored meal total instead would drift the moment a meal
 * had been edited.
 */
export async function loadRelogMealCandidates(
  exec: RelogExecutor,
  opts: { userId: string; query: string; limit: number }
): Promise<RelogMealCandidate[]> {
  const rows = await exec.execute(sql`
    WITH ${queryCte(opts.query)},
    candidates AS (
      SELECT
        m.id AS meal_id,
        m.raw_input,
        lower(btrim(m.raw_input)) AS meal_key,
        m.logged_at,
        count(DISTINCT (mi.meal_item_order, mi.meal_item_name)) AS dish_count,
        sum(mi.estimated_grams) AS total_grams,
        sum(mi.calories_kcal)   AS calories_kcal,
        sum(mi.protein_g)       AS protein_g,
        sum(mi.carbohydrate_g)  AS carbohydrate_g,
        sum(mi.fat_g)           AS fat_g
      FROM meals m
      JOIN meal_items mi ON mi.meal_id = m.id
      CROSS JOIN q
      WHERE ${eligibleSourceMeal(opts.userId)}
        AND btrim(m.raw_input) <> ''
        AND ${matchesQuery(RAW_INPUT)}
      GROUP BY m.id, m.raw_input, m.logged_at
    ),
    ranked AS (
      SELECT
        c.*,
        count(*)         OVER (PARTITION BY c.meal_key) AS occurrence_count,
        max(c.logged_at) OVER (PARTITION BY c.meal_key) AS last_logged_at,
        row_number()     OVER (
          PARTITION BY c.meal_key
          ORDER BY c.logged_at DESC, c.meal_id
        ) AS rn
      FROM candidates c
    )
    SELECT
      r.meal_id, r.raw_input, r.dish_count,
      r.total_grams, r.calories_kcal, r.protein_g, r.carbohydrate_g, r.fat_g,
      r.occurrence_count, r.last_logged_at
    FROM ranked r
    CROSS JOIN q
    WHERE r.rn = 1
    ORDER BY
      ${prefixBoost(sql`r.raw_input`)} DESC,
      ${scoreExpr(sql`r.occurrence_count`, sql`r.last_logged_at`)} DESC,
      r.last_logged_at DESC,
      r.raw_input ASC
    LIMIT ${opts.limit}
  `);
  return rows.map(toMealCandidate);
}
