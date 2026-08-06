/**
 * The v2 bridge's output contract.
 *
 * Split out of `bridge.ts` so the shape can be imported without pulling in the
 * translation algorithm — `completeness-gate.ts` needs only `CarvedOutIngredient`
 * to decide whether a meal may persist, and the algorithm module is at the
 * repo's 400-line ceiling.
 */

import type { MatchedIngredient, UnmatchedIngredient } from '../types';
import type { NoMacroReason } from './bridge-macros';
import type { MealDecompositionWithIds } from './ids';
import type { RawNutritionAdjustment } from './nutrition';
import type { IngredientPlausibility } from './plausibility';
import type { GroundedIngredientEstimate } from './schemas-v2';

export interface VerdictPerIngredient {
  /** Position in the original decomposition (meal-item, ingredient) tuple. */
  mealItemIdx: number;
  ingredientIdx: number;
  /** What the LLM decided. */
  verdict: 'accepted' | 'rejected' | 'unmatched' | 'missing';
  /** Selected candidate index inside the ingredient's candidate list when accepted. */
  selectedCandidateIdx: number | null;
  /** Set on rejected verdicts; passed through to telemetry. */
  rejectReason: string | null;
  /** Reference to the v2 grounded output (null when missing). */
  grounded: GroundedIngredientEstimate | null;
}

/**
 * Per-ingredient plausibility trail (flat order, one entry per decomposed
 * ingredient). TELEMETRY ONLY — it does not gate: an `unresolved_estimate`
 * ingredient still ships with real grams and the user corrects the portion with
 * the visual picker. Only `bridgeV2ToV1`'s no-data carve-out withholds a row.
 */
export interface PlausibilityPerIngredient {
  mealItemIdx: number;
  ingredientIdx: number;
  /** Run-scoped ingredient id (assigned after `ensureIdsOnDecomposition`). */
  ingredientId: string;
  /** Ingredient display name (rawName). */
  ingredientName: string;
  /** Owning meal-item display name. */
  mealItemName: string;
  state: IngredientPlausibility;
  /**
   * When `state === 'unresolved_estimate'`, why. 'ambiguous_food' when the
   * portion resolver couldn't scope the concept; 'unresolved_portion' (default)
   * for a missing/too-wide portion. Diagnostic label for the admin trace.
   */
  unresolvedReason?: 'ambiguous_food' | 'unresolved_portion' | 'explicit_zero';
}

export interface V2BridgeOutput {
  /** v1-shape decomposition with run-scoped IDs and grams emitted by Call 2. */
  decomposition: MealDecompositionWithIds;
  /** Matched ingredients with DB-anchored per_100g and run-scoped IDs. */
  matched: MatchedIngredient[];
  /** Unmatched ingredients (no candidates OR verdict=rejected). */
  unmatched: UnmatchedIngredient[];
  /** v1-shape RawNutritionAdjustment built from Call 2 macros. */
  rawNutrition: RawNutritionAdjustment;
  /** Per-ingredient verdict trail for telemetry / shadow-divergence dashboards. */
  verdicts: VerdictPerIngredient[];
  /** Per-ingredient plausibility classification (Phase 1 silent-zero kill). */
  plausibility: PlausibilityPerIngredient[];
  /**
   * Ingredients the no-data carve-out withheld, excluding `explicit_zero`.
   *
   * A carve-out removes real food from the meal's totals. The route's
   * `empty_nutrition` check is `meal.items.some(...)`, so a single healthy
   * sibling carries the whole meal past it — "1 tô mì gói + sữa" saved as a
   * 0g/0kcal "Mì gói" row next to a 152 kcal "Sữa tươi" row, and the noodles
   * silently left the day's numbers. The console.warn was the only trace.
   * Surfacing the list lets the completeness gate fail the analysis instead.
   *
   * The FULL list is reported here regardless of materiality — the gate decides
   * which entries are worth failing on (see `resolveCompletenessGate`), while
   * telemetry keeps every carve-out.
   *
   * `explicit_zero` is deliberately NOT reported: "0 fried chicken" means the
   * row is SUPPOSED to be absent, and gating there would break a meal the
   * user described correctly.
   */
  carvedOut: CarvedOutIngredient[];
}

/** An ingredient the bridge withheld because it had no usable macro source. */
export interface CarvedOutIngredient {
  mealItemName: string;
  ingredientName: string;
  reason: NoMacroReason;
  /** Owning meal item's index — disambiguates two items sharing a name. */
  mealItemIdx: number;
  /**
   * How many ingredients the owning meal item has in total. The gate needs it
   * to tell "the whole item was withheld" from "one garnish among five".
   */
  mealItemIngredientCount: number;
}
