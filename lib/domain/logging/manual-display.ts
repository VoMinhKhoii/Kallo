// What the manual-log surfaces print and compute for a food — the subtitle
// under its name, the vessel its amount ruler offers, where its amount opens
// and how − / + step — and for the phone sheets' plate: its totals and the
// peek strip over it. Pure, and mirrored by the Flutter app's
// `features/logging/logic/manual/` (keep in sync).

import { PIECE_TIERS } from '@/lib/ai/portion/data/vessel-tables';
import { containerAnchorG } from '@/lib/ai/portion/vessel/geometry';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';
import {
  type IngredientMacrosPer100g,
  type IngredientSearchResult,
  type IngredientVesselHint,
  MANUAL_ITEM_GRAMS_MAX,
  macrosAt,
  sumMacros,
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
  return {
    family: hint.family,
    tier: chen ? 1 : 2,
    dishClass: hint.dishClass,
    ...(hint.smallBowlG !== undefined ? { smallBowlG: hint.smallBowlG } : {}),
  };
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
  return containerAnchorG(vessel, vessel.tier);
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

const EMPTY_PLATE: IngredientMacrosPer100g = {
  caloriesKcal: 0,
  proteinG: 0,
  carbohydrateG: 0,
  fatG: 0,
};

/** The plate's totals. An empty plate is a known 0; on a plate with food, a
 *  nutrient none of its foods carries is unknown — null, shown "—". */
export function plateTotals(items: ManualSheetItem[]): IngredientMacrosPer100g {
  return items.length === 0
    ? EMPTY_PLATE
    : sumMacros(items.map((item) => macrosAt(item.ingredient, item.grams)));
}

/** A food's page open over the plate: a new food, or the item it edits. */
export interface ManualPeekPage {
  food: IngredientSearchResult;
  grams: number;
  itemId: string | null;
}

/** What the add sheet's peek strip says about the plate under it. */
export type ManualPeek =
  | { kind: 'empty' }
  | { kind: 'total'; count: number; kcal: number | null }
  | {
      kind: 'with' | 'after';
      count: number;
      kcal: number | null;
      after: number;
    };

/**
 * The peek strip: what is on the plate and — with a food's page open — what
 * the plate becomes with it, added ("with") or at its new amount ("after").
 * Nothing after the arrow for a food with no calorie figure, or for an edit
 * that has not moved the total. Pass no page for a food the plate cannot take.
 */
export function manualPeek(
  items: ManualSheetItem[],
  page: ManualPeekPage | null
): ManualPeek {
  if (!page && items.length === 0) return { kind: 'empty' };
  const count = items.length;
  const kcal = plateTotals(items).caloriesKcal;
  const added = page ? macrosAt(page.food, page.grams).caloriesKcal : null;
  if (!page || added == null) return { kind: 'total', count, kcal };
  const kept = items.filter((item) => item.id !== page.itemId);
  // What the plate will total once the food is in: a food on it with no
  // calorie figure counts for nothing here, exactly as in `plateTotals` (the
  // sum of the values its foods carry), so this is the figure the ring will
  // show — known even while the plate alone reads "—".
  const after = (plateTotals(kept).caloriesKcal ?? 0) + added;
  const unmoved =
    page.itemId !== null &&
    kcal !== null &&
    Math.round(after) === Math.round(kcal);
  if (unmoved) return { kind: 'total', count, kcal };
  return { kind: page.itemId ? 'after' : 'with', count, kcal, after };
}
