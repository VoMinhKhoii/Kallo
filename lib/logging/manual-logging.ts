// Shared types and pure helpers for deterministic manual logging: the user
// searches the food-composition database, picks an ingredient, and enters
// grams — nutrition is computed exactly from per-100g data, no AI involved.
// Imported by both web client code and server routes/actions, so this module
// must stay pure (no server-only or browser-only imports).
import { NUTRITION_KEYS } from '@/lib/ai/constants';
import type { NutritionValues } from '@/lib/ai/types';

/** Per-100g macro snapshot carried with every search result so the client can
 *  compute row/total macros live without another round-trip. */
export interface IngredientMacrosPer100g {
  caloriesKcal: number | null;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
}

/** One row returned by `GET /api/v1/ingredients/search`. */
export interface IngredientSearchResult {
  id: string;
  /** Primary Vietnamese name (e.g. "Thịt gà ta"). */
  namePrimary: string;
  /** English name (e.g. "Chicken meat"). */
  nameEn: string | null;
  nameAlt: string[] | null;
  /** 'raw' | 'cooked' — grams are interpreted against this state; the UI must
   *  surface it so users pick the entry matching how they weighed the food. */
  state: string;
  /** Trigram similarity (1 for recent-foods results). */
  similarity: number;
  /** True when found by the semantic (embedding) supplement rather than a
   *  lexical match — the UI labels these as related, not exact, hits. */
  semantic?: boolean;
  per100g: IngredientMacrosPer100g;
}

export interface IngredientSearchResponse {
  results: IngredientSearchResult[];
}

/** One editable row in the manual logging form. `grams` stays a string while
 *  editing (partial input like "1." must not be destroyed by reformatting).
 *  `query` is the user's raw typed text — it is what gets SAVED as the
 *  ingredient label, while `ingredient` (the picked DB row) supplies the
 *  nutrition. The two are independent so "ức gà" can be logged verbatim while
 *  the matched composition entry drives the numbers. */
export interface ManualMealRow {
  id: string;
  query: string;
  ingredient: IngredientSearchResult | null;
  grams: string;
}

export function createEmptyRow(id: string): ManualMealRow {
  return { id, query: '', ingredient: null, grams: '' };
}

/** The label saved for a row: the user's raw text, falling back to the picked
 *  ingredient's name (e.g. when they tapped a recent without typing). */
export function rowLabel(row: ManualMealRow): string {
  return row.query.trim() || row.ingredient?.namePrimary || '';
}

export function parseGrams(grams: string): number | null {
  // Accept a comma decimal separator (Vietnamese keyboards).
  const value = Number(grams.trim().replace(',', '.'));
  return Number.isFinite(value) && value > 0 ? value : null;
}

export type CompleteManualMealRow = ManualMealRow & {
  ingredient: IngredientSearchResult;
};

export function rowIsComplete(
  row: ManualMealRow
): row is CompleteManualMealRow {
  return row.ingredient !== null && parseGrams(row.grams) !== null;
}

export function hasCompleteRow(rows: ManualMealRow[]): boolean {
  return rows.some(rowIsComplete);
}

/** Macros for a single row: per100g × grams/100. Null until the row is
 *  complete; null nutrients stay null (unknown ≠ zero). */
export function rowMacros(row: ManualMealRow): IngredientMacrosPer100g | null {
  if (!row.ingredient) return null;
  const grams = parseGrams(row.grams);
  if (grams === null) return null;
  const ratio = grams / 100;
  const scale = (v: number | null) => (v == null ? null : v * ratio);
  return {
    caloriesKcal: scale(row.ingredient.per100g.caloriesKcal),
    proteinG: scale(row.ingredient.per100g.proteinG),
    carbohydrateG: scale(row.ingredient.per100g.carbohydrateG),
    fatG: scale(row.ingredient.per100g.fatG),
  };
}

/**
 * Scale a full per-100g nutrition profile (all 28 nutrients) to actual grams,
 * preserving nulls: an unmeasured nutrient stays unknown rather than becoming
 * a false zero. (lib/ai/pipeline's scalePer100g is macros-only and zero-fills
 * nulls, so it is intentionally not reused here.)
 */
export function scaleNutritionValues(
  per100g: NutritionValues,
  grams: number
): NutritionValues {
  const ratio = grams / 100;
  const result = {} as Record<string, number | null>;
  for (const key of NUTRITION_KEYS) {
    const value = per100g[key];
    result[key] = value == null ? null : value * ratio;
  }
  return result as unknown as NutritionValues;
}

/** Sum macros across all complete rows. Per nutrient: sum of non-null values,
 *  or null when no row carries it. */
export function totalsForRows(rows: ManualMealRow[]): IngredientMacrosPer100g {
  const totals: IngredientMacrosPer100g = {
    caloriesKcal: null,
    proteinG: null,
    carbohydrateG: null,
    fatG: null,
  };
  for (const row of rows) {
    const macros = rowMacros(row);
    if (!macros) continue;
    for (const key of Object.keys(totals) as (keyof typeof totals)[]) {
      const value = macros[key];
      if (value == null) continue;
      totals[key] = (totals[key] ?? 0) + value;
    }
  }
  return totals;
}
