/**
 * Estimator selection + pricing for the Call-2 bakeoff harness.
 *
 * The default runtime path never touches this file — the orchestrator builds
 * the Gemini estimator directly. This selector exists for the offline eval
 * harness (`--estimator gemini|claude|openai`) so tomorrow's bakeoff can swap
 * adapters. The Claude/OpenAI adapters are stubs that throw until wired.
 */

import type { GeminiClient } from '@/lib/ai/gemini';
import { createClaudeEstimator } from './claude-estimator';
import { createGeminiEstimator } from './gemini-estimator';
import { createOpenAiEstimator } from './openai-estimator';
import type { GroundedEstimator } from './types';

export type EstimatorName = 'gemini' | 'claude' | 'openai';

export const ESTIMATOR_NAMES: EstimatorName[] = ['gemini', 'claude', 'openai'];

export function isEstimatorName(value: string): value is EstimatorName {
  return (ESTIMATOR_NAMES as string[]).includes(value);
}

/**
 * Build the estimator for the given name. `gemini` needs the live client +
 * model; the stubs need neither (they throw before any call). Kept separate
 * from the orchestrator's direct construction so production stays Gemini-only.
 */
export function selectEstimator(
  name: EstimatorName,
  deps: { gemini: GeminiClient; geminiModel: string }
): GroundedEstimator {
  switch (name) {
    case 'gemini':
      return createGeminiEstimator(deps.gemini, deps.geminiModel);
    case 'claude':
      return createClaudeEstimator();
    case 'openai':
      return createOpenAiEstimator();
  }
}

/**
 * Published per-1M-token USD pricing for the bakeoff cost column.
 *
 * TODO(phase5-followup): CONFIRM these against each provider's live pricing
 * page before trusting the cost report — they are placeholders captured from
 * public list prices and models/prices move. The bakeoff report multiplies
 * (input/output tokens × the rate below); a stale rate silently skews the
 * cost ranking, so re-verify on the day of the run.
 */
export interface TokenPricing {
  /** USD per 1,000,000 input (prompt) tokens. */
  inputPerMTokUsd: number;
  /** USD per 1,000,000 output (completion) tokens. */
  outputPerMTokUsd: number;
}

export const ESTIMATOR_PRICING: Record<EstimatorName, TokenPricing> = {
  // gemini-3-flash-class (bakeoff candidate for Call 2's `next` profile).
  gemini: { inputPerMTokUsd: 0.3, outputPerMTokUsd: 2.5 },
  // claude-haiku-4-5.
  claude: { inputPerMTokUsd: 1.0, outputPerMTokUsd: 5.0 },
  // gpt-5-mini-class.
  openai: { inputPerMTokUsd: 0.25, outputPerMTokUsd: 2.0 },
};

/** Cost in USD for a single Call-2 invocation given its token usage. */
export function estimatorCostUsd(
  name: EstimatorName,
  inputTokens: number,
  outputTokens: number
): number {
  const p = ESTIMATOR_PRICING[name];
  return (
    (inputTokens / 1_000_000) * p.inputPerMTokUsd +
    (outputTokens / 1_000_000) * p.outputPerMTokUsd
  );
}
