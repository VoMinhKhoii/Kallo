/**
 * Production-flippable model profile. Set `PIPELINE_MODEL_PROFILE=next` to
 * roll forward; unset (or any unknown value) falls back to `stable`.
 *
 * Note (2026-05-18): both calls now sit on `gemini-3.1-flash-lite` in
 * preparation for the v2 pipeline (Call 1 pure-decompose, Call 2
 * grounded-estimation + CRAG match verdict + grams + macros). Call 2's
 * reasoning load grows because it owns grams + verdict, so 2.5-flash-lite
 * is no longer right-sized. 3.1-flash-lite handles Vietnamese quantifier
 * reasoning and per-food yield estimation with the same latency tier.
 *
 * If Call 2 quality regresses on shadow A/B, fall back by setting the
 * model env override or rolling NEXT_PROFILE.
 */
export interface ModelProfile {
  decompositionModel: string;
  nutritionModel: string;
  /** When null, the orchestrator must not run escalation. */
  escalationModel: string | null;
}

export const STABLE_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-3.1-flash-lite',
  nutritionModel: 'gemini-3.1-flash-lite',
  escalationModel: null,
};

/**
 * Phase-4 A/B CANDIDATE. `next` moves Call 2 (grounded nutrition estimation)
 * onto `gemini-3-flash-preview` while Call 1 (decomposition) stays on
 * flash-lite — decomposition is cheap and already accurate. This profile is
 * NOT the deployed default: `resolveModelProfile()` returns `STABLE_PROFILE`
 * unless `PIPELINE_MODEL_PROFILE=next` is set. The flip is an ops decision made
 * only after tomorrow's live eval confirms latency stays in budget (Call-2 p90
 * must remain <10s); it is deliberately NOT hard-coded here. Roll forward /
 * back purely via the `PIPELINE_MODEL_PROFILE` env var. `escalationModel` uses
 * the same string so an in-profile escalation re-runs Call 2 on the same model
 * tier when the escalation flag is opted in (see grounded-orchestrator).
 */
export const NEXT_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-3.1-flash-lite',
  nutritionModel: 'gemini-3-flash-preview',
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
