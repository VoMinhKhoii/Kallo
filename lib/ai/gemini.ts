import { GoogleGenAI, type ThinkingLevel } from '@google/genai';
import type { ZodType } from 'zod';
import { logLlmCall } from '@/lib/ai/pipeline/telemetry/trace';
import { measurePromptBudget } from '@/lib/ai/prompts/budget';
import {
  getProviderJsonSchemaMode,
  toProviderJsonSchema,
} from '@/lib/ai/prompts/schema';
import type { AppDb } from '@/lib/db';

const EMBEDDING_MODEL = 'gemini-embedding-001';
const EMBEDDING_DIMENSIONS = 768;

/**
 * Module-level embedding cache keyed by ingredient name.
 * The same Vietnamese ingredient names recur across all users — cached vectors
 * eliminate redundant API calls that would otherwise exhaust rate limits.
 */
const embeddingCache = new Map<string, number[]>();

/** Visible for testing/diagnostics */
export function getEmbeddingCacheStats() {
  return { size: embeddingCache.size };
}

interface RetryOptions {
  maxRetries: number;
  baseDelayMs: number;
}

const DEFAULT_RETRY: RetryOptions = {
  maxRetries: 3,
  baseDelayMs: 1000,
};

export interface StructuredOutputParams<T> {
  schema: ZodType<T>;
  systemPrompt: string;
  userMessage: string;
  model: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  thinkingConfig?: { thinkingLevel?: ThinkingLevel };
  abortSignal?: AbortSignal;
}

export interface GeminiCallTrace {
  db: AppDb;
  requestId: string;
  stageLogId: string;
  /**
   * The prompt-version id (uuid). Accepts a Promise so callers can fire
   * the recordPromptVersion insert in parallel with the Gemini call;
   * logLlmCall awaits it before the FK-bearing insert.
   */
  promptVersionId: string | Promise<string | null>;
  promptRendered: string;
}

export interface GeminiAttemptMetadata {
  attempt: number;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  error: unknown;
}

export interface StreamOptions {
  onAttemptStart?: (attempt: number) => void;
  onAttemptComplete?: (metadata: GeminiAttemptMetadata) => void;
  onChunk?: (accumulated: string) => void;
  trace?: GeminiCallTrace;
}

export interface GeminiClient {
  generateStructuredOutput<T>(params: StructuredOutputParams<T>): Promise<T>;
  generateStructuredOutputStream<T>(
    params: StructuredOutputParams<T>,
    opts?: StreamOptions
  ): Promise<T>;
  generateEmbedding(text: string): Promise<number[]>;
  generateEmbeddingBatch(texts: string[]): Promise<number[][]>;
}

export type GeminiProviderConfig =
  | { provider: 'ai-studio'; apiKey: string }
  | { provider: 'vertex'; project: string; location: string };

/**
 * Resolve the Gemini provider config from environment variables.
 *
 * - AI_PROVIDER unset or "ai-studio": uses GEMINI_API_KEY (Google AI Studio).
 * - AI_PROVIDER="vertex": uses GOOGLE_CLOUD_PROJECT + GOOGLE_CLOUD_LOCATION via
 *   Application Default Credentials. On Cloud Run, ADC comes from the service
 *   account; locally it comes from `gcloud auth application-default login`.
 *
 * Throws with a clear message if the required variables for the chosen
 * provider are missing or if AI_PROVIDER has an unknown value.
 */
export function resolveGeminiProvider(
  env: Record<string, string | undefined> = process.env
): GeminiProviderConfig {
  const raw = env.AI_PROVIDER?.trim();
  const provider = raw && raw.length > 0 ? raw : 'ai-studio';

  if (provider === 'vertex') {
    const project = env.GOOGLE_CLOUD_PROJECT?.trim();
    const location = env.GOOGLE_CLOUD_LOCATION?.trim();
    if (!project || !location) {
      throw new Error(
        'AI_PROVIDER=vertex requires GOOGLE_CLOUD_PROJECT and GOOGLE_CLOUD_LOCATION'
      );
    }
    return { provider: 'vertex', project, location };
  }

  if (provider === 'ai-studio') {
    const apiKey = env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      throw new Error('AI_PROVIDER=ai-studio requires GEMINI_API_KEY');
    }
    return { provider: 'ai-studio', apiKey };
  }

  throw new Error(
    `Unknown AI_PROVIDER="${provider}"; expected "ai-studio" or "vertex"`
  );
}

function getErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }

  if (!(error instanceof Error)) {
    return null;
  }

  const statusMatch = error.message.match(/\b(408|429|500|502|503|504)\b/);
  if (statusMatch) {
    return Number.parseInt(statusMatch[1], 10);
  }

  if (error.message.includes('UNAVAILABLE')) {
    return 503;
  }

  return null;
}

function isRetryableGeminiError(error: unknown): boolean {
  if (error instanceof Error && error.name === 'AbortError') {
    return false;
  }

  const status = getErrorStatus(error);
  if (status != null) {
    return new Set([408, 429, 500, 502, 503, 504]).has(status);
  }

  if (!(error instanceof Error)) {
    return false;
  }

  return /fetch failed|network error|socket hang up|ECONNRESET|ETIMEDOUT|EAI_AGAIN/i.test(
    error.message
  );
}

/**
 * Compute the retry backoff for the next attempt.
 *
 * Priority order:
 *   1. Honor `retry in Xs` hints in the error message (Gemini 429 quota).
 *   2. **5xx fast recovery (Phase C6)**: if the previous attempt aborted in
 *      under `FAST_RECOVERY_THRESHOLD_MS` with a 5xx/UNAVAILABLE, drop to a
 *      250 ms floor instead of the 1000 ms exponential start. Only applies to
 *      the first retry (attempt=2); subsequent retries use full exponential.
 *      This shaves ~750 ms off transient provider-pressure recovery.
 *   3. Standard exponential: baseDelayMs * 2^(attempt-1).
 */
const FAST_RECOVERY_THRESHOLD_MS = 5000;
const FAST_RECOVERY_DELAY_MS = 250;
function parseRetryDelay(
  error: Error,
  baseDelayMs: number,
  attempt: number,
  status: number | null,
  attemptElapsedMs: number
): number {
  const match = error.message.match(/retry in ([\d.]+)s/i);
  if (match) {
    return Number.parseFloat(match[1]) * 1000;
  }
  const isFastRecoverableStatus =
    status === 500 || status === 502 || status === 503 || status === 504;
  if (
    attempt === 1 &&
    isFastRecoverableStatus &&
    attemptElapsedMs < FAST_RECOVERY_THRESHOLD_MS
  ) {
    return FAST_RECOVERY_DELAY_MS;
  }
  return baseDelayMs * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Module-level cache of GoogleGenAI clients keyed by provider identity.
 *
 * Why: on the Vertex path the SDK constructs a GoogleAuth instance whose
 * cachedCredential lives only for the lifetime of that GoogleGenAI. A fresh
 * client per request means a fresh metadata-server token fetch per request
 * (~10-40 ms warm, ~50-150 ms cold) on the critical path of every meal
 * analysis. Reusing a single client per {provider,project,location|apiKey}
 * lets the SDK amortize OAuth token refresh across requests (~1 fetch/hour).
 *
 * Cache-miss logs double as a startup signal for which provider resolved —
 * silent fallback to ai-studio (e.g. an empty AI_PROVIDER env var on a
 * Vertex-bound Cloud Run service) is visible in Cloud Logging on first use.
 */
const aiClientCache = new Map<string, GoogleGenAI>();

function cacheKeyFor(config: GeminiProviderConfig): string {
  return config.provider === 'vertex'
    ? `vertex|${config.project}|${config.location}`
    : `ai-studio|${config.apiKey}`;
}

function getOrCreateAiClient(config: GeminiProviderConfig): GoogleGenAI {
  const key = cacheKeyFor(config);
  let ai = aiClientCache.get(key);
  if (!ai) {
    ai =
      config.provider === 'vertex'
        ? new GoogleGenAI({
            vertexai: true,
            project: config.project,
            location: config.location,
          })
        : new GoogleGenAI({ apiKey: config.apiKey });
    aiClientCache.set(key, ai);
    const summary =
      config.provider === 'vertex'
        ? `vertex project=${config.project} location=${config.location}`
        : 'ai-studio';
    console.info(`[gemini] provider resolved: ${summary}`);
  }
  return ai;
}

/** Visible for testing: reset the module-level client cache. */
export function __resetAiClientCacheForTests() {
  aiClientCache.clear();
}

export function createGeminiClient(
  config: GeminiProviderConfig,
  retryOptions?: Partial<RetryOptions>
): GeminiClient {
  const ai = getOrCreateAiClient(config);
  const retry = { ...DEFAULT_RETRY, ...retryOptions };

  async function withRetry<T>(
    fn: (attempt: number) => Promise<T>,
    opts?: {
      label?: string;
      onAttempt?: (
        attempt: number,
        t0: number,
        result: T | null,
        err: unknown
      ) => void;
    }
  ): Promise<T> {
    const label = opts?.label;
    let lastError: Error | undefined;

    for (let attempt = 1; attempt <= retry.maxRetries; attempt++) {
      const t0 = Date.now();
      try {
        const result = await fn(attempt);
        console.info(
          `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries}: ${Date.now() - t0}ms`
        );
        opts?.onAttempt?.(attempt, t0, result, null);
        return result;
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const elapsed = Date.now() - t0;
        const status = getErrorStatus(lastError);
        opts?.onAttempt?.(attempt, t0, null, err);

        if (
          !isRetryableGeminiError(lastError) ||
          attempt === retry.maxRetries
        ) {
          console.error(
            `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries} failed (${elapsed}ms): ${lastError.message}`
          );
          throw lastError;
        }

        const delay = parseRetryDelay(
          lastError,
          retry.baseDelayMs,
          attempt,
          status,
          elapsed
        );
        console.warn(
          `[gemini] ${label ?? 'call'} attempt ${attempt}/${retry.maxRetries} got retryable ${status ?? 'error'} (${elapsed}ms), retrying in ${delay}ms`
        );
        await sleep(delay);
      }
    }

    throw lastError;
  }

  return {
    async generateStructuredOutput<T>(
      params: StructuredOutputParams<T>
    ): Promise<T> {
      const jsonSchema = toProviderJsonSchema(params.schema, {
        mode: getProviderJsonSchemaMode(),
      });
      const promptBudget = measurePromptBudget({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        schema: jsonSchema,
      });
      console.info(
        `[gemini] ${params.model} structured output: prompt=${promptBudget.systemChars + promptBudget.userChars} chars (~${promptBudget.approxTokens} tokens incl schema), schema=${promptBudget.schemaChars} chars`
      );

      return withRetry(
        async (attempt) => {
          const callStart = Date.now();
          const response = await ai.models.generateContent({
            model: params.model,
            contents: params.userMessage,
            config: {
              systemInstruction: params.systemPrompt,
              responseMimeType: 'application/json',
              responseJsonSchema: jsonSchema,
              ...(params.temperature != null && {
                temperature: params.temperature,
              }),
              ...(params.topP != null && { topP: params.topP }),
              ...(params.topK != null && { topK: params.topK }),
              ...(params.thinkingConfig != null && {
                thinkingConfig: params.thinkingConfig,
              }),
              ...(params.abortSignal != null && {
                abortSignal: params.abortSignal,
              }),
            },
          });

          // Non-streaming has no TTFT split — total is the whole call.
          console.info(
            `[gemini] ${params.model} attempt ${attempt}/${retry.maxRetries}: total=${Date.now() - callStart}ms`
          );

          const text = response.text;
          if (!text) throw new Error('Gemini returned empty response');

          return params.schema.parse(JSON.parse(text));
        },
        { label: params.model }
      );
    },

    async generateStructuredOutputStream<T>(
      params: StructuredOutputParams<T>,
      opts?: StreamOptions
    ): Promise<T> {
      const { onAttemptComplete, onAttemptStart, onChunk, trace } = opts ?? {};
      const jsonSchema = toProviderJsonSchema(params.schema, {
        mode: getProviderJsonSchemaMode(),
      });
      const promptBudget = measurePromptBudget({
        systemPrompt: params.systemPrompt,
        userMessage: params.userMessage,
        schema: jsonSchema,
      });
      console.info(
        `[gemini] ${params.model} streaming output: prompt=${promptBudget.systemChars + promptBudget.userChars} chars (~${promptBudget.approxTokens} tokens incl schema), schema=${promptBudget.schemaChars} chars`
      );

      // Mutable closure: updated as each chunk is streamed; reset per attempt.
      let lastAccumulated: string | null = null;
      let lastUsageMeta: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
        cachedContentTokenCount?: number;
      } | null = null;

      const onAttempt = (
        attempt: number,
        t0: number,
        _result: T | null,
        err: unknown
      ) => {
        const inputTokens = lastUsageMeta?.promptTokenCount ?? null;
        const outputTokens = lastUsageMeta?.candidatesTokenCount ?? null;
        const cachedTokens = lastUsageMeta?.cachedContentTokenCount ?? null;

        // Visibility: when Gemini's implicit cache hits (model 2.5+ caches
        // prompts ≥ 1024 tokens automatically), the response carries
        // cachedContentTokenCount > 0. Without this log we have no signal
        // that caching is even working.
        if (cachedTokens != null && cachedTokens > 0) {
          console.info(
            `[gemini] ${params.model}-stream attempt ${attempt}/${retry.maxRetries}: implicit cache hit (cached=${cachedTokens}/${inputTokens ?? '?'} prompt tokens)`
          );
        }

        if (trace) {
          logLlmCall({
            db: trace.db,
            requestId: trace.requestId,
            stageLogId: trace.stageLogId,
            promptVersionId: trace.promptVersionId,
            model: params.model,
            promptRendered: trace.promptRendered,
            responseRaw: lastAccumulated,
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
          model: params.model,
          inputTokens,
          outputTokens,
          error: err,
        });
      };

      return withRetry(
        async (attempt) => {
          onAttemptStart?.(attempt);
          // Reset per-attempt state.
          lastAccumulated = null;
          lastUsageMeta = null;

          const streamStart = Date.now();
          let firstChunkAt: number | null = null;

          const response = await ai.models.generateContentStream({
            model: params.model,
            contents: params.userMessage,
            config: {
              systemInstruction: params.systemPrompt,
              responseMimeType: 'application/json',
              responseJsonSchema: jsonSchema,
              ...(params.temperature != null && {
                temperature: params.temperature,
              }),
              ...(params.topP != null && { topP: params.topP }),
              ...(params.topK != null && { topK: params.topK }),
              ...(params.abortSignal != null && {
                abortSignal: params.abortSignal,
              }),
            },
          });

          let accumulated = '';
          for await (const chunk of response) {
            if (firstChunkAt == null) {
              firstChunkAt = Date.now();
            }
            const text = chunk.text ?? '';
            accumulated += text;
            lastAccumulated = accumulated; // preserve partial text on failure
            if (chunk.usageMetadata) {
              lastUsageMeta = chunk.usageMetadata as {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
                cachedContentTokenCount?: number;
              };
            }
            if (onChunk && text.length > 0) {
              onChunk(accumulated);
            }
          }

          // Emit one combined ttft/total line per attempt — easier to grep
          // than two separate ttft/total lines and avoids implying the stream
          // can finish without ever having produced a chunk.
          const total = Date.now() - streamStart;
          const ttft = firstChunkAt != null ? firstChunkAt - streamStart : null;
          console.info(
            `[gemini] ${params.model}-stream attempt ${attempt}/${retry.maxRetries}: ttft=${ttft ?? 'n/a'}ms total=${total}ms`
          );

          if (!accumulated)
            throw new Error('Gemini stream returned empty response');
          return params.schema.parse(JSON.parse(accumulated));
        },
        { label: `${params.model}-stream`, onAttempt }
      );
    },

    async generateEmbedding(text: string): Promise<number[]> {
      const cached = embeddingCache.get(text);
      if (cached) {
        console.info(`[gemini] embedding cache hit: "${text.slice(0, 30)}"`);
        return cached;
      }

      const embedding = await withRetry(
        async (_attempt) => {
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: [{ parts: [{ text }] }],
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
          });

          const emb = result.embeddings?.[0]?.values;
          if (!emb) throw new Error('Gemini returned no embedding');

          return emb;
        },
        { label: `embed("${text.slice(0, 30)}")` }
      );

      embeddingCache.set(text, embedding);
      console.info(
        `[gemini] embedding cache miss: "${text.slice(0, 30)}" (cache size: ${embeddingCache.size})`
      );
      return embedding;
    },

    async generateEmbeddingBatch(texts: string[]): Promise<number[][]> {
      if (texts.length === 0) return [];

      // Partition into cached vs uncached
      const results: (number[] | null)[] = texts.map(
        (t) => embeddingCache.get(t) ?? null
      );
      const uncachedIndices = results
        .map((r, i) => (r === null ? i : -1))
        .filter((i) => i >= 0);

      if (uncachedIndices.length === 0) {
        console.info(`[gemini] batch embed: all ${texts.length} cached`);
        return results as number[][];
      }

      const uncachedTexts = uncachedIndices.map((i) => texts[i]);
      console.info(
        `[gemini] batch embed: ${uncachedTexts.length} uncached / ${texts.length} total`
      );

      const embeddings = await withRetry(
        async (_attempt) => {
          const result = await ai.models.embedContent({
            model: EMBEDDING_MODEL,
            contents: uncachedTexts,
            config: { outputDimensionality: EMBEDDING_DIMENSIONS },
          });

          if (
            !result.embeddings ||
            result.embeddings.length !== uncachedTexts.length
          ) {
            throw new Error(
              `Gemini batch returned ${result.embeddings?.length ?? 0} embeddings for ${uncachedTexts.length} texts`
            );
          }

          return result.embeddings.map((e) => {
            if (!e.values) throw new Error('Gemini returned null embedding');
            return e.values;
          });
        },
        { label: `batch-embed(${uncachedTexts.length})` }
      );

      // Populate cache and fill results
      for (let j = 0; j < uncachedIndices.length; j++) {
        const idx = uncachedIndices[j];
        results[idx] = embeddings[j];
        embeddingCache.set(texts[idx], embeddings[j]);
      }

      return results as number[][];
    },
  };
}
