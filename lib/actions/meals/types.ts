// Client-facing meal shapes returned by the read/write actions in this folder.
// Kept in a plain (non-'use server') module so they can be imported as types
// from anywhere without dragging in the server-action runtime.
import type { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import type { NutritionValues } from '@/lib/ai/types/nutrition-values';
import type { CheatSliderSpec, CheatSlidersPersisted } from '@/lib/types/cheat';

/** Persisted meal returned to client */
export interface PersistedMeal {
  id: string;
  rawInput: string;
  mealSlot: string | null;
  confidenceOverall: string | null;
  loggedAt: string;
  nutrition: NutritionValues;
  mealItemGroups: PersistedMealItemGroup[];
  /** 'precise' (default pipeline) or 'cheat' (slider estimate). */
  entryMode: 'precise' | 'cheat';
  /** Cheat-only: ethanol grams folded into the calorie total. */
  alcoholG: number | null;
  /** Cheat-only: slider spec + chosen levels, for re-edit/repeat. */
  cheatSliders: CheatSlidersPersisted | null;
  /** Circle-share state, or null if the meal was never shared. `shareId` is the
   *  meal_shares row id used to key the shareable Macro Card. Lets the card seed
   *  the share toggle from real server state instead of always "not shared". */
  share: { shareId: string; visibility: string } | null;
  /** Fraction of the natural full portion this meal represents: 1 (or absent)
   *  for a normal meal / full copy, <1 for a split share. Drives the "½ portion"
   *  chip and hides NL-refine (which would re-estimate the full portion). */
  portionFactor?: number;
}

export interface PersistedMealItemGroup {
  name: string;
  order: number;
  ingredients: PersistedIngredient[];
  nutrition: NutritionValues;
}

export interface PersistedIngredient {
  id: string;
  ingredientName: string;
  foodCompositionId: string | null;
  estimatedGrams: number | null;
  userFacingUnit: string | null;
  cookingMethod: string | null;
  matchConfidence: number | null;
  nutrition: NutritionValues;
}

export interface PendingMealConfirmation {
  id: string;
  rawInput: string;
  loggedAt: string;
  /** Set for precise entries. Absent for cheat entries (which carry cheatSpec). */
  parsedMeal?: ReturnType<typeof toParsedMeal>;
  /** Set for cheat entries: the staged slider spec the user confirms against. */
  cheatSpec?: CheatSliderSpec;
}

export interface LoggingDayData {
  persistedMeals: PersistedMeal[];
  pendingConfirmations: PendingMealConfirmation[];
}

/**
 * Return shape of `confirmAndSaveMealAction`. `mealId` is kept for backward
 * compatibility (the mobile `POST /api/v1/meals/confirm` route echoes it);
 * `meal` is the authoritative saved meal the web client reconciles against
 * without a follow-up day refetch. Re-exported via lib/api/contracts/meals.ts.
 */
export interface ConfirmMealResponse {
  mealId: string;
  meal: PersistedMeal;
}

/** A distinct past cheat occasion, surfaced as a chip above the input. */
export interface RecentCheatOccasion {
  /** Source meal id — re-staged on tap to seed a fresh slider card. */
  mealId: string;
  /** The occasion text (e.g. "Korean BBQ buffet"), shown on the chip. */
  rawInput: string;
  loggedAt: string;
}
