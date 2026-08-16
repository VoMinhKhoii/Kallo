import { buildPromptContextLine } from '@/lib/ai/prompts/sanitize';
import { cheatEstimatePromptText } from '@/lib/ai/prompts/text/cheat-estimate';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { CheatIntensity } from '@/lib/types/cheat';

/**
 * Cheat-meal slider estimator prompt.
 *
 * Principle A (spec §2): like decomposition/nutrition, this prompt sees ONLY
 * the meal text and the user's cooking identity (country of origin/residence,
 * cookingHabits). Goal, aggression, and calorie targets NEVER reach it —
 * TypeScript enforces the boundary via PromptPersonalizationContext.
 *
 * The model turns a cheat occasion into a few labeled 0–10 sliders. Each macro
 * slider owns ONE nutrient and carries context-interpretable anchors; the
 * optional drinks slider is the one multi-nutrient axis. Most of the reasoning
 * budget goes to the FAT slider, whose grams come from many sources that vary
 * by occasion (fatty cuts, frying, butter/cheese, creamy desserts, sauces).
 */

export interface CheatEstimatePromptInput {
  /** Sanitized free-text occasion description. */
  description: string;
  /** Optional cheat-type chip the user tapped (e.g. "Korean BBQ"). */
  cheatType?: string | null;
  /** A prior clarifying-question answer, when re-calling after a vague input. */
  clarifyAnswer?: string | null;
  /** User-chosen indulgence magnitude — scales the anchor gram ranges. */
  cheatIntensity?: CheatIntensity;
  userContext: PromptPersonalizationContext;
}

function buildCountryContextLines(
  userContext: PromptPersonalizationContext
): string[] {
  return [
    buildPromptContextLine('country_of_origin', userContext.countryOfOrigin),
    buildPromptContextLine(
      'country_of_residence',
      userContext.countryOfResidence
    ),
  ].filter((line): line is string => line !== null);
}

export function buildCheatEstimatePrompt(
  input: CheatEstimatePromptInput
): string {
  const { description, cheatType, clarifyAnswer, userContext } = input;
  const { cookingHabits } = userContext;
  const countryLines = buildCountryContextLines(userContext);
  const outputLanguage = userContext.outputLanguage ?? 'match_user_input';
  const intensity = input.cheatIntensity ?? 'medium';

  const occasionLines = [
    buildPromptContextLine('description', description),
    buildPromptContextLine('occasion_type', cheatType ?? undefined),
    buildPromptContextLine('clarifying_answer', clarifyAnswer ?? undefined),
  ].filter((line): line is string => line !== null);

  return cheatEstimatePromptText({
    cookingHabits,
    countryLines,
    occasionLines,
    outputLanguage,
    intensity,
  });
}
