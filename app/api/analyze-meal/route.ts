import type { NextRequest } from 'next/server';
import {
  buildAiRequestContext,
  buildUserContext,
} from '@/lib/ai/adapters/user-context';
import { runAnalysisStream } from '@/lib/ai/pipeline/stream/run-analysis-stream';
import { logPipelineStart } from '@/lib/ai/pipeline/telemetry/logging';
import type { StreamEvent } from '@/lib/ai/streaming';
import { encodeSSE } from '@/lib/ai/streaming';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { db } from '@/lib/infra/db';
import { acquireAnalysisGuard } from './_lib/analysis-guard';
import { applyRelogRefs } from './_lib/apply-relog-refs';
import { getBillingAccessError } from './_lib/billing-access';
import {
  createGuardRelease,
  resolveGeminiConfig,
  validateRequest,
} from './_lib/request-validation';

export const runtime = 'nodejs';
export const maxDuration = 60;

// The guard release in `finally` is DB-backed; bound it so it can never block
// `controller.close()`.
const GUARD_RELEASE_DEADLINE_MS = 5_000;

export async function POST(request: NextRequest) {
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

  // Awaited so child trace inserts have a parent row to FK against
  let requestId: string;
  try {
    requestId = await logPipelineStart({
      userId,
      rawInput: message,
      userContext,
      db,
    });
  } catch (error) {
    await releaseGuard();
    throw error;
  }

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
            mergeRelogRefs: applyRelogRefs,
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
