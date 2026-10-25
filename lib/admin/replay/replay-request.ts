'use server';
import { eq } from 'drizzle-orm';
import { getLocale } from 'next-intl/server';
import { z } from 'zod';
import { redirect } from '@/i18n/navigation';
import { requireAdmin } from '@/lib/admin/authz/require-admin';
import { buildDryRunGeminiClient } from '@/lib/admin/replay/dry-run-client';
import { createAiSpend } from '@/lib/ai/cost/ai-spend';
import { analyzeMeal } from '@/lib/ai/pipeline/analyze-meal';
import { CLAUDE_FALLBACK_MODEL } from '@/lib/ai/pipeline/config/model-profile';
import {
  logPipelineStart,
  setPipelineFinalState,
} from '@/lib/ai/pipeline/telemetry/logging';
import { hashUserId } from '@/lib/ai/pipeline/telemetry/run-telemetry';
import {
  createPipelineLlm,
  type GeminiClient,
  resolveGeminiProvider,
} from '@/lib/ai/provider/provider';
import type { UserContext } from '@/lib/ai/types/user-context';
import { RateLimitedError } from '@/lib/core/errors/app-error';
import { hasAiConsent } from '@/lib/domain/privacy/ai-consent';
import { db } from '@/lib/infra/db/client';
import {
  analysisGuardEvents,
  pipelineRequestReplayAuditLogs,
  pipelineRequests,
  userProfiles,
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
        reason: 'admin_replay' | 'ai_paused';
        retryAfterSeconds: number;
      };
    }
  | undefined;

function adminReplayRateLimitResult(
  retryAfterSeconds: number,
  reason: 'admin_replay' | 'ai_paused' = 'admin_replay'
): ReplayRequestResult {
  return {
    ok: false,
    error: {
      code: 'RATE_LIMITED',
      status: 429,
      retryable: true,
      message:
        reason === 'ai_paused'
          ? 'The app-wide AI spend brake has tripped; live replays resume at the next UTC day.'
          : 'Admin replay quota exhausted. Please wait before replaying again.',
      reason,
      retryAfterSeconds,
    },
  };
}

const idSchema = z.string().uuid();
const replayOptionsSchema = z.object({
  dryRun: z.boolean().optional(),
});

export async function replayRequest(
  originalIdInput: string,
  options: { dryRun?: boolean } = {}
): Promise<ReplayRequestResult> {
  const originalId = idSchema.parse(originalIdInput);
  const { dryRun: requestedDryRun = false } =
    replayOptionsSchema.parse(options);
  const admin = await requireAdmin();

  const [orig] = await db
    .select({
      rawInput: pipelineRequests.rawInput,
      userContextJson: pipelineRequests.userContextJson,
      userId: pipelineRequests.userId,
      // The ORIGINAL user's consent as it stands now — null too when the
      // profile is gone, which fails closed like a withdrawal.
      aiProcessingConsentedAt: userProfiles.aiProcessingConsentedAt,
    })
    .from(pipelineRequests)
    .leftJoin(userProfiles, eq(userProfiles.userId, pipelineRequests.userId))
    .where(eq(pipelineRequests.id, originalId))
    .limit(1);
  if (!orig) throw new Error('original request not found');

  // A live replay sends that user's meal text to the AI provider again, which
  // only their consent covers (App Store 5.1.2(i)) — the admin's does not.
  // Without it the replay runs dry: the captured responses are re-read and
  // nothing leaves the server.
  const dryRun = requestedDryRun || !hasAiConsent(orig);
  if (dryRun && !requestedDryRun) {
    console.info(
      `[admin] ${originalId}: no AI-processing consent on record, replaying dry`
    );
  }

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

  // A live replay calls the models again, so it spends under the app-wide AI
  // brake like any meal; a dry run re-reads captured responses and spends
  // nothing.
  const spend = dryRun ? null : createAiSpend('replay', { userId: admin.id });
  try {
    await spend?.reserve();
  } catch (error) {
    if (error instanceof RateLimitedError) {
      return adminReplayRateLimitResult(
        error.retryAfterSeconds ?? 1,
        'ai_paused'
      );
    }
    throw error;
  }

  // Pick the Gemini client BEFORE creating replay rows. For real replays
  // this also validates the AI provider config after the admin replay quota passes.
  let gemini: GeminiClient;
  if (dryRun) {
    gemini = await buildDryRunGeminiClient(originalId);
  } else {
    try {
      gemini = createPipelineLlm(resolveGeminiProvider(), {
        fallbackModel: CLAUDE_FALLBACK_MODEL,
      });
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
  let finalResult: import('@/lib/ai/types/result').PipelineResult | undefined;
  let errorCode: string | undefined;
  try {
    const runReplay = () =>
      analyzeMeal(
        orig.rawInput,
        orig.userContextJson as unknown as UserContext,
        db,
        gemini,
        () => {},
        { requestId: replayId, db, userId: orig.userId, promptVersionsUsed }
      );
    const result = spend ? await spend.run(runReplay) : await runReplay();
    if (!result.success) {
      finalStatus = 'error';
      errorMessage = result.error.message;
      errorCode = result.error.type;
    } else {
      finalResult = result.data;
    }
  } catch (e) {
    finalStatus = 'error';
    errorMessage = e instanceof Error ? e.message : String(e);
  } finally {
    await spend?.settle();
  }

  // AWAITED so the redirect lands on a row in its terminal state,
  // not 'pending'. Production route stays fire-and-forget via logPipelineEnd.
  await setPipelineFinalState({
    db,
    requestId: replayId,
    status: finalStatus,
    durationMs: Date.now() - t0,
    errorMessage,
    errorCode,
    result: finalResult,
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
