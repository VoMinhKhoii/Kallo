/**
 * Production-flippable model profile. Set `PIPELINE_MODEL_PROFILE=next` to
 * roll forward, or `haiku` to run both calls on Claude Haiku 5.5; unset (or
 * any unknown value) falls back to `stable`.
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
import type { Call2Chunking } from '@/lib/ai/pipeline/estimator/chunk-policy';

export interface ModelProfile {
  decompositionModel: string;
  nutritionModel: string;
  /** When null, the orchestrator must not run escalation. */
  escalationModel: string | null;
  /** The cheat-meal range estimate (`lib/domain/cheat/estimate.ts`). */
  cheatModel: string;
  /** When Call 2 splits into parallel calls; unset = large meals only. */
  call2Chunking?: Call2Chunking;
}

/**
 * Call 2's time is mostly output, on Gemini and Claude alike, so a meal over
 * 10 ingredients is split into calls of up to 8 that run side by side (a
 * 26-ingredient meal measured ~10.5 s → ~5.5 s on Haiku; a single 2,100-token
 * Gemini Call 2 took 16 s). Six at once keeps an 18-ingredient meal in one wave.
 */
const PARALLEL_CALL2: Call2Chunking = {
  aboveIngredients: 10,
  aboveMealItems: 12,
  targetIngredients: 8,
  concurrency: 6,
};

export const STABLE_PROFILE: ModelProfile = {
  decompositionModel: 'gemini-3.1-flash-lite',
  nutritionModel: 'gemini-3.1-flash-lite',
  escalationModel: null,
  cheatModel: 'gemini-3.1-flash-lite',
  call2Chunking: PARALLEL_CALL2,
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
  cheatModel: 'gemini-3-flash-preview',
  call2Chunking: PARALLEL_CALL2,
};

/**
 * Claude Haiku 5.5 for both calls (`PIPELINE_MODEL_PROFILE=haiku`), for a
 * production trial: the Meal Arena hill climb (ttr DEV-129) was tuned on
 * Haiku. Every Claude call falls back to the stable Gemini model on any
 * failure (`createPipelineLlm`), so this profile cannot take the pipeline
 * down. Escalation stays off, and the cheat-meal estimate stays on Gemini:
 * only the two benchmarked calls move.
 */
export const HAIKU_PROFILE: ModelProfile = {
  decompositionModel: 'claude-haiku-5-5',
  nutritionModel: 'claude-haiku-5-5',
  escalationModel: null,
  cheatModel: STABLE_PROFILE.cheatModel,
  call2Chunking: PARALLEL_CALL2,
};

/** The Gemini model a Claude call re-runs on when Claude fails. */
export const CLAUDE_FALLBACK_MODEL = STABLE_PROFILE.nutritionModel;

export function resolveModelProfile(): ModelProfile {
  switch (process.env.PIPELINE_MODEL_PROFILE) {
    case 'next':
      return NEXT_PROFILE;
    case 'haiku':
      return HAIKU_PROFILE;
    default:
      return STABLE_PROFILE;
  }
}
