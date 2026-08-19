/**
 * Provider-agnostic Call-2 (grounded nutrition estimation) seam.
 *
 * Call 2 is the second LLM call in the v2 pipeline: given the decomposed meal
 * items + their top-K DB candidates + server-resolved gram anchors, the model
 * runs a CRAG verdict per ingredient, estimates grams, and emits bounded
 * macros. Today that call is Gemini-only and lives inline in the orchestrator.
 *
 * This interface lifts Call 2 behind a plug-in seam so a bakeoff
 * (gemini-3-flash vs claude-haiku-4-5 vs a GPT-5-mini-class model) can select
 * an adapter without touching the orchestrator. Each adapter OWNS its own
 * prompt construction, schema mapping, retries, streaming, and usage/latency
 * telemetry — the orchestrator only hands it the rendered-independent input
 * and a streaming sink, and receives a parsed `GroundedEstimation`.
 *
 * The default runtime path stays the Gemini adapter — no behavior change in
 * production. The Claude/OpenAI adapters are clearly-marked stubs until their
 * SDKs are wired (Phase 5 follow-up, tomorrow).
 */

import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';
import type { GeminiCallTrace } from '@/lib/ai/provider/provider';

/**
 * Structured, provider-independent Call-2 input. Deliberately NOT a rendered
 * prompt string: each adapter renders its own prompt from this data so the
 * seam is genuinely pluggable (a Claude adapter may want a different prompt
 * layout than the Gemini one). Mirrors exactly what the orchestrator passes to
 * `buildGroundedEstimationPrompt` today plus the Call-2 knobs.
 */
export interface GroundedEstimatorInput {
  /** The user's verbatim meal text (goes into <original_prompt>). */
  originalPrompt: string;
  /** Decomposed meal items with their top-K candidates + resolved-gram anchors. */
  mealItems: MealItemWithCandidates[];
  /** Personalization context (country, cooking habits) for the prompt. */
  userContext: PromptPersonalizationContext;
  /** Call-2 sampling temperature (orchestrator default 0.4). */
  temperature: number;
}

/**
 * Per-attempt streaming + retry hooks. `onChunk` receives the ACCUMULATED
 * text so the orchestrator's identity-mapped item_macros parser can emit
 * progressive per-item events. `onAttemptStart` lets the caller reset its
 * stream cursors before a provider retry re-streams from scratch.
 */
export interface GroundedEstimatorStreamHooks {
  onAttemptStart?: (attempt: number) => void;
  onChunk?: (accumulated: string) => void;
  /** Optional per-call LLM trace (prompt-version + response persistence). */
  trace?: GeminiCallTrace;
  /**
   * Per-attempt token/error usage — feeds the analysis model-budget guards
   * (`analysis_model_budget_events`). Structurally compatible with the gemini
   * client's attempt metadata; adapters for other providers map into it.
   */
  onAttemptComplete?: (usage: EstimatorAttemptUsage) => void;
}

/**
 * Provider-agnostic per-attempt usage record (structurally identical to the
 * gemini client's `GeminiAttemptMetadata` so the recorder can be passed
 * straight through as a stream option).
 */
export interface EstimatorAttemptUsage {
  attempt: number;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  error: unknown;
}

/**
 * Parsed Call-2 result. Today this is exactly the `GroundedEstimation` shape;
 * kept as a named alias so a future adapter that needs to carry provider
 * metadata alongside the parsed estimation has a seam to extend without
 * churning every call site.
 */
export interface GroundedEstimatorResult {
  estimation: GroundedEstimation;
}

/**
 * The plug-in contract. One `estimate` call = one Call-2 invocation for a
 * (sub)set of meal items. The adapter is responsible for its own timeout via
 * the provided `abortSignal` (the orchestrator wraps the call in the shared
 * `fetchWithTimeout` deadline and forwards the signal here).
 */
export interface GroundedEstimator {
  /** Stable id for telemetry / bakeoff reporting: 'gemini' | 'claude' | 'openai'. */
  readonly id: string;
  /** The concrete model string this adapter calls (for telemetry). */
  readonly model: string;
  estimate(
    input: GroundedEstimatorInput,
    abortSignal: AbortSignal,
    hooks?: GroundedEstimatorStreamHooks
  ): Promise<GroundedEstimatorResult>;
}
