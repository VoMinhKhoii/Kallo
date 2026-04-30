'use server';
import { eq } from 'drizzle-orm';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { requireAdmin } from '@/lib/admin/require-admin';
import { createGeminiClient } from '@/lib/ai/gemini';
import {
  logPipelineStart,
  setPipelineFinalState,
} from '@/lib/ai/pipeline/logging';
import { analyzeMeal } from '@/lib/ai/pipeline/orchestrator';
import type { UserContext } from '@/lib/ai/types';
import { db } from '@/lib/db';
import { pipelineRequests } from '@/lib/db/schema';

const idSchema = z.string().uuid();

export async function replayRequest(originalIdInput: string) {
  const originalId = idSchema.parse(originalIdInput);
  const admin = await requireAdmin();

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

  // Validate API key BEFORE creating any DB rows or doing further work
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY missing');
  const gemini = createGeminiClient(apiKey);

  const replayId = crypto.randomUUID();
  const t0 = Date.now();

  // Reuse original userId (NOT admin.id) — FK to auth.users + correct attribution.
  // Awaited so child trace inserts have a parent row to FK against.
  await logPipelineStart({
    userId: orig.userId,
    rawInput: orig.rawInput,
    userContext: orig.userContextJson as unknown as UserContext,
    db,
    requestId: replayId,
    replayOfRequestId: originalId,
  });
  console.info(`[admin] ${admin.email} replayed ${originalId} as ${replayId}`);

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

  redirect(`/admin/requests/${replayId}?compare=${originalId}`);
}
