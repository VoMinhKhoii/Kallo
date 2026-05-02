'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createGeminiClient, type GeminiClient } from '@/lib/ai/gemini';
import {
  logPipelineStart,
  setPipelineFinalState,
} from '@/lib/ai/pipeline/logging';
import { analyzeMeal } from '@/lib/ai/pipeline/orchestrator';
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
      _params: unknown,
      opts?: { onChunk?: (text: string) => void }
    ): Promise<T> {
      const value = next<T>();
      // Surface the captured raw text via onChunk so streaming consumers
      // observe a coherent (single-shot) accumulated state.
      opts?.onChunk?.(JSON.stringify(value));
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
  await requireAdmin();
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

  // Reuse original userId — FK to auth.users + correct attribution.
  // Awaited so child trace inserts have a parent row to FK against.
  await logPipelineStart({
    userId: orig.userId,
    rawInput: orig.rawInput,
    userContext: orig.userContextJson as unknown as UserContext,
    db,
    requestId: replayId,
    replayOfRequestId: originalId,
    dryRun,
  });
  console.info(
    `[admin] ${dryRun ? 'dry-run-replayed' : 'replayed'} ${originalId} as ${replayId}`
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
      { requestId: replayId, db, userId: orig.userId, promptVersionsUsed }
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

  redirect(`/admin/requests/${replayId}?compare=${originalId}`);
}
