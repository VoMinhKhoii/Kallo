/**
 * Production-flippable model profile. Set `PIPELINE_MODEL_PROFILE=next` to
 * roll forward; unset (or any unknown value) falls back to `stable`.
 *
 * Note (2026-05-12): STABLE_PROFILE intentionally stays on
 * `gemini-2.5-flash-lite`. The factor-only nutrition contract (see
 * `lib/ai/pipeline/nutrition.ts`) removes the LLM's arithmetic
 * responsibility, so 2.5-flash-lite reliably handles the remaining
 * "set how wide the bounds should be" task. Switching to NEXT_PROFILE
 * (`gemini-3.1-flash-lite` + escalation) buys headroom but is not load-
 * bearing for correctness — the architectural fix is.
 */
export interface ModelProfile {
  decompositionModel: string;
  nutritionModel: string;
  /** When null, the orchestrator must not run escalation. */
  escalationModel: string | null;
}

export const STABLE_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-2.5-flash-lite',
  nutritionModel: 'gemini-2.5-flash-lite',
  escalationModel: null,
};

export const NEXT_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-3.1-flash-lite',
  nutritionModel: 'gemini-3.1-flash-lite',
  escalationModel: 'gemini-3-flash-preview',
};

export function resolveModelProfile(): ModelProfile {
  switch (process.env.PIPELINE_MODEL_PROFILE) {
    case 'next':
      return NEXT_PROFILE;
    default:
      return STABLE_PROFILE;
  }
}
