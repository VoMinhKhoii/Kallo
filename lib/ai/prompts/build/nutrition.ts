import { buildNutritionPromptParts } from '@/lib/ai/prompts/build/nutrition-xml';
import {
  compressedNutritionPromptText,
  nutritionPromptText,
} from '@/lib/ai/prompts/text/nutrition';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { DecomposedMealItem } from '@/lib/ai/types/decomposition';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { MacroBase } from '@/lib/ai/types/nutrition-adjustment';

/**
 * Principle A (spec §2): the LLM produces honest physical-world estimates
 * conditioned only on the meal text and the user's cooking identity (country
 * of origin/residence, cookingHabits). Goal, aggression, and calorie targets
 * NEVER reach this prompt — TypeScript enforces the boundary via
 * PromptPersonalizationContext.
 *
 * Spec: docs/superpowers/specs/2026-04-27-ai-pipeline-prompt-context-engineering-design.md
 */

/**
 * Build the system prompt for LLM Call 2 (cooking-adjusted bounded nutrition).
 *
 * V2: Compressed instructions, no hardcoded % — LLM decides bounds.
 * Dynamic XML data sections kept verbatim.
 *
 * Note: grams from Step 1 are as-eaten weights. db_state tells the LLM
 * whether the DB per-100g row is raw/cooked/unknown.
 */

export const NUTRITION_PROMPT_LABEL_ENV = 'PIPELINE_NUTRITION_PROMPT_LABEL';

export type NutritionPromptLabel = 'production' | 'compressed';
export type NutritionPromptBuilder = (
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  // Optional in the type so test/fixture callers without DB context can still
  // render the prompt; the orchestrator always supplies a populated map.
  baseMap?: Map<string, MacroBase>
) => string;

export function getNutritionPromptLabel(
  env: Record<string, string | undefined> = process.env
): NutritionPromptLabel {
  // Default 'compressed' (set 2026-05-09). The 2026-05-12 macro-anchor fix
  // and the 2026-05-13 fat-only contract together make this safe under any
  // STABLE_PROFILE model: the server does all P/C/kcal math for matched
  // ingredients and only the fat triple actually flows downstream. Set
  // `PIPELINE_NUTRITION_PROMPT_LABEL=production` to render the verbose prompt
  // for debugging.
  return env[NUTRITION_PROMPT_LABEL_ENV] === 'production'
    ? 'production'
    : 'compressed';
}

export function getNutritionPromptBuilder(
  label: NutritionPromptLabel = getNutritionPromptLabel()
): NutritionPromptBuilder {
  return label === 'compressed'
    ? buildCompressedNutritionPrompt
    : buildNutritionPrompt;
}

export function buildCompressedNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  baseMap: Map<string, MacroBase> = new Map()
): string {
  const parts = buildNutritionPromptParts(
    mealItems,
    matched,
    unmatched,
    userContext,
    baseMap
  );
  const outputLanguage = userContext.outputLanguage ?? 'match_user_input';

  return compressedNutritionPromptText(parts, outputLanguage);
}

export function buildNutritionPrompt(
  mealItems: DecomposedMealItem[],
  matched: MatchedIngredient[],
  unmatched: UnmatchedIngredient[],
  userContext: PromptPersonalizationContext,
  baseMap: Map<string, MacroBase> = new Map()
): string {
  const parts = buildNutritionPromptParts(
    mealItems,
    matched,
    unmatched,
    userContext,
    baseMap
  );

  return nutritionPromptText(parts);
}
