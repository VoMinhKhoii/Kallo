import { createHmac } from 'node:crypto';
import { db as appDb } from '@/lib/infra/db/client';
import {
  AnalysisGuardBlockedError,
  type AnalysisGuardKey,
  decrementInFlightCounter,
  incrementInFlightCounter,
  incrementWindowCounter,
  incrementWindowCounters,
  resetStaleInFlightCounter,
} from './analysis-guard-counters';
import {
  adminReplayGuardRoute,
  adminReplayWindowKind,
  normalizeProviderPressureOverride,
  resolveAdminReplayGuardLimits,
  resolveAnalysisGuardLimits,
  resolveNonessentialAnalysisGuardLimits,
} from './analysis-guard-limits';
import type {
  AnalysisGuardBlockedResult,
  AnalysisGuardEventRow,
  AnalysisGuardLimits,
  AnalysisGuardReason,
  AnalysisGuardResult,
  AnalysisRateLimitWindowKind,
  BuildAnalysisGuardEventInput,
  CheckAdminReplayGuardInput,
  CheckAnalysisGuardsInput,
  CheckNonessentialAnalysisGuardsInput,
  NonessentialAnalysisGuardReason,
  NonessentialAnalysisGuardResult,
} from './analysis-guard-types';
import {
  drizzleAnalysisModelBudgetSource,
  recordAnalysisModelBudgetEvent,
} from './analysis-model-budget';
import {
  getAnalysisWindowRetryAfterSeconds,
  getAnalysisWindowStart,
} from './analysis-windows';

const testHashSecret = 'analysis-guard-event-test-secret';

function getAnalysisGuardHashSecret() {
  const secret = process.env.ANALYSIS_GUARD_HASH_SECRET;

  if (secret) return secret;
  if (process.env.NODE_ENV === 'test') return testHashSecret;

  throw new Error('ANALYSIS_GUARD_HASH_SECRET is required');
}

function hashIdentifier(secret: string, payload: string) {
  return createHmac('sha256', secret).update(payload).digest('hex');
}

function hashOptionalIdentifier(
  secret: string,
  domain: 'ip' | 'user',
  value: string | null | undefined
) {
  if (!value) return null;

  return hashIdentifier(secret, `${domain}:${value}`);
}

export function buildAnalysisGuardEvent(
  input: BuildAnalysisGuardEventInput
): AnalysisGuardEventRow {
  const secret = getAnalysisGuardHashSecret();

  return {
    userIdHash: hashOptionalIdentifier(secret, 'user', input.userId),
    ipHash: hashOptionalIdentifier(secret, 'ip', input.ip),
    route: input.route,
    reason: input.reason,
    retryAfterSeconds: input.retryAfterSeconds ?? null,
  };
}

function blocked(
  reason: AnalysisGuardReason,
  retryAfterSeconds: number
): AnalysisGuardBlockedResult {
  return {
    allowed: false,
    status: 429,
    reason,
    retryAfterSeconds,
  };
}

const userWindowGuards = [
  {
    windowKind: 'minute',
    limitKey: 'perUserMinute',
    reason: 'per_user_minute',
  },
  {
    windowKind: 'hour',
    limitKey: 'perUserHour',
    reason: 'per_user_hour',
  },
  {
    windowKind: 'day',
    limitKey: 'perUserDay',
    reason: 'per_user_day',
  },
] as const satisfies readonly {
  windowKind: AnalysisRateLimitWindowKind;
  limitKey: keyof Pick<
    AnalysisGuardLimits,
    'perUserMinute' | 'perUserHour' | 'perUserDay'
  >;
  reason: AnalysisGuardReason;
}[];

function nonessentialBlocked(
  reason: NonessentialAnalysisGuardReason,
  retryAfterSeconds: number
): NonessentialAnalysisGuardResult {
  return { allowed: false, reason, retryAfterSeconds };
}

export async function checkNonessentialAnalysisGuards(
  input: CheckNonessentialAnalysisGuardsInput
): Promise<NonessentialAnalysisGuardResult> {
  const now = input.now?.() ?? new Date();
  const limits = resolveNonessentialAnalysisGuardLimits(input.limits);
  const source = input.source ?? drizzleAnalysisModelBudgetSource;
  const dayStart = getAnalysisWindowStart(now, 'day');
  const dailyUsage = await source.getDailyUsage({
    db: input.db,
    route: input.route,
    workKind: input.workKind,
    provider: input.provider,
    now,
    dayStart,
  });
  const dailyRetryAfterSeconds = getAnalysisWindowRetryAfterSeconds(
    now,
    dayStart,
    'day'
  );

  if (
    input.workKind === 'shadow' &&
    dailyUsage.shadowRequests >= limits.shadowDailyRequestLimit
  ) {
    return nonessentialBlocked('shadow_quota', dailyRetryAfterSeconds);
  }

  if (dailyUsage.globalRequests >= limits.globalDailyRequestLimit) {
    return nonessentialBlocked('global_budget', dailyRetryAfterSeconds);
  }

  if (dailyUsage.globalTokens >= limits.globalDailyTokenLimit) {
    return nonessentialBlocked('global_budget', dailyRetryAfterSeconds);
  }

  const providerOverride = normalizeProviderPressureOverride();
  if (providerOverride === 'on') {
    return nonessentialBlocked(
      'provider_pressure',
      limits.providerPressureRetryAfterSeconds
    );
  }

  if (providerOverride !== 'off') {
    const providerWindowStart = new Date(
      now.getTime() - limits.providerErrorWindowSeconds * 1000
    );
    const providerErrorCount = await source.getProviderErrorCount({
      db: input.db,
      provider: input.provider,
      now,
      windowStart: providerWindowStart,
    });

    if (providerErrorCount >= limits.providerErrorThreshold) {
      return nonessentialBlocked(
        'provider_pressure',
        limits.providerPressureRetryAfterSeconds
      );
    }
  }

  if (input.reserve) {
    await recordAnalysisModelBudgetEvent({
      db: input.db,
      now: () => now,
      requestId: input.requestId ?? null,
      route: input.route,
      workKind: input.workKind,
      provider: input.provider,
      model: input.model ?? null,
      requestCount: 1,
    });
  }

  return { allowed: true };
}

export async function checkAnalysisGuards(
  input: CheckAnalysisGuardsInput
): Promise<AnalysisGuardResult> {
  const guardDb = input.db ?? appDb;
  const now = input.now?.() ?? new Date();
  const limits = resolveAnalysisGuardLimits(input.limits);
  const secret = getAnalysisGuardHashSecret();
  const guardKey = {
    keyKind: 'user',
    keyHash: hashIdentifier(secret, `user:${input.userId}`),
    route: input.route,
  } satisfies AnalysisGuardKey;

  try {
    await guardDb.transaction(async (tx) => {
      // One statement for all three windows, then check them in the SAME order
      // as before — the reason and Retry-After a caller sees must still be the
      // first window it exceeded, not whichever row Postgres returned first.
      //
      // Checking after incrementing all three is not a behaviour change: this
      // runs inside a transaction, and throwing rolls every increment back, so
      // a blocked request has never left a counter raised.
      const windowStarts = new Map(
        userWindowGuards.map((guard) => [
          guard.windowKind,
          getAnalysisWindowStart(now, guard.windowKind),
        ])
      );
      const counts = await incrementWindowCounters(
        tx,
        userWindowGuards.map((guard) => ({
          ...guardKey,
          windowKind: guard.windowKind,
          windowStart: windowStarts.get(guard.windowKind) as Date,
          now,
        }))
      );

      for (const windowGuard of userWindowGuards) {
        const windowStart = windowStarts.get(windowGuard.windowKind) as Date;
        const count = counts.get(windowGuard.windowKind) ?? 0;

        if (count > limits[windowGuard.limitKey]) {
          throw new AnalysisGuardBlockedError(
            blocked(
              windowGuard.reason,
              getAnalysisWindowRetryAfterSeconds(
                now,
                windowStart,
                windowGuard.windowKind
              )
            )
          );
        }
      }

      await resetStaleInFlightCounter(tx, {
        ...guardKey,
        now,
      });

      const inFlightCount = await incrementInFlightCounter(tx, {
        ...guardKey,
        now,
      });

      if (inFlightCount > limits.concurrentUser) {
        throw new AnalysisGuardBlockedError(
          blocked('concurrent_user', limits.concurrentRetryAfterSeconds)
        );
      }
    });
  } catch (error) {
    if (error instanceof AnalysisGuardBlockedError) {
      return error.result;
    }

    throw error;
  }

  let releasePromise: Promise<void> | undefined;

  const release = () => {
    releasePromise ??= decrementInFlightCounter(guardDb, {
      ...guardKey,
      now: input.now?.() ?? new Date(),
    });

    return releasePromise;
  };

  return { allowed: true, release };
}

export async function checkAdminReplayGuard(
  input: CheckAdminReplayGuardInput
): Promise<AnalysisGuardResult> {
  const guardDb = input.db ?? appDb;
  const now = input.now?.() ?? new Date();
  const limits = resolveAdminReplayGuardLimits(input.limits);
  const secret = getAnalysisGuardHashSecret();
  const guardKey = {
    keyKind: 'user',
    keyHash: hashIdentifier(secret, `admin_replay_user:${input.adminId}`),
    route: adminReplayGuardRoute,
  } satisfies AnalysisGuardKey;
  const windowStart = getAnalysisWindowStart(now, adminReplayWindowKind);

  try {
    await guardDb.transaction(async (tx) => {
      const count = await incrementWindowCounter(tx, {
        ...guardKey,
        windowKind: adminReplayWindowKind,
        windowStart,
        now,
      });

      if (count > limits.perAdminHour) {
        throw new AnalysisGuardBlockedError(
          blocked(
            'admin_replay',
            getAnalysisWindowRetryAfterSeconds(
              now,
              windowStart,
              adminReplayWindowKind
            )
          )
        );
      }
    });
  } catch (error) {
    if (error instanceof AnalysisGuardBlockedError) {
      return error.result;
    }

    throw error;
  }

  return { allowed: true };
}
