// What the manual-log surfaces print and compute for a food: the subtitle
// under its name, the vessel its amount ruler offers, where its amount opens
// and how − / + step. Pure — shared by the phone sheets and the desktop
// composer rows, and mirrored by the Flutter app's
// `features/logging/logic/manual/` (keep in sync).

import { PIECE_TIERS } from '@/lib/ai/portion/data/vessel-tables';
import { midG } from '@/lib/ai/portion/vessel/geometry';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import {
  type IngredientSearchResult,
  type IngredientVesselHint,
  MANUAL_ITEM_GRAMS_MAX,
  totalsForRows,
} from '@/lib/domain/logging/manual-logging';

/** A food's subtitle: a `lead` in ink (its state, or a packaged food's brand)
 *  and the `rest` muted after " · ". */
export interface ManualSubtitle {
  lead: string | null;
  rest: string | null;
}

/** The English name to show: the card's clean one, else the table's. */
export function englishName(result: IngredientSearchResult): string | null {
  const name = result.displayNameEn ?? result.nameEn;
  return name?.trim() ? name : null;
}

/** The state word (translated by `stateWord`) or the brand — never the
 *  table's default state, which says "raw" for canned fish. */
export function manualLead(
  result: IngredientSearchResult,
  stateWord: (state: 'raw' | 'cooked') => string
): string | null {
  if (result.stateLabel) return stateWord(result.stateLabel);
  return result.brand ?? null;
}

/** "Raw · Skinless chicken breast" for a search row. */
export function searchSubtitle(
  result: IngredientSearchResult,
  stateWord: (state: 'raw' | 'cooked') => string
): ManualSubtitle {
  return { lead: manualLead(result, stateWord), rest: englishName(result) };
}

/** "Raw · 150 g" for a food already in the meal; `suffix` carries the grams. */
export function mealSubtitle(
  result: IngredientSearchResult,
  stateWord: (state: 'raw' | 'cooked') => string,
  suffix: string
): ManualSubtitle {
  return { lead: manualLead(result, stateWord), rest: suffix };
}

/** Grams as typed: "150", "37.5" — never "150.0". */
export function formatGrams(grams: number): string {
  return String(Math.round(grams * 10) / 10);
}

/**
 * The search's vessel hint at its everyday tier: one medium cut; a regular cup
 * or a medium plate; a small bowl (a chén) of rice or beans, a medium bowl of
 * soup — a medium bowl of rice is ~390 g, twice what a chén holds.
 */
export function vesselFromHint(
  hint: IngredientVesselHint | null | undefined
): ClientVessel | null {
  if (!hint) return null;
  if (hint.family === 'piece') {
    return { family: 'piece', tier: 3, count: 1, kind: hint.kind };
  }
  const chen = hint.family === 'bowl' && hint.dishClass === 'solid';
  return { family: hint.family, tier: chen ? 1 : 2, dishClass: hint.dishClass };
}

/** The amount field's floor — whole grams, never 0 (the contract's ceiling is
 *  `MANUAL_ITEM_GRAMS_MAX`) — and one − / + press. */
export const MANUAL_GRAMS_MIN = 1;
export const MANUAL_GRAM_STEP = 10;

/** What a food's page opens at: its vessel's everyday tier, else 100 g. */
export function initialManualGrams(result: IngredientSearchResult): number {
  const vessel = vesselFromHint(result.vessel);
  if (!vessel) return 100;
  if (vessel.family === 'piece') {
    return vessel.count * PIECE_TIERS[vessel.tier - 1].grams;
  }
  return midG(vessel.family, vessel.tier, vessel.dishClass);
}

/** One − (-1) or + (1) press, landing on the next multiple of 10: 147 steps
 *  to 140 or 150. Null when it would leave the range. */
export function steppedManualGrams(
  grams: number,
  direction: 1 | -1
): number | null {
  const next =
    direction < 0
      ? (Math.ceil(grams / MANUAL_GRAM_STEP) - 1) * MANUAL_GRAM_STEP
      : (Math.floor(grams / MANUAL_GRAM_STEP) + 1) * MANUAL_GRAM_STEP;
  if (next < MANUAL_GRAM_STEP || next > MANUAL_ITEM_GRAMS_MAX) return null;
  return next;
}

/** The vessel ruler's span over its anchor grams (ascending): 10 g up to
 *  half again past its largest vessel. */
export function manualRulerRange(anchorGrams: number[]): {
  min: number;
  max: number;
} {
  return {
    min: Math.min(10, Math.floor(anchorGrams[0] / 2)),
    max: Math.round(anchorGrams[anchorGrams.length - 1] * 1.5),
  };
}

/** One food in the sheet's meal. */
export interface ManualSheetItem {
  id: string;
  ingredient: IngredientSearchResult;
  grams: number;
}

/** The sheet's items as the save path's form rows. The label falls back to
 *  the food's own name (`rowLabel`), so `query` stays empty. */
export function sheetItemsAsRows(items: ManualSheetItem[]) {
  return items.map((item) => ({
    id: item.id,
    query: '',
    ingredient: item.ingredient,
    grams: String(item.grams),
  }));
}

/** Calories of [food] at [grams]; null stays null (unknown ≠ 0). */
export function kcalAt(
  food: IngredientSearchResult,
  grams: number
): number | null {
  const per100 = food.per100g.caloriesKcal;
  return per100 == null ? null : (per100 * grams) / 100;
}

/** The meal's calories with `food` at `grams` in it — added, or replacing
 *  the amount of the item `replacing`. */
export function mealKcalWith(
  items: ManualSheetItem[],
  food: IngredientSearchResult,
  grams: number,
  replacing?: string
): number {
  const kept = items.filter((item) => item.id !== replacing);
  const total = totalsForRows(sheetItemsAsRows(kept)).caloriesKcal ?? 0;
  return total + (kcalAt(food, grams) ?? 0);
}
