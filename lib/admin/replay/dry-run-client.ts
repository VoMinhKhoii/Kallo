import { eq } from 'drizzle-orm';
import { logLlmCall } from '@/lib/ai/pipeline/telemetry/trace';
import type {
  GeminiClient,
  StreamOptions,
  StructuredOutputParams,
} from '@/lib/ai/provider/provider';
import { db } from '@/lib/infra/db/client';
import { pipelineLlmCalls } from '@/lib/infra/db/schema';

/**
 * Builds a mock GeminiClient that replays previously captured llm_call
 * responses for `originalId`, in the order they were emitted (by createdAt).
 * Used for dry-run replays so admins can re-exercise downstream stages
 * (parsing, matching, assembly) without spending tokens.
 *
 * Embedding methods throw — dry-run is for the LLM-call surface only.
 */
export async function buildDryRunGeminiClient(
  originalId: string
): Promise<GeminiClient> {
  const captured = await db
    .select({ responseRaw: pipelineLlmCalls.responseRaw })
    .from(pipelineLlmCalls)
    .where(eq(pipelineLlmCalls.requestId, originalId))
    .orderBy(pipelineLlmCalls.createdAt);

  const responses = captured
    .map((r) => r.responseRaw)
    .filter((r): r is string => typeof r === 'string' && r.length > 0);

  if (responses.length === 0) {
    throw new Error(
      'dry-run replay requires captured LLM responses on the original request'
    );
  }

  let cursor = 0;
  const next = <T>(): T => {
    if (cursor >= responses.length) {
      throw new Error('dry-run replay ran out of captured responses');
    }
    const raw = responses[cursor++];
    return JSON.parse(raw) as T;
  };

  return {
    async generateStructuredOutput<T>(): Promise<T> {
      return next<T>();
    },
    async generateStructuredOutputStream<T>(
      params: StructuredOutputParams<T>,
      opts?: StreamOptions
    ): Promise<T> {
      const t0 = Date.now();
      const value = next<T>();
      const responseRaw = JSON.stringify(value);
      opts?.onAttemptStart?.(1);
      opts?.onChunk?.(responseRaw);
      if (opts?.trace) {
        const { trace } = opts;
        logLlmCall({
          db: trace.db,
          requestId: trace.requestId,
          stageLogId: trace.stageLogId,
          promptVersionId: trace.promptVersionId,
          model: params.model,
          promptRendered: trace.promptRendered,
          responseRaw,
          inputTokens: null,
          outputTokens: null,
          latencyMs: Date.now() - t0,
          attempt: 1,
        });
      }
      return value;
    },
    async generateEmbedding(): Promise<number[]> {
      throw new Error('embeddings are not mocked in dry-run replay');
    },
    async generateEmbeddingBatch(): Promise<number[][]> {
      throw new Error('embeddings are not mocked in dry-run replay');
    },
  };
}
