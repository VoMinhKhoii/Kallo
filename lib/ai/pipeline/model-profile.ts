/**
 * Production-flippable model profile. Set `PIPELINE_MODEL_PROFILE=next` to
 * roll forward; unset (or any unknown value) falls back to `stable`.
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
  decompositionModel: 'gemini-3.1-flash-lite-preview',
  nutritionModel: 'gemini-3.1-flash-lite-preview',
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
