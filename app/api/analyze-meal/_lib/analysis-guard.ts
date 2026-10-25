import type { NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { type AiSpend, createAiSpend } from '@/lib/ai/cost/ai-spend';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { RateLimitedError } from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { analysisGuardEvents } from '@/lib/infra/db/schema';
import type { AnalysisGuardAllowedResult } from '@/lib/infra/rate-limit/analysis-guard-types';
import {
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
} from '@/lib/infra/rate-limit/analysis-guards';
import { getRequestIp } from '@/lib/infra/security/request-ip';

const analyzeMealRoute = '/api/analyze-meal';

type AnalysisGuardResult =
  | {
      allowed: true;
      /** Frees the in-flight slot and settles the AI spend. */
      release: AnalysisGuardAllowedResult['release'];
      /** Runs the analysis with its model calls metered for the brake. */
      spend: AiSpend;
    }
  | { allowed: false; error: Response };

export async function acquireAnalysisGuard(
  request: NextRequest,
  userId: string,
  locale: string
): Promise<AnalysisGuardResult> {
  const ip = getRequestIp(request);
  const guard = await checkAnalysisGuards({
    userId,
    ip,
    route: analyzeMealRoute,
    db,
  });

  if (guard.allowed) {
    // Per-user first: a request this user may not make never touches the
    // app-wide brake. The brake refuses everyone once today's AI spend would
    // pass its limit — with its own message, still a RATE_LIMITED 429.
    const spend = createAiSpend('meal', { userId });
    try {
      await spend.reserve();
    } catch (error) {
      await Promise.resolve(guard.release?.()).catch((releaseError) => {
        console.error(
          '[analyze-meal] Failed to release analysis guard:',
          releaseError
        );
      });
      if (!(error instanceof RateLimitedError)) throw error;
      const retryAfterSeconds = error.retryAfterSeconds ?? 1;
      const t = await getTranslations({ locale, namespace: 'errors' });
      return {
        allowed: false,
        error: Response.json(
          Errors.aiPaused(retryAfterSeconds, t('aiPaused')).toJSON(),
          {
            status: 429,
            headers: { 'Retry-After': String(retryAfterSeconds) },
          }
        ),
      };
    }

    return {
      allowed: true,
      spend,
      release: async () => {
        await spend.settle();
        await guard.release?.();
      },
    };
  }

  if (readBooleanEnv('ANALYSIS_GUARD_EVENT_LOGGING_ENABLED', true)) {
    try {
      await db.insert(analysisGuardEvents).values(
        buildAnalysisGuardEvent({
          userId,
          ip,
          route: analyzeMealRoute,
          reason: guard.reason,
          retryAfterSeconds: guard.retryAfterSeconds,
        })
      );
    } catch (error) {
      console.error(
        '[analyze-meal] Failed to log analysis guard event:',
        error
      );
    }
  }

  const t = await getTranslations({ locale, namespace: 'errors' });
  return {
    allowed: false,
    error: Response.json(Errors.rateLimited(t('rateLimited')).toJSON(), {
      status: guard.status,
      headers: { 'Retry-After': String(guard.retryAfterSeconds) },
    }),
  };
}
