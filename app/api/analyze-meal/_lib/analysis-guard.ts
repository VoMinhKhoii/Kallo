import { getTranslations } from 'next-intl/server';
import { type AiSpend, createAiSpend } from '@/lib/ai/cost/ai-spend';
import {
  RateLimitedError,
  type RateLimitedReason,
} from '@/lib/core/errors/app-error';
import { Errors } from '@/lib/core/errors/catalog';
import { isBillingSandboxUser } from '@/lib/domain/billing/revenuecat/identity';
import { consumeRateLimit } from '@/lib/infra/rate-limit/limiter/limiter';

type AnalysisGuardResult =
  | {
      allowed: true;
      /** Frees the one-at-a-time slot and settles the AI spend. */
      release: () => Promise<void>;
      /** Runs the analysis with its model calls metered for the brake. */
      spend: AiSpend;
    }
  | { allowed: false; error: Response };

/** The `errors` message each refusal is worded with. */
const refusalMessageKey = {
  ai_paused: 'aiPaused',
  daily_limit: 'analysisDailyLimit',
  in_flight: 'analysisInFlight',
} as const satisfies Record<RateLimitedReason, string>;

/**
 * Admit one analysis: the user's 30-a-day cap and one-at-a-time slot
 * (`analyzeMeal`) and the app-wide AI spend brake, in one database call.
 *
 * A cheat-mode clarify answer is the reply to the estimator's question, not a
 * new meal: it takes the slot but not one of the 30, and counts against its
 * own cap instead (`analyzeMealClarify`). App Review accounts are never
 * refused by the day cap or the brake; they still run one at a time.
 *
 * Every refusal is the `RATE_LIMITED` 429 + `Retry-After` the apps already
 * parse, worded for what refused. A limiter that cannot answer throws
 * (503 via the route's pre-stream handler): every analysis spends money.
 */
export async function acquireAnalysisGuard(
  userId: string,
  locale: string,
  request: { isClarifyAnswer: boolean }
): Promise<AnalysisGuardResult> {
  const reviewer = isBillingSandboxUser(userId);
  const key = { kind: 'user', value: userId } as const;
  const spend = createAiSpend('meal', {
    userId,
    rateLimit: {
      policy: 'analyzeMeal',
      key,
      countWindows: !request.isClarifyAnswer && !reviewer,
    },
  });

  try {
    if (request.isClarifyAnswer && !reviewer) {
      const clarify = await consumeRateLimit('analyzeMealClarify', key);
      if (!clarify.allowed) {
        throw Errors.rateLimited(
          undefined,
          clarify.retryAfterSeconds,
          clarify.reason === 'day' ? 'daily_limit' : undefined
        );
      }
    }
    await spend.reserve();
  } catch (error) {
    if (!(error instanceof RateLimitedError)) throw error;
    const retryAfterSeconds = error.retryAfterSeconds ?? 1;
    const t = await getTranslations({ locale, namespace: 'errors' });
    const message = t(
      error.reason ? refusalMessageKey[error.reason] : 'rateLimited'
    );
    return {
      allowed: false,
      error: Response.json(
        Errors.rateLimited(message, retryAfterSeconds).toJSON(),
        {
          status: 429,
          headers: { 'Retry-After': String(retryAfterSeconds) },
        }
      ),
    };
  }

  return { allowed: true, spend, release: () => spend.settle() };
}
