/**
 * STUB — Claude (Anthropic) adapter for the Call-2 grounded-estimation seam.
 *
 * NOT WIRED YET. This file completes the provider seam so the bakeoff harness
 * can `--estimator claude` and get a clear, actionable error instead of a
 * missing-export crash. It is intentionally dependency-free: `@anthropic-ai/sdk`
 * is NOT in package.json and must NOT be added by this phase.
 *
 * To wire (Phase 5 follow-up, tomorrow, when API keys + quota are available):
 *   1. `bun add @anthropic-ai/sdk`
 *   2. Construct an Anthropic client from `ANTHROPIC_API_KEY`.
 *   3. Call model `claude-haiku-4-5` with structured outputs (tool / JSON mode)
 *      mapping `groundedEstimationSchema`, honoring `abortSignal` for the
 *      shared deadline, streaming chunks to `hooks.onChunk` (accumulated text)
 *      so item_macros still emit progressively.
 *   4. Parse the response through `groundedEstimationSchema.parse` so the
 *      downstream bridge/assembly is unchanged.
 */

import type {
  GroundedEstimator,
  GroundedEstimatorInput,
  GroundedEstimatorResult,
  GroundedEstimatorStreamHooks,
} from './types';

export const CLAUDE_ESTIMATOR_MODEL = 'claude-haiku-4-5';

const NOT_WIRED_MESSAGE =
  'Claude estimator not yet wired — add @anthropic-ai/sdk + ANTHROPIC_API_KEY ' +
  `and call ${CLAUDE_ESTIMATOR_MODEL} with structured outputs (Phase 5 follow-up, tomorrow).`;

export function createClaudeEstimator(): GroundedEstimator {
  return {
    id: 'claude',
    model: CLAUDE_ESTIMATOR_MODEL,
    estimate(
      _input: GroundedEstimatorInput,
      _abortSignal: AbortSignal,
      _hooks?: GroundedEstimatorStreamHooks
    ): Promise<GroundedEstimatorResult> {
      throw new Error(NOT_WIRED_MESSAGE);
    },
  };
}
