import type { MealConfidence, MealSlot } from '@/lib/ai/types';

/**
 * Cheat-meal slider model.
 *
 * Instead of itemizing a buffet, the AI turns the occasion into a small set of
 * labeled 0–10 sliders the user places themselves on. Each macro slider owns
 * exactly one nutrient axis (Meat→protein, Rice/Carbs→carbs, Fat/Richness→fat);
 * the optional Drinks slider is the one multi-nutrient axis (soda→carbs,
 * creamy→fat, alcohol→ethanol). Calories derive from 4·P + 4·C + 9·F + 7·alcohol.
 */
export type CheatSliderKey = 'protein' | 'carbs' | 'fat' | 'drinks';

/** User-chosen indulgence magnitude for a cheat occasion (scales anchor grams). */
export type CheatIntensity = 'light' | 'medium' | 'heavy';

/**
 * A sparse keypoint on a slider. The AI authors a handful of these (it MUST
 * include level 0 and level 10); grams at intermediate levels are interpolated.
 * Macro sliders carry only their own axis; drinks anchors carry
 * carbohydrateG/fatG/alcoholG.
 */
export interface CheatSliderAnchor {
  /** 0..10 position on the slider. */
  level: number;
  /** Context-interpretable scenario, localized, e.g. "vài miếng nigiri". */
  label: string;
  proteinG?: number;
  carbohydrateG?: number;
  fatG?: number;
  alcoholG?: number;
}

export interface CheatSlider {
  key: CheatSliderKey;
  /** Localized dial name, e.g. "Thịt / hải sản". */
  label: string;
  /** 0..10 — the AI's single best guess; the slider starts here. */
  defaultLevel: number;
  anchors: CheatSliderAnchor[];
}

/** Rare fallback when the free-text is too vague to anchor sliders. */
export interface CheatClarifyingQuestion {
  prompt: string;
  options?: string[];
}

/** Full estimator output, staged in pending_analyses and meals.cheat_sliders. */
export interface CheatSliderSpec {
  sliders: CheatSlider[];
  mealSlot: MealSlot | null;
  confidence: MealConfidence;
  /** Present only when the model could not set sensible anchors. */
  clarifyingQuestion?: CheatClarifyingQuestion;
}

/** Chosen slider positions keyed by slider key (0..10). */
export type CheatSliderLevels = Partial<Record<CheatSliderKey, number>>;

/** Persisted JSONB shape in meals.cheat_sliders — spec + the user's choices. */
export interface CheatSlidersPersisted {
  spec: CheatSliderSpec;
  levels: CheatSliderLevels;
}
