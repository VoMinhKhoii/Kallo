import { getClaudeStructuredOutput, withClaudeRouting } from './claude/routing';
import { type GeminiProviderConfig, getOrCreateAiClient } from './client';
import { createEmbeddingMethods } from './embeddings';
import { createWithRetry, DEFAULT_RETRY, type RetryOptions } from './retry';
import { createStructuredOutputStream } from './streaming';
import { createStructuredOutput } from './structured-output';
import type { GeminiClient } from './types';

/**
 * The public entry of `lib/ai/provider` — the only folder allowed to touch an
 * LLM SDK. Everything else in the repo talks to the model through the
 * `GeminiClient` interface returned here.
 */

export { getEmbeddingCacheStats } from '@/lib/ai/cache/provider-embedding-memo';
export {
  __resetAiClientCacheForTests,
  type GeminiProviderConfig,
  resolveGeminiProvider,
} from './client';
export type {
  AttemptTokens,
  GeminiAttemptMetadata,
  GeminiCallTrace,
  GeminiClient,
  StreamOptions,
  StructuredOutputParams,
} from './types';

/**
 * The meal pipeline's client: Claude models (`claude-*`, the `haiku` model
 * profile) run on the Claude API with a per-call Gemini fallback on
 * `fallbackModel`; everything else, embeddings included, runs on Gemini.
 */
export function createPipelineLlm(
  config: GeminiProviderConfig,
  options: { fallbackModel: string }
): GeminiClient {
  return withClaudeRouting(
    createGeminiClient(config),
    getClaudeStructuredOutput(),
    options
  );
}

export function createGeminiClient(
  config: GeminiProviderConfig,
  retryOptions?: Partial<RetryOptions>
): GeminiClient {
  const ai = getOrCreateAiClient(config);
  const retry = { ...DEFAULT_RETRY, ...retryOptions };
  const withRetry = createWithRetry(retry);

  return {
    generateStructuredOutput: createStructuredOutput({ ai, retry, withRetry }),
    generateStructuredOutputStream: createStructuredOutputStream({
      ai,
      retry,
      withRetry,
    }),
    ...createEmbeddingMethods({ ai, withRetry }),
  };
}
