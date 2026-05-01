'use server';
import { eq } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/require-admin';
import {
  createGeminiClient,
  type GeminiClient,
  type StreamOptions,
  type StructuredOutputParams,
} from '@/lib/ai/gemini';
import {
  logPipelineStart,
  setPipelineFinalState,
} from '@/lib/ai/pipeline/logging';
import { analyzeMeal } from '@/lib/ai/pipeline/orchestrator';
import { logLlmCall } from '@/lib/ai/pipeline/trace';
import type { UserContext } from '@/lib/ai/types';
import { db } from '@/lib/db';
import { pipelineLlmCalls, pipelineRequests } from '@/lib/db/schema';

const idSchema = z.string().uuid();

/**
 * Builds a mock GeminiClient that replays previously captured llm_call
 * responses for `originalId`, in the order they were emitted (by createdAt).
 * Used for dry-run replays so admins can re-exercise downstream stages
 * (parsing, matching, assembly) without spending tokens.
 *
 * Embedding methods throw — dry-run is for the LLM-call surface only.
 */
async function buildDryRunGeminiClient(
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

export async function replayRequest(
  originalIdInput: string,
  options: { dryRun?: boolean } = {}
) {
  const originalId = idSchema.parse(originalIdInput);
  const admin = await requireAdmin();
  const dryRun = options.dryRun === true;

  const [orig] = await db
    .select({
      rawInput: pipelineRequests.rawInput,
      userContextJson: pipelineRequests.userContextJson,
      userId: pipelineRequests.userId,
    })
    .from(pipelineRequests)
    .where(eq(pipelineRequests.id, originalId))
    .limit(1);
  if (!orig) throw new Error('original request not found');

  // Pick the Gemini client BEFORE creating any DB rows. For real replays
  // this also validates GEMINI_API_KEY up-front.
  const gemini: GeminiClient = dryRun
    ? await buildDryRunGeminiClient(originalId)
    : (() => {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) throw new Error('GEMINI_API_KEY missing');
        return createGeminiClient(apiKey);
      })();

  const replayId = crypto.randomUUID();
  const t0 = Date.now();

  // Reuse original userId (NOT admin.id) — FK to auth.users + correct attribution.
  // Awaited so child trace inserts have a parent row to FK against.
  const startResult = await logPipelineStart({
    userId: orig.userId,
    rawInput: orig.rawInput,
    userContext: orig.userContextJson as unknown as UserContext,
    db,
    requestId: replayId,
    replayOfRequestId: originalId,
    dryRun,
  });
  if (startResult === null) {
    throw new Error('[admin] Failed to create pipeline request log for replay');
  }
  console.info(
    `[admin] ${admin.email} ${dryRun ? 'dry-run-replayed' : 'replayed'} ${originalId} as ${replayId}`
  );

  const promptVersionsUsed = new Map<string, string>();
  let finalStatus: 'success' | 'error' = 'success';
  let errorMessage: string | undefined;
  try {
    const result = await analyzeMeal(
      orig.rawInput,
      orig.userContextJson as unknown as UserContext,
      db,
      gemini,
      () => {},
      { requestId: replayId, db, promptVersionsUsed }
    );
    if (!result.success) {
      finalStatus = 'error';
      errorMessage = result.error.message;
    }
  } catch (e) {
    finalStatus = 'error';
    errorMessage = e instanceof Error ? e.message : String(e);
  }

  // AWAITED so the redirect lands on a row in its terminal state,
  // not 'pending'. Production route stays fire-and-forget via logPipelineEnd.
  await setPipelineFinalState({
    db,
    requestId: replayId,
    status: finalStatus,
    durationMs: Date.now() - t0,
    errorMessage,
    promptVersionsUsed:
      promptVersionsUsed.size > 0
        ? Object.fromEntries(promptVersionsUsed)
        : null,
  });

  const locale = await getLocale();
  redirect({
    href: `/admin/requests/${replayId}?compare=${originalId}`,
    locale,
  });
}
