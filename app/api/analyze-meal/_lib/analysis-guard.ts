import type { NextRequest } from 'next/server';
import { getTranslations } from 'next-intl/server';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db';
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
      release: AnalysisGuardAllowedResult['release'];
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

  if (guard.allowed) return { allowed: true, release: guard.release };

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
