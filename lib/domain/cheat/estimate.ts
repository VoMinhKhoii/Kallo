import { ThinkingLevel } from '@google/genai';
import { resolveModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import {
  type CheatEstimate,
  cheatEstimateSchema,
} from '@/lib/ai/pipeline/contracts/schemas/cheat-estimate';
import {
  buildCheatEstimatePrompt,
  type CheatEstimatePromptInput,
} from '@/lib/ai/prompts/build/cheat-estimate';
import { sanitizePromptContextValue } from '@/lib/ai/prompts/sanitize';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { CheatIntensity, CheatSliderSpec } from '@/lib/core/types/cheat';
import { canonicalizeAnchors, clampLevel } from './slider-nutrition';

export interface EstimateCheatMealInput {
  /** Raw free-text occasion description (sanitized inside). */
  description: string;
  /** Optional cheat-type chip the user tapped. */
  cheatType?: string | null;
  /** A prior clarifying-question answer, when re-calling after a vague input. */
  clarifyAnswer?: string | null;
  /** User-chosen indulgence magnitude (light/medium/heavy); defaults to medium. */
  cheatIntensity?: CheatIntensity;
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
 * Defensive repair so the always-visible 6-row UI and the interpolator in
 * `slider-nutrition.ts` always get a clean scale: clamp every authored level
 * into 0..10, then resample onto the six canonical stops (0/2/4/6/8/10) with
 * monotonic grams via `canonicalizeAnchors`, and clamp the default level into
 * range. The model is asked for the six stops directly; this guarantees them
 * regardless of drift.
 */
function normalizeCheatEstimate(raw: CheatEstimate): CheatSliderSpec {
  const sliders = raw.sliders.map((slider) => {
    const clamped = slider.anchors.map((anchor) => ({
      ...anchor,
      level: clampLevel(anchor.level),
    }));

    return {
      key: slider.key,
      label: slider.label,
      defaultLevel: clampLevel(slider.defaultLevel),
      anchors: canonicalizeAnchors(clamped),
    };
  });

  return {
    sliders,
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
    cheatIntensity: input.cheatIntensity,
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
