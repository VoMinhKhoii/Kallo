import type { ThinkingLevel } from '@google/genai';
import type { ZodType } from 'zod';
import { logLlmCall } from '@/lib/ai/pipeline/telemetry/trace';
import { measurePromptBudget } from '@/lib/ai/prompts/budget';
import {
  getProviderJsonSchemaMode,
  toProviderJsonSchema,
} from '@/lib/ai/prompts/schema';
import type { AppDb } from '@/lib/db';
import { createEmbeddingMethods } from './gemini-embeddings';
import {
  getOrCreateAiClient,
  type GeminiProviderConfig,
} from './gemini-provider';
import {
  createWithRetry,
  DEFAULT_RETRY,
  type RetryOptions,
} from './gemini-retry';

export {
  resolveGeminiProvider,
  __resetAiClientCacheForTests,
  type GeminiProviderConfig,
} from './gemini-provider';
export { getEmbeddingCacheStats } from './gemini-embeddings';

export function createGeminiClient(
  config: GeminiProviderConfig,
  retryOptions?: Partial<RetryOptions>
): GeminiClient {
  const ai = getOrCreateAiClient(config);
  const retry = { ...DEFAULT_RETRY, ...retryOptions };
  const withRetry = createWithRetry(retry);

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
          if (params.image) {
            const approxBytes = Math.ceil(
              (params.image.base64Data.length * 3) / 4
            );
            const MAX_INLINE_BYTES = 10 * 1024 * 1024;
            if (approxBytes > MAX_INLINE_BYTES) {
              throw new Error(
                `Image payload exceeds inline limit (${(approxBytes / (1024 * 1024)).toFixed(1)}MB > 10MB)`
              );
            }
          }

          const contents = params.image
            ? [
                {
                  inlineData: {
                    mimeType: params.image.mimeType,
                    data: params.image.base64Data,
                  },
                },
                params.userMessage,
              ]
            : params.userMessage;

          const response = await ai.models.generateContent({
            model: params.model,
            contents,
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

          if (params.image) {
            const approxBytes = Math.ceil(
              (params.image.base64Data.length * 3) / 4
            );
            const MAX_INLINE_BYTES = 10 * 1024 * 1024;
            if (approxBytes > MAX_INLINE_BYTES) {
              throw new Error(
                `Image payload exceeds inline limit (${(approxBytes / (1024 * 1024)).toFixed(1)}MB > 10MB)`
              );
            }
          }

          const contents = params.image
            ? [
                {
                  inlineData: {
                    mimeType: params.image.mimeType,
                    data: params.image.base64Data,
                  },
                },
                params.userMessage,
              ]
            : params.userMessage;

          const response = await ai.models.generateContentStream({
            model: params.model,
            contents,
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

    ...createEmbeddingMethods({ ai, withRetry }),
  };
}
