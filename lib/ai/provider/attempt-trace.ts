import { logLlmCall } from '@/lib/ai/pipeline/telemetry/trace';
import type { PromptBudget } from '@/lib/ai/prompts/budget';
import type { GeminiCallTrace, StreamOptions } from './types';

/** The usage counters Gemini attaches to streamed chunks. */
export interface StreamUsageMetadata {
  promptTokenCount?: number;
  candidatesTokenCount?: number;
  cachedContentTokenCount?: number;
}

/**
 * Per-attempt scratch the stream writes and the observer reads.
 *
 * Mutable on purpose: the observer fires *after* the attempt has thrown, so
 * partial text and the last usage counters have to survive the throw. The
 * stream resets both fields at the top of every attempt.
 */
export interface StreamAttemptState {
  accumulated: string | null;
  usage: StreamUsageMetadata | null;
}

export function createAttemptState(): StreamAttemptState {
  return { accumulated: null, usage: null };
}

/**
 * Build the per-attempt observer for a streaming call: writes the
 * `pipeline_llm_calls` trace row (when tracing is on) and forwards token
 * counts to the caller (always).
 */
export function createAttemptObserver({
  model,
  maxRetries,
  promptBudget,
  state,
  trace,
  onAttemptComplete,
}: {
  model: string;
  maxRetries: number;
  promptBudget: PromptBudget;
  state: StreamAttemptState;
  trace?: GeminiCallTrace;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}) {
  return (attempt: number, t0: number, _result: unknown, err: unknown) => {
    const inputTokens = state.usage?.promptTokenCount ?? null;
    const outputTokens = state.usage?.candidatesTokenCount ?? null;
    const cachedTokens = state.usage?.cachedContentTokenCount ?? null;

    // Visibility: when Gemini's implicit cache hits (model 2.5+ caches
    // prompts ≥ 1024 tokens automatically), the response carries
    // cachedContentTokenCount > 0. Without this log we have no signal
    // that caching is even working.
    if (cachedTokens != null && cachedTokens > 0) {
      console.info(
        `[gemini] ${model}-stream attempt ${attempt}/${maxRetries}: implicit cache hit (cached=${cachedTokens}/${inputTokens ?? '?'} prompt tokens)`
      );
    }

    if (trace) {
      logLlmCall({
        db: trace.db,
        requestId: trace.requestId,
        stageLogId: trace.stageLogId,
        promptVersionId: trace.promptVersionId,
        model,
        promptRendered: trace.promptRendered,
        responseRaw: state.accumulated,
        inputTokens,
        outputTokens,
        latencyMs: Date.now() - t0,
        attempt,
        error:
          err instanceof Error
            ? err.message
            : err != null
              ? String(err)
              : undefined,
        metadata: {
          promptChars: promptBudget.systemChars + promptBudget.userChars,
          schemaChars: promptBudget.schemaChars,
          ...(cachedTokens != null && cachedTokens > 0
            ? { cachedTokens, cacheStatus: 'implicit_hit' }
            : {}),
        },
      });
    }

    onAttemptComplete?.({
      attempt,
      model,
      inputTokens,
      outputTokens,
      error: err,
    });
  };
}
