import type { NextRequest } from 'next/server';
import {
  buildAiRequestContext,
  buildUserContext,
} from '@/lib/ai/adapters/user-context';
import { runAnalysisStream } from '@/lib/ai/pipeline/stream/run-analysis-stream';
import { logPipelineStart } from '@/lib/ai/pipeline/telemetry/logging';
import { encodeSSE } from '@/lib/ai/streaming/encoder';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { serializeError } from '@/lib/core/errors/serialize';
import { db } from '@/lib/infra/db/client';
import { acquireAnalysisGuard } from './_lib/analysis-guard';
import { applyRelogRefs } from './_lib/apply-relog-refs';
import { getBillingAccessError } from './_lib/billing-access';
import {
  createGuardRelease,
  resolveGeminiConfig,
  validateRequest,
} from './_lib/request-validation';

export const maxDuration = 60;

// The guard release in `finally` is DB-backed; bound it so it can never block
// `controller.close()`.
const GUARD_RELEASE_DEADLINE_MS = 5_000;

/** A taken concurrency guard the stream has not yet taken ownership of. */
interface PendingGuard {
  release?: () => Promise<void>;
}

export async function POST(request: NextRequest) {
  // Anything before the stream opens can throw: the billing and guard checks
  // and the trace insert all hit the database. Answer such a throw with the
  // JSON error envelope the contract documents, not Next's bare 500, and hand
  // back a guard that was already taken.
  const pending: PendingGuard = {};
  try {
    return await startAnalysis(request, pending);
  } catch (error) {
    await pending.release?.();
    console.error('[analyze-meal] Pre-stream failure:', error);
    return serializeError(error);
  }
}

async function startAnalysis(
  request: NextRequest,
  pending: PendingGuard
): Promise<Response> {
  // Phase 1: Pre-stream validation — errors returned as JSON
  const validation = await validateRequest(request);
  if (validation.error) return validation.error;
  const {
    userId,
    message,
    locale,
    loggedAt,
    mode,
    cheatType,
    clarifyAnswer,
    cheatIntensity,
    attemptId,
    refs,
    displayText,
    profile,
  } = validation.data;

  // Fail before both provider spend and rate-limit consumption. The server's
  // entitlement state is authoritative; clients never self-grant access.
  const billingError = await getBillingAccessError({
    userId,
    profileCreatedAt: profile.createdAt,
    locale: locale ?? profile.preferredLocale ?? 'en',
  });
  if (billingError) return billingError;

  const providerConfig = resolveGeminiConfig();
  if (!providerConfig.ok) return providerConfig.error;

  const userContext = buildAiRequestContext(buildUserContext(profile), {
    mealText: message,
    requestLocale: locale,
    profileLocale: profile.preferredLocale,
  });
  const guard = await acquireAnalysisGuard(
    request,
    userId,
    locale ?? profile.preferredLocale ?? 'en'
  );
  if (!guard.allowed) return guard.error;
  const releaseGuard = createGuardRelease(guard.release);
  pending.release = releaseGuard;

  // Awaited so child trace inserts have a parent row to FK against
  const requestId = await logPipelineStart({
    userId,
    rawInput: message,
    userContext,
    db,
  });

  // From here the stream owns the guard and releases it when it closes.
  pending.release = undefined;

  // Phase 2: Stream pipeline results as SSE
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const emit = (event: StreamEvent) => {
        controller.enqueue(encoder.encode(encodeSSE(event)));
      };
      const releaseOnAbort = () => {
        void releaseGuard();
      };

      request.signal.addEventListener('abort', releaseOnAbort, { once: true });

      try {
        await runAnalysisStream({
          emit,
          ctx: {
            signal: request.signal,
            db,
            requestId,
            userId,
            message,
            userContext,
            loggedAt,
            attemptId,
            geminiConfig: providerConfig.config,
            mode,
            cheatType,
            clarifyAnswer,
            cheatIntensity,
            refs,
            displayText,
            mergePicks: applyRelogRefs,
          },
        });
      } finally {
        request.signal.removeEventListener('abort', releaseOnAbort);
        // The guard release is a DB write; bound it so a stalled pool can't
        // block the stream close. Still awaited (best-effort) so the in-flight
        // counter is decremented before the instance can freeze.
        try {
          await withDeadline(
            Promise.resolve(releaseGuard()),
            GUARD_RELEASE_DEADLINE_MS
          );
        } catch (releaseError) {
          console.error(
            '[analyze-meal] Guard release timed out or failed:',
            releaseError
          );
        }
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
