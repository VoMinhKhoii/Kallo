import { ThinkingLevel } from '@google/genai';
import type { GeminiClient } from '@/lib/ai/gemini';
import {
  buildCheatEstimatePrompt,
  type CheatEstimatePromptInput,
} from '@/lib/ai/prompts/cheat-estimate';
import { sanitizePromptContextValue } from '@/lib/ai/prompts/sanitize';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types';
import { clampLevel } from '@/lib/cheat/slider-nutrition';
import type { CheatSliderSpec } from '@/lib/types/cheat';
import { resolveModelProfile } from './model-profile';
import { type CheatEstimate, cheatEstimateSchema } from './schemas';

export interface EstimateCheatMealInput {
  /** Raw free-text occasion description (sanitized inside). */
  description: string;
  /** Optional cheat-type chip the user tapped. */
  cheatType?: string | null;
  /** A prior clarifying-question answer, when re-calling after a vague input. */
  clarifyAnswer?: string | null;
  userContext: UserContext;
}

/**
 * Principle A: only the cooking-identity slice of UserContext reaches the
 * prompt. Goal/aggression/targets are dropped here, mirroring how the
 * decomposition/nutrition prompts are fed.
 */
function toPersonalizationContext(
  userContext: UserContext
): PromptPersonalizationContext {
  return {
    countryOfOrigin: userContext.countryOfOrigin,
    countryOfResidence: userContext.countryOfResidence,
    cookingHabits: userContext.cookingHabits,
    inputLanguage: userContext.inputLanguage,
    outputLanguage: userContext.outputLanguage,
  };
}

/**
 * Defensive repair so the interpolator in `slider-nutrition.ts` can never
 * divide by zero or invert: clamp every level into 0..10, ensure each slider
 * spans level 0 and level 10 by stretching the nearest anchors, and clamp the
 * default level into range.
 */
function normalizeCheatEstimate(raw: CheatEstimate): CheatSliderSpec {
  const sliders = raw.sliders.map((slider) => {
    const anchors = slider.anchors
      .map((anchor) => ({ ...anchor, level: clampLevel(anchor.level) }))
      .sort((a, b) => a.level - b.level);

    // Guarantee endpoints at 0 and 10 (stretch the nearest anchor outward).
    if (anchors.length > 0 && anchors[0].level > 0) {
      anchors[0] = { ...anchors[0], level: 0 };
    }
    if (anchors.length > 0 && anchors[anchors.length - 1].level < 10) {
      anchors[anchors.length - 1] = {
        ...anchors[anchors.length - 1],
        level: 10,
      };
    }

    return {
      key: slider.key,
      label: slider.label,
      defaultLevel: clampLevel(slider.defaultLevel),
      anchors,
    };
  });

  return {
    sliders,
    rationale: raw.rationale,
    mealSlot: raw.mealSlot,
    confidence: raw.confidence,
    ...(raw.clarifyingQuestion
      ? { clarifyingQuestion: raw.clarifyingQuestion }
      : {}),
  };
}

/**
 * Estimate a cheat-meal occasion as a set of labeled 0–10 sliders. One
 * reasoning-enabled, non-streaming structured call — it bypasses
 * decomposition and DB matching entirely. Returns the slider spec; final
 * nutrition is resolved later (client preview + server-authoritative confirm)
 * once the user places the sliders.
 */
export async function estimateCheatMeal(
  input: EstimateCheatMealInput,
  gemini: GeminiClient,
  emit?: (event: StreamEvent) => void
): Promise<CheatSliderSpec> {
  // Reuse the existing 'estimating' stage so the client phase mapper works.
  emit?.({ type: 'stage', stage: 'estimating' });

  const description = sanitizePromptContextValue(input.description);
  const cheatType = input.cheatType
    ? sanitizePromptContextValue(input.cheatType)
    : null;
  const clarifyAnswer = input.clarifyAnswer
    ? sanitizePromptContextValue(input.clarifyAnswer)
    : null;

  const promptInput: CheatEstimatePromptInput = {
    description,
    cheatType,
    clarifyAnswer,
    userContext: toPersonalizationContext(input.userContext),
  };

  const systemPrompt = buildCheatEstimatePrompt(promptInput);
  const { nutritionModel } = resolveModelProfile();

  const raw = await gemini.generateStructuredOutput<CheatEstimate>({
    schema: cheatEstimateSchema,
    systemPrompt,
    userMessage: description,
    model: nutritionModel,
    // Label quality (occasion-specific anchors, fat-source synthesis) depends
    // on reasoning — turn it up for this one call.
    thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
  });

  return normalizeCheatEstimate(raw);
}
