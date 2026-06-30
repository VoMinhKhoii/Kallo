import { createHmac } from 'node:crypto';
import { and, eq, gt, lt, sql } from 'drizzle-orm';
import { type AppDb, db as appDb } from '@/lib/db';
import {
  analysisInFlightLimits,
  analysisModelBudgetEvents,
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

export type AnalysisModelBudgetWorkKind = 'primary' | 'shadow' | 'nonessential';

export type AnalysisModelProviderErrorCategory =
  | 'rate_limit'
  | 'quota'
  | 'server_error'
  | 'timeout'
  | 'network'
  | 'unknown';

export interface RecordAnalysisModelBudgetEventInput {
  db?: AppDb;
  now?: () => Date;
  requestId?: string | null;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  model?: string | null;
  requestCount?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
  errorCategory?: AnalysisModelProviderErrorCategory | null;
}

export interface NonessentialAnalysisGuardLimits {
  shadowDailyRequestLimit: number;
  globalDailyRequestLimit: number;
  globalDailyTokenLimit: number;
  providerErrorWindowSeconds: number;
  providerErrorThreshold: number;
  providerPressureRetryAfterSeconds: number;
}

export type NonessentialAnalysisGuardReason =
  | 'shadow_quota'
  | 'global_budget'
  | 'provider_pressure';

export type NonessentialAnalysisGuardResult =
  | { allowed: true }
  | {
      allowed: false;
      reason: NonessentialAnalysisGuardReason;
      retryAfterSeconds: number;
    };

export interface AnalysisModelDailyUsage {
  globalRequests: number;
  shadowRequests: number;
  globalTokens: number;
}

export interface AnalysisModelBudgetSourceInput {
  db?: AppDb;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  now: Date;
  dayStart: Date;
}

export interface AnalysisModelProviderErrorSourceInput {
  db?: AppDb;
  provider: string;
  now: Date;
  windowStart: Date;
}

export interface AnalysisModelBudgetSource {
  getDailyUsage: (
    input: AnalysisModelBudgetSourceInput
  ) => Promise<AnalysisModelDailyUsage>;
  getProviderErrorCount: (
    input: AnalysisModelProviderErrorSourceInput
  ) => Promise<number>;
}

export interface CheckNonessentialAnalysisGuardsInput {
  db?: AppDb;
  source?: AnalysisModelBudgetSource;
  route: string;
  workKind: AnalysisModelBudgetWorkKind;
  provider: string;
  model?: string | null;
  requestId?: string | null;
  limits?: Partial<NonessentialAnalysisGuardLimits>;
  now?: () => Date;
  reserve?: boolean;
}

export const defaultAnalysisGuardLimits: AnalysisGuardLimits = {
  perUserMinute: 3,
  perUserHour: 30,
  perUserDay: 100,
  concurrentUser: 1,
  concurrentRetryAfterSeconds: 15,
};

const DEFAULT_IN_FLIGHT_STALE_AFTER_SECONDS = 90;

export const defaultAdminReplayGuardLimits: AdminReplayGuardLimits = {
  perAdminHour: 5,
};

export const defaultNonessentialAnalysisGuardLimits: NonessentialAnalysisGuardLimits =
  {
    shadowDailyRequestLimit: 100,
    globalDailyRequestLimit: 5000,
    globalDailyTokenLimit: 5_000_000,
    providerErrorWindowSeconds: 300,
    providerErrorThreshold: 5,
    providerPressureRetryAfterSeconds: 60,
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

function readNonNegativeInteger(
  value: string | number | null | undefined,
  fallback: number
) {
  if (value == null) return fallback;

  const parsed = typeof value === 'number' ? value : Number(value);

  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

function resolveNonessentialAnalysisGuardLimits(
  overrides: Partial<NonessentialAnalysisGuardLimits> = {}
): NonessentialAnalysisGuardLimits {
  const envLimits = {
    shadowDailyRequestLimit: readPositiveInteger(
      process.env.ANALYSIS_SHADOW_DAILY_REQUEST_LIMIT,
      defaultNonessentialAnalysisGuardLimits.shadowDailyRequestLimit
    ),
    globalDailyRequestLimit: readPositiveInteger(
      process.env.ANALYSIS_GLOBAL_DAILY_REQUEST_LIMIT,
      defaultNonessentialAnalysisGuardLimits.globalDailyRequestLimit
    ),
    globalDailyTokenLimit: readPositiveInteger(
      process.env.ANALYSIS_GLOBAL_DAILY_TOKEN_LIMIT,
      defaultNonessentialAnalysisGuardLimits.globalDailyTokenLimit
    ),
    providerErrorWindowSeconds: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_ERROR_WINDOW_SECONDS,
      defaultNonessentialAnalysisGuardLimits.providerErrorWindowSeconds
    ),
    providerErrorThreshold: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_ERROR_THRESHOLD,
      defaultNonessentialAnalysisGuardLimits.providerErrorThreshold
    ),
    providerPressureRetryAfterSeconds: readPositiveInteger(
      process.env.ANALYSIS_PROVIDER_PRESSURE_RETRY_AFTER_SECONDS,
      defaultNonessentialAnalysisGuardLimits.providerPressureRetryAfterSeconds
    ),
  };

  return {
    shadowDailyRequestLimit: readPositiveInteger(
      overrides.shadowDailyRequestLimit,
      envLimits.shadowDailyRequestLimit
    ),
    globalDailyRequestLimit: readPositiveInteger(
      overrides.globalDailyRequestLimit,
      envLimits.globalDailyRequestLimit
    ),
    globalDailyTokenLimit: readPositiveInteger(
      overrides.globalDailyTokenLimit,
      envLimits.globalDailyTokenLimit
    ),
    providerErrorWindowSeconds: readPositiveInteger(
      overrides.providerErrorWindowSeconds,
      envLimits.providerErrorWindowSeconds
    ),
    providerErrorThreshold: readPositiveInteger(
      overrides.providerErrorThreshold,
      envLimits.providerErrorThreshold
    ),
    providerPressureRetryAfterSeconds: readPositiveInteger(
      overrides.providerPressureRetryAfterSeconds,
      envLimits.providerPressureRetryAfterSeconds
    ),
  };
}

function normalizeProviderPressureOverride() {
  const value = process.env.ANALYSIS_PROVIDER_PRESSURE_OVERRIDE?.toLowerCase();

  if (value === 'on' || value === 'true' || value === 'force_on') {
    return 'on' as const;
  }

  if (value === 'off' || value === 'false' || value === 'force_off') {
    return 'off' as const;
  }

  return 'auto' as const;
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

type GuardMutationDb = Pick<AppDb, 'insert' | 'update'>;

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

function getInFlightStaleAfterSeconds() {
  return readPositiveInteger(
    process.env.ANALYSIS_IN_FLIGHT_STALE_AFTER_SECONDS,
    DEFAULT_IN_FLIGHT_STALE_AFTER_SECONDS
  );
}

async function resetStaleInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  const staleBefore = new Date(
    input.now.getTime() - getInFlightStaleAfterSeconds() * 1000
  );

  await guardDb
    .update(analysisInFlightLimits)
    .set({
      count: 0,
      // Keep the threshold timestamp so the next upsert can move the row to
      // "active now" in the same transaction without preserving stale age.
      updatedAt: staleBefore,
    })
    .where(
      and(
        eq(analysisInFlightLimits.keyKind, input.keyKind),
        eq(analysisInFlightLimits.keyHash, input.keyHash),
        eq(analysisInFlightLimits.route, input.route),
        gt(analysisInFlightLimits.count, 0),
        lt(analysisInFlightLimits.updatedAt, staleBefore)
      )
    );
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

function nonessentialBlocked(
  reason: NonessentialAnalysisGuardReason,
  retryAfterSeconds: number
): NonessentialAnalysisGuardResult {
  return { allowed: false, reason, retryAfterSeconds };
}

function toInteger(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export const drizzleAnalysisModelBudgetSource: AnalysisModelBudgetSource = {
  async getDailyUsage(input) {
    const budgetDb = input.db ?? appDb;
    const [row] = await budgetDb
      .select({
        globalRequests: sql<number>`coalesce(sum(${analysisModelBudgetEvents.requestCount}), 0)::int`,
        shadowRequests: sql<number>`coalesce(sum(${analysisModelBudgetEvents.requestCount}) filter (where ${analysisModelBudgetEvents.workKind} = 'shadow'), 0)::int`,
        globalTokens: sql<number>`coalesce(sum(${analysisModelBudgetEvents.inputTokens} + ${analysisModelBudgetEvents.outputTokens}), 0)::int`,
      })
      .from(analysisModelBudgetEvents)
      .where(
        sql`${analysisModelBudgetEvents.createdAt} >= ${input.dayStart} AND ${analysisModelBudgetEvents.createdAt} <= ${input.now}`
      );

    return {
      globalRequests: toInteger(row?.globalRequests),
      shadowRequests: toInteger(row?.shadowRequests),
      globalTokens: toInteger(row?.globalTokens),
    };
  },
  async getProviderErrorCount(input) {
    const budgetDb = input.db ?? appDb;
    const [row] = await budgetDb
      .select({
        providerErrors: sql<number>`count(*)::int`,
      })
      .from(analysisModelBudgetEvents)
      .where(
        sql`${analysisModelBudgetEvents.createdAt} >= ${input.windowStart} AND ${analysisModelBudgetEvents.createdAt} <= ${input.now} AND ${analysisModelBudgetEvents.provider} = ${input.provider} AND ${analysisModelBudgetEvents.errorCategory} IS NOT NULL`
      );

    return toInteger(row?.providerErrors);
  },
};

export async function recordAnalysisModelBudgetEvent(
  input: RecordAnalysisModelBudgetEventInput
): Promise<void> {
  const eventDb = input.db ?? appDb;
  const now = input.now?.() ?? new Date();

  const insertResult = eventDb.insert(analysisModelBudgetEvents).values({
    createdAt: now,
    requestId: input.requestId ?? null,
    route: input.route,
    workKind: input.workKind,
    provider: input.provider,
    model: input.model ?? null,
    requestCount: readNonNegativeInteger(input.requestCount, 1),
    inputTokens: readNonNegativeInteger(input.inputTokens, 0),
    outputTokens: readNonNegativeInteger(input.outputTokens, 0),
    errorCategory: input.errorCategory ?? null,
  });

  if (
    insertResult &&
    typeof insertResult === 'object' &&
    'returning' in insertResult &&
    typeof insertResult.returning === 'function'
  ) {
    await insertResult.returning({ id: analysisModelBudgetEvents.id });
    return;
  }

  await insertResult;
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
