import { createHmac } from 'node:crypto';
import { sql } from 'drizzle-orm';
import { type AppDb, db as appDb } from '@/lib/db';
import {
  analysisInFlightLimits,
  analysisRateLimitWindows,
} from '@/lib/db/schema';

export const analysisGuardReasons = [
  'per_user_minute',
  'per_user_hour',
  'per_user_day',
  'concurrent_user',
  'admin_replay',
  'shadow_disabled',
  'global_budget',
  'provider_pressure',
  'spam_preflight',
] as const;

export type AnalysisGuardReason = (typeof analysisGuardReasons)[number];

export interface CheckAnalysisGuardsInput {
  userId: string;
  ip?: string | null;
  route: string;
  db?: AppDb;
  limits?: Partial<AnalysisGuardLimits>;
  now?: () => Date;
}

export interface CheckAdminReplayGuardInput {
  adminId: string;
  db?: AppDb;
  limits?: Partial<AdminReplayGuardLimits>;
  now?: () => Date;
}

export type AnalysisGuardAllowedResult = {
  allowed: true;
  release?: () => Promise<void> | void;
};

export type AnalysisGuardBlockedResult = {
  allowed: false;
  status: 429;
  reason: AnalysisGuardReason;
  retryAfterSeconds: number;
};

export type AnalysisGuardResult =
  | AnalysisGuardAllowedResult
  | AnalysisGuardBlockedResult;

export interface BuildAnalysisGuardEventInput {
  userId?: string | null;
  ip?: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds?: number | null;
}

export interface AnalysisGuardEventRow {
  userIdHash: string | null;
  ipHash: string | null;
  route: string;
  reason: AnalysisGuardReason;
  retryAfterSeconds: number | null;
}

export type AnalysisRateLimitWindowKind = 'minute' | 'hour' | 'day';

export interface AnalysisGuardLimits {
  perUserMinute: number;
  perUserHour: number;
  perUserDay: number;
  concurrentUser: number;
  concurrentRetryAfterSeconds: number;
}

export interface AdminReplayGuardLimits {
  perAdminHour: number;
}

export const defaultAnalysisGuardLimits: AnalysisGuardLimits = {
  perUserMinute: 3,
  perUserHour: 30,
  perUserDay: 100,
  concurrentUser: 1,
  concurrentRetryAfterSeconds: 15,
};

export const defaultAdminReplayGuardLimits: AdminReplayGuardLimits = {
  perAdminHour: 5,
};

export const adminReplayGuardRoute = '/admin/pipeline-replay/live';

const adminReplayWindowKind = 'hour' satisfies AnalysisRateLimitWindowKind;

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

function readPositiveInteger(
  value: string | number | undefined,
  fallback: number
) {
  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function resolveAnalysisGuardLimits(
  overrides: Partial<AnalysisGuardLimits> = {}
): AnalysisGuardLimits {
  const envLimits = {
    perUserMinute: readPositiveInteger(
      process.env.ANALYSIS_USER_MINUTE_LIMIT,
      defaultAnalysisGuardLimits.perUserMinute
    ),
    perUserHour: readPositiveInteger(
      process.env.ANALYSIS_USER_HOUR_LIMIT,
      defaultAnalysisGuardLimits.perUserHour
    ),
    perUserDay: readPositiveInteger(
      process.env.ANALYSIS_USER_DAY_LIMIT,
      defaultAnalysisGuardLimits.perUserDay
    ),
    concurrentUser: readPositiveInteger(
      process.env.ANALYSIS_USER_CONCURRENT_LIMIT,
      defaultAnalysisGuardLimits.concurrentUser
    ),
    concurrentRetryAfterSeconds: readPositiveInteger(
      process.env.ANALYSIS_CONCURRENT_RETRY_AFTER_SECONDS,
      defaultAnalysisGuardLimits.concurrentRetryAfterSeconds
    ),
  };

  return {
    perUserMinute: readPositiveInteger(
      overrides.perUserMinute,
      envLimits.perUserMinute
    ),
    perUserHour: readPositiveInteger(
      overrides.perUserHour,
      envLimits.perUserHour
    ),
    perUserDay: readPositiveInteger(overrides.perUserDay, envLimits.perUserDay),
    concurrentUser: readPositiveInteger(
      overrides.concurrentUser,
      envLimits.concurrentUser
    ),
    concurrentRetryAfterSeconds: readPositiveInteger(
      overrides.concurrentRetryAfterSeconds,
      envLimits.concurrentRetryAfterSeconds
    ),
  };
}

function resolveAdminReplayGuardLimits(
  overrides: Partial<AdminReplayGuardLimits> = {}
): AdminReplayGuardLimits {
  const envLimits = {
    perAdminHour: readPositiveInteger(
      process.env.ANALYSIS_ADMIN_REPLAY_HOUR_LIMIT,
      defaultAdminReplayGuardLimits.perAdminHour
    ),
  };

  return {
    perAdminHour: readPositiveInteger(
      overrides.perAdminHour,
      envLimits.perAdminHour
    ),
  };
}

export function getAnalysisWindowStart(
  now: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowStart = new Date(now);

  if (windowKind === 'day') {
    windowStart.setUTCHours(0, 0, 0, 0);
    return windowStart;
  }

  if (windowKind === 'hour') {
    windowStart.setUTCMinutes(0, 0, 0);
    return windowStart;
  }

  windowStart.setUTCSeconds(0, 0);
  return windowStart;
}

function getAnalysisWindowEnd(
  windowStart: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowEnd = new Date(windowStart);

  if (windowKind === 'day') {
    windowEnd.setUTCDate(windowEnd.getUTCDate() + 1);
    return windowEnd;
  }

  if (windowKind === 'hour') {
    windowEnd.setUTCHours(windowEnd.getUTCHours() + 1);
    return windowEnd;
  }

  windowEnd.setUTCMinutes(windowEnd.getUTCMinutes() + 1);
  return windowEnd;
}

export function getAnalysisWindowRetryAfterSeconds(
  now: Date,
  windowStart: Date,
  windowKind: AnalysisRateLimitWindowKind
) {
  const windowEnd = getAnalysisWindowEnd(windowStart, windowKind);
  const remainingMs = windowEnd.getTime() - now.getTime();

  return Math.max(1, Math.ceil(remainingMs / 1000));
}

type GuardMutationDb = Pick<AppDb, 'insert'>;

interface AnalysisGuardKey {
  keyKind: 'user';
  keyHash: string;
  route: string;
}

interface IncrementWindowCounterInput extends AnalysisGuardKey {
  windowKind: AnalysisRateLimitWindowKind;
  windowStart: Date;
  now: Date;
}

async function incrementWindowCounter(
  guardDb: GuardMutationDb,
  input: IncrementWindowCounterInput
) {
  const [row] = await guardDb
    .insert(analysisRateLimitWindows)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      windowKind: input.windowKind,
      windowStart: input.windowStart,
      count: 1,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisRateLimitWindows.keyKind,
        analysisRateLimitWindows.keyHash,
        analysisRateLimitWindows.route,
        analysisRateLimitWindows.windowKind,
        analysisRateLimitWindows.windowStart,
      ],
      set: {
        count: sql`${analysisRateLimitWindows.count} + 1`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisRateLimitWindows.count });

  return row.count;
}

async function incrementInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  const [row] = await guardDb
    .insert(analysisInFlightLimits)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      count: 1,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisInFlightLimits.keyKind,
        analysisInFlightLimits.keyHash,
        analysisInFlightLimits.route,
      ],
      set: {
        count: sql`${analysisInFlightLimits.count} + 1`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisInFlightLimits.count });

  return row.count;
}

async function decrementInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  await guardDb
    .insert(analysisInFlightLimits)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      count: 0,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisInFlightLimits.keyKind,
        analysisInFlightLimits.keyHash,
        analysisInFlightLimits.route,
      ],
      set: {
        count: sql`greatest(${analysisInFlightLimits.count} - 1, 0)`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisInFlightLimits.count });
}

class AnalysisGuardBlockedError extends Error {
  constructor(public readonly result: AnalysisGuardBlockedResult) {
    super(result.reason);
  }
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
      for (const windowGuard of userWindowGuards) {
        const windowStart = getAnalysisWindowStart(now, windowGuard.windowKind);
        const count = await incrementWindowCounter(tx, {
          ...guardKey,
          windowKind: windowGuard.windowKind,
          windowStart,
          now,
        });

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
