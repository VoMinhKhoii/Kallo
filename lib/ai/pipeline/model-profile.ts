/**
 * Production-flippable model profile. Set `PIPELINE_MODEL_PROFILE=next` to
 * roll forward; unset (or any unknown value) falls back to `stable`.
 *
 * Note (2026-05-13): decompositionModel bumped to `gemini-3.1-flash-lite`
 * because Vietnamese quantifier reasoning is the reasoning-heaviest step in
 * the pipeline (parsing "3 sườn non" vs "default protein portion", "8 cây
 * nem lụi" vs "1 phần"). 3.1 had zero anomalies on 2026-05-08 under the
 * verbose decomposition prompt; 2.5 regressed once a precedence rule was
 * needed.
 *
 * nutritionModel intentionally stays on `gemini-2.5-flash-lite`. Under the
 * 2026-05-13 fat-only contract (see `lib/ai/pipeline/nutrition.ts`), Call 2
 * only adjusts fat for matched ingredients — protein, carb, and calories are
 * server-anchored from DB × grams. 2.5-flash-lite handles that comfortably.
 */
export interface ModelProfile {
  decompositionModel: string;
  nutritionModel: string;
  /** When null, the orchestrator must not run escalation. */
  escalationModel: string | null;
}

export const STABLE_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-3.1-flash-lite',
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
