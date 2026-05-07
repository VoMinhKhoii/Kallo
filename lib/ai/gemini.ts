import { GoogleGenAI, type ThinkingLevel } from '@google/genai';
import { toJSONSchema, type ZodType } from 'zod';
import { logLlmCall } from '@/lib/ai/pipeline/trace';
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

function parseRetryDelay(
  error: Error,
  baseDelayMs: number,
  attempt: number
): number {
  const match = error.message.match(/retry in ([\d.]+)s/i);
  return match
    ? Number.parseFloat(match[1]) * 1000
    : baseDelayMs * 2 ** (attempt - 1);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function createGeminiClient(
  apiKey: string,
  retryOptions?: Partial<RetryOptions>
): GeminiClient {
  const ai = new GoogleGenAI({ apiKey });
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

        const delay = parseRetryDelay(lastError, retry.baseDelayMs, attempt);
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
      const jsonSchema = toJSONSchema(params.schema);
      const schemaSize = JSON.stringify(jsonSchema).length;
      const promptSize = params.systemPrompt.length + params.userMessage.length;
      console.info(
        `[gemini] ${params.model} structured output: prompt=${promptSize} chars (~${Math.round(promptSize / 4)} tokens), schema=${schemaSize} chars`
      );

      return withRetry(
        async (_attempt) => {
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
      const jsonSchema = toJSONSchema(params.schema);
      const promptSize = params.systemPrompt.length + params.userMessage.length;
      console.info(
        `[gemini] ${params.model} streaming output: prompt=${promptSize} chars (~${Math.round(promptSize / 4)} tokens)`
      );

      // Mutable closure: updated as each chunk is streamed; reset per attempt.
      let lastAccumulated: string | null = null;
      let lastUsageMeta: {
        promptTokenCount?: number;
        candidatesTokenCount?: number;
      } | null = null;

      const onAttempt = (
        attempt: number,
        t0: number,
        _result: T | null,
        err: unknown
      ) => {
        const inputTokens = lastUsageMeta?.promptTokenCount ?? null;
        const outputTokens = lastUsageMeta?.candidatesTokenCount ?? null;

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
            const text = chunk.text ?? '';
            accumulated += text;
            lastAccumulated = accumulated; // preserve partial text on failure
            if (chunk.usageMetadata) {
              lastUsageMeta = chunk.usageMetadata as {
                promptTokenCount?: number;
                candidatesTokenCount?: number;
              };
            }
            if (onChunk && text.length > 0) {
              onChunk(accumulated);
            }
          }

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
