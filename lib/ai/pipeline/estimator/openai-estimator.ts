/**
 * STUB — OpenAI (GPT) adapter for the Call-2 grounded-estimation seam.
 *
 * NOT WIRED YET. Mirrors the Claude stub: completes the provider seam so the
 * bakeoff harness can `--estimator openai` and fail loudly with a clear next
 * step. Intentionally dependency-free — `openai` is NOT in package.json and
 * must NOT be added by this phase.
 *
 * To wire (Phase 5 follow-up, tomorrow, when API keys + quota are available):
 *   1. `bun add openai`
 *   2. Construct an OpenAI client from `OPENAI_API_KEY`.
 *   3. Call a GPT-5-mini-class model with structured outputs (response_format
 *      json_schema) mapping `groundedEstimationSchema`, honoring `abortSignal`
 *      for the shared deadline and streaming accumulated text to `hooks.onChunk`.
 *   4. Parse through `groundedEstimationSchema.parse` so downstream is unchanged.
 */

import type {
  GroundedEstimator,
  GroundedEstimatorInput,
  GroundedEstimatorResult,
  GroundedEstimatorStreamHooks,
} from './types';

/** Confirm the exact GPT-5-mini-class model string when wiring. */
export const OPENAI_ESTIMATOR_MODEL = 'gpt-5-mini';

const NOT_WIRED_MESSAGE =
  'OpenAI estimator not yet wired — add openai + OPENAI_API_KEY and call a ' +
  `${OPENAI_ESTIMATOR_MODEL}-class model with structured outputs (Phase 5 follow-up, tomorrow).`;

export function createOpenAiEstimator(): GroundedEstimator {
  return {
    id: 'openai',
    model: OPENAI_ESTIMATOR_MODEL,
    estimate(
      _input: GroundedEstimatorInput,
      _abortSignal: AbortSignal,
      _hooks?: GroundedEstimatorStreamHooks
    ): Promise<GroundedEstimatorResult> {
      throw new Error(NOT_WIRED_MESSAGE);
    },
  };
}
