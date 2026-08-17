'use server';
import { eq } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import {
  logPipelineStart,
  setPipelineFinalState,
} from '@/lib/ai/pipeline/telemetry/logging';
import { hashUserId } from '@/lib/ai/pipeline/telemetry/run-telemetry';
import { logLlmCall } from '@/lib/ai/pipeline/telemetry/trace';
import {
  createGeminiClient,
  type GeminiClient,
  resolveGeminiProvider,
  type StreamOptions,
  type StructuredOutputParams,
} from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import { db } from '@/lib/infra/db';
import {
  analysisGuardEvents,
  pipelineLlmCalls,
  pipelineRequestReplayAuditLogs,
  pipelineRequests,
} from '@/lib/infra/db/schema';
import { adminReplayGuardRoute } from '@/lib/infra/rate-limit/analysis-guard-limits';
import {
  buildAnalysisGuardEvent,
  checkAdminReplayGuard,
} from '@/lib/infra/rate-limit/analysis-guards';

type ReplayRequestResult =
  | {
      ok: false;
      error: {
        code: 'RATE_LIMITED';
        status: 429;
        retryable: true;
        message: string;
        reason: 'admin_replay';
        retryAfterSeconds: number;
      };
    }
  | undefined;

function adminReplayRateLimitResult(
  retryAfterSeconds: number
): ReplayRequestResult {
  return {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
      message:
        'Admin replay quota exhausted. Please wait before replaying again.',
      reason: 'admin_replay',
      retryAfterSeconds,
    },
  };
}

const idSchema = z.string().uuid();
const replayOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
});

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

export async function replayRequest(
  originalIdInput: string,
  options: { dryRun?: boolean } = {}
): Promise<ReplayRequestResult> {
  const originalId = idSchema.parse(originalIdInput);
  const { dryRun = false } = replayOptionsSchema.parse(options);
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

  if (!dryRun) {
    const guard = await checkAdminReplayGuard({ adminId: admin.id, db });

    if (!guard.allowed) {
      try {
        await db.insert(analysisGuardEvents).values(
          buildAnalysisGuardEvent({
            userId: admin.id,
            ip: null,
            route: adminReplayGuardRoute,
            reason: 'admin_replay',
            retryAfterSeconds: guard.retryAfterSeconds,
          })
        );
      } catch (error) {
        console.error('[admin] Failed to log replay guard event:', error);
      }

      return adminReplayRateLimitResult(guard.retryAfterSeconds);
    }
  }

  // Pick the Gemini client BEFORE creating replay rows. For real replays
  // this also validates the AI provider config after the admin replay quota passes.
  let gemini: GeminiClient;
  if (dryRun) {
    gemini = await buildDryRunGeminiClient(originalId);
  } else {
    try {
      gemini = createGeminiClient(resolveGeminiProvider());
    } catch (error) {
      console.error('[admin] AI provider misconfigured:', error);
      throw new Error('AI provider is not configured for replay');
    }
  }

  const replayId = crypto.randomUUID();
  const t0 = Date.now();

  // Reuse original userId — FK to auth.users + correct attribution.
  // Awaited so child trace inserts have a parent row to FK against.
  // The audit-log insert below references replayId via FK, so we have to
  // create the pipeline_requests row FIRST: writing the audit row before
  // logPipelineStart leaves an orphaned audit entry whenever pipeline-start
  // throws (no FK target).
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

  await db.insert(pipelineRequestReplayAuditLogs).values({
    adminUserIdHash: hashUserId(admin.id),
    originalRequestId: originalId,
    replayRequestId: replayId,
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

  const locale = await getLocale();
  redirect({
    href: `/admin/requests/${replayId}?compare=${originalId}`,
    locale,
  });
}
