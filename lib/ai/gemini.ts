import { GoogleGenAI, type ThinkingLevel } from '@google/genai';
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
  createWithRetry,
  DEFAULT_RETRY,
  type RetryOptions,
} from './gemini-retry';

export { getEmbeddingCacheStats } from './gemini-embeddings';

export interface StructuredOutputParams<T> {
  schema: ZodType<T>;
  systemPrompt: string;
  userMessage: string;
  image?: { mimeType: string; base64Data: string };
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
