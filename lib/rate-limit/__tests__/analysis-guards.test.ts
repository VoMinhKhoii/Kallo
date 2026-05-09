import { createHmac } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppDb } from '@/lib/db';
import {
  analysisInFlightLimits,
  analysisModelBudgetEvents,
  analysisRateLimitWindows,
} from '@/lib/db/schema';
import {
  type AdminReplayGuardLimits,
  type AnalysisGuardLimits,
  type AnalysisGuardResult,
  type AnalysisModelBudgetSource,
  type AnalysisRateLimitWindowKind,
  adminReplayGuardRoute,
  type BuildAnalysisGuardEventInput,
  buildAnalysisGuardEvent,
  checkAdminReplayGuard,
  checkAnalysisGuards,
  checkNonessentialAnalysisGuards,
  getAnalysisWindowRetryAfterSeconds,
  getAnalysisWindowStart,
  type NonessentialAnalysisGuardLimits,
  recordAnalysisModelBudgetEvent,
} from '../analysis-guards';

const hashSecret = 'analysis-guard-unit-test-secret';
const analyzeMealRoute = '/api/analyze-meal';
const fixedNow = new Date('2026-05-07T12:34:15.250Z');

const generousLimits = {
  perUserMinute: 100,
  perUserHour: 100,
  perUserDay: 100,
  concurrentUser: 100,
  concurrentRetryAfterSeconds: 12,
} satisfies AnalysisGuardLimits;

const generousNonessentialLimits = {
  shadowDailyRequestLimit: 100,
  globalDailyRequestLimit: 1000,
  globalDailyTokenLimit: 1_000_000,
  providerErrorWindowSeconds: 300,
  providerErrorThreshold: 5,
  providerPressureRetryAfterSeconds: 60,
} satisfies NonessentialAnalysisGuardLimits;

function hmacHex(payload: string) {
  return createHmac('sha256', hashSecret).update(payload).digest('hex');
}

function hashedUser(userId: string) {
  return hmacHex(`user:${userId}`);
}

function hashedAdminReplayUser(adminId: string) {
  return hmacHex(`admin_replay_user:${adminId}`);
}

interface WindowRow {
  keyKind: 'user';
  keyHash: string;
  route: string;
  windowKind: AnalysisRateLimitWindowKind;
  windowStart: Date;
  count: number;
  createdAt: Date;
  updatedAt: Date;
}

interface InFlightRow {
  keyKind: 'user';
  keyHash: string;
  route: string;
  count: number;
  updatedAt: Date;
}

interface BudgetEventRow {
  id?: string;
  createdAt: Date;
  requestId: string | null;
  route: string;
  workKind: 'primary' | 'shadow' | 'nonessential';
  provider: string;
  model: string | null;
  requestCount: number;
  inputTokens: number;
  outputTokens: number;
  errorCategory: string | null;
}

interface GuardState {
  windows: Map<string, WindowRow>;
  inFlight: Map<string, InFlightRow>;
  budgetEvents: BudgetEventRow[];
}

class InMemoryAnalysisGuardDb {
  private state: GuardState = {
    windows: new Map(),
    inFlight: new Map(),
    budgetEvents: [],
  };

  private transactionQueue = Promise.resolve();

  readonly client = {
    transaction: async <T>(
      callback: (transactionClient: AppDb) => Promise<T> | T
    ) => {
      const runAfter = this.transactionQueue.catch(() => undefined);
      let releaseQueue!: () => void;
      this.transactionQueue = new Promise<void>((resolve) => {
        releaseQueue = resolve;
      });

      await runAfter;

      const nextState = this.cloneState(this.state);

      try {
        const result = await callback(this.createClient(nextState));
        this.state = nextState;
        return result;
      } finally {
        releaseQueue();
      }
    },
    insert: (table: unknown) => this.createInsertBuilder(this.state, table),
  } as unknown as AppDb;

  getWindowCount(
    userId: string,
    route: string,
    windowKind: AnalysisRateLimitWindowKind,
    now: Date
  ) {
    return (
      this.state.windows.get(
        this.windowKey({
          keyKind: 'user',
          keyHash: hashedUser(userId),
          route,
          windowKind,
          windowStart: getAnalysisWindowStart(now, windowKind),
        })
      )?.count ?? 0
    );
  }

  getAdminReplayWindowCount(adminId: string, now: Date) {
    return (
      this.state.windows.get(
        this.windowKey({
          keyKind: 'user',
          keyHash: hashedAdminReplayUser(adminId),
          route: adminReplayGuardRoute,
          windowKind: 'hour',
          windowStart: getAnalysisWindowStart(now, 'hour'),
        })
      )?.count ?? 0
    );
  }

  getInFlightCount(userId: string, route: string) {
    return (
      this.state.inFlight.get(
        this.inFlightKey({
          keyKind: 'user',
          keyHash: hashedUser(userId),
          route,
        })
      )?.count ?? 0
    );
  }

  getBudgetEvents() {
    return this.state.budgetEvents.map((event) => ({ ...event }));
  }

  private createClient(state: GuardState) {
    return {
      insert: (table: unknown) => this.createInsertBuilder(state, table),
    } as unknown as AppDb;
  }

  private createInsertBuilder(state: GuardState, table: unknown) {
    let rowValues: unknown;

    return {
      values: (values: unknown) => {
        rowValues = values;
        return this.createInsertBuilderMethods(state, table, () => rowValues);
      },
    };
  }

  private createInsertBuilderMethods(
    state: GuardState,
    table: unknown,
    getRowValues: () => unknown
  ) {
    return {
      onConflictDoUpdate: () =>
        this.createInsertBuilderMethods(state, table, getRowValues),
      returning: () => this.applyInsert(state, table, getRowValues()),
    };
  }

  private applyInsert(state: GuardState, table: unknown, values: unknown) {
    if (table === analysisRateLimitWindows) {
      return this.applyWindowInsert(state, values as WindowRow);
    }

    if (table === analysisInFlightLimits) {
      return this.applyInFlightInsert(state, values as InFlightRow);
    }

    if (table === analysisModelBudgetEvents) {
      return this.applyBudgetEventInsert(state, values as BudgetEventRow);
    }

    throw new Error('Unexpected table in analysis guard test DB');
  }

  private applyWindowInsert(state: GuardState, values: WindowRow) {
    const key = this.windowKey(values);
    const current = state.windows.get(key);
    const count = (current?.count ?? 0) + values.count;

    state.windows.set(key, {
      ...values,
      count,
      createdAt: current?.createdAt ?? values.createdAt,
      updatedAt: values.updatedAt,
    });

    return Promise.resolve([{ count }]);
  }

  private applyInFlightInsert(state: GuardState, values: InFlightRow) {
    const key = this.inFlightKey(values);
    const current = state.inFlight.get(key);
    const count =
      values.count === 0
        ? Math.max(0, (current?.count ?? 0) - 1)
        : (current?.count ?? 0) + values.count;

    state.inFlight.set(key, {
      ...values,
      count,
      updatedAt: values.updatedAt,
    });

    return Promise.resolve([{ count }]);
  }

  private applyBudgetEventInsert(state: GuardState, values: BudgetEventRow) {
    state.budgetEvents.push({ ...values });

    return Promise.resolve([{ id: values.id ?? 'budget-event-1' }]);
  }

  private cloneState(state: GuardState): GuardState {
    return {
      windows: new Map(
        Array.from(state.windows.entries(), ([key, value]) => [
          key,
          {
            ...value,
            windowStart: new Date(value.windowStart),
            createdAt: new Date(value.createdAt),
            updatedAt: new Date(value.updatedAt),
          },
        ])
      ),
      inFlight: new Map(
        Array.from(state.inFlight.entries(), ([key, value]) => [
          key,
          { ...value, updatedAt: new Date(value.updatedAt) },
        ])
      ),
      budgetEvents: state.budgetEvents.map((event) => ({
        ...event,
        createdAt: new Date(event.createdAt),
      })),
    };
  }

  private windowKey(
    values: Pick<
      WindowRow,
      'keyKind' | 'keyHash' | 'route' | 'windowKind' | 'windowStart'
    >
  ) {
    return [
      values.keyKind,
      values.keyHash,
      values.route,
      values.windowKind,
      values.windowStart.toISOString(),
    ].join('|');
  }

  private inFlightKey(
    values: Pick<InFlightRow, 'keyKind' | 'keyHash' | 'route'>
  ) {
    return [values.keyKind, values.keyHash, values.route].join('|');
  }
}

async function checkMealAnalysisGuard(
  store: InMemoryAnalysisGuardDb,
  overrides: Partial<AnalysisGuardLimits> = {},
  userId = 'user-1'
) {
  return await checkAnalysisGuards({
    userId,
    ip: '203.0.113.24',
    route: analyzeMealRoute,
    db: store.client,
    limits: { ...generousLimits, ...overrides },
    now: () => fixedNow,
  });
}

async function checkReplayGuard(
  store: InMemoryAnalysisGuardDb,
  overrides?: Partial<AdminReplayGuardLimits>,
  adminId = 'admin-1'
) {
  const input = {
    adminId,
    db: store.client,
    now: () => fixedNow,
  } satisfies Parameters<typeof checkAdminReplayGuard>[0];

  return await checkAdminReplayGuard(
    overrides ? { ...input, limits: overrides } : input
  );
}

function expectAllowed(result: AnalysisGuardResult) {
  expect(result.allowed).toBe(true);
  if (!result.allowed)
    throw new Error(`Expected allowed, got ${result.reason}`);
  return result;
}

function expectAllowedMealGuard(result: AnalysisGuardResult) {
  const guard = expectAllowed(result);
  expect(guard.release).toBeTypeOf('function');
  return guard;
}

function expectBlocked(result: AnalysisGuardResult) {
  expect(result.allowed).toBe(false);
  if (result.allowed) throw new Error('Expected blocked, got allowed');

  return result;
}

function makeBudgetSource(args: {
  globalRequests?: number;
  shadowRequests?: number;
  globalTokens?: number;
  providerErrors?: number;
}): AnalysisModelBudgetSource {
  return {
    getDailyUsage: vi.fn().mockResolvedValue({
      globalRequests: args.globalRequests ?? 0,
      shadowRequests: args.shadowRequests ?? 0,
      globalTokens: args.globalTokens ?? 0,
    }),
    getProviderErrorCount: vi.fn().mockResolvedValue(args.providerErrors ?? 0),
  };
}

async function checkShadowNonessentialGuard(
  source: AnalysisModelBudgetSource,
  limits: Partial<NonessentialAnalysisGuardLimits> = {}
) {
  return await checkNonessentialAnalysisGuards({
    source,
    route: analyzeMealRoute,
    workKind: 'shadow',
    provider: 'gemini',
    now: () => fixedNow,
    limits: { ...generousNonessentialLimits, ...limits },
  });
}

describe('buildAnalysisGuardEvent', () => {
  beforeEach(() => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', hashSecret);
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('builds blocked-request telemetry without raw input or identifiers', () => {
    const input = {
      userId: '24542863-704b-4626-a28c-1a4f9c0e1335',
      ip: '203.0.113.24',
      route: '/api/analyze-meal',
      reason: 'per_user_minute',
      retryAfterSeconds: 45,
      rawMealText: 'pho bo tai chin',
    } satisfies BuildAnalysisGuardEventInput & { rawMealText: string };

    const row = buildAnalysisGuardEvent(input);

    expect(row).toEqual({
      userIdHash: hmacHex(`user:${input.userId}`),
      ipHash: hmacHex(`ip:${input.ip}`),
      route: input.route,
      reason: input.reason,
      retryAfterSeconds: input.retryAfterSeconds,
    });
    expect(row.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.ipHash).toMatch(/^[0-9a-f]{64}$/);
    expect(row.userIdHash).not.toBe(row.ipHash);
    expect(row).not.toHaveProperty('rawMealText');
    expect(row).not.toHaveProperty('rawInput');
    expect(row).not.toHaveProperty('userId');
    expect(row).not.toHaveProperty('ip');
    expect(JSON.stringify(row)).not.toContain(input.rawMealText);
    expect(JSON.stringify(row)).not.toContain(input.userId);
    expect(JSON.stringify(row)).not.toContain(input.ip);
  });

  it('uses domain-separated hashes for the same identifier value', () => {
    const sharedIdentifier = 'shared-identifier';

    const row = buildAnalysisGuardEvent({
      userId: sharedIdentifier,
      ip: sharedIdentifier,
      route: '/api/analyze-meal',
      reason: 'spam_preflight',
      retryAfterSeconds: null,
    });

    expect(row.userIdHash).toBe(hmacHex(`user:${sharedIdentifier}`));
    expect(row.ipHash).toBe(hmacHex(`ip:${sharedIdentifier}`));
    expect(row.userIdHash).not.toBe(row.ipHash);
  });

  it('keeps missing identifiers nullable', () => {
    const row = buildAnalysisGuardEvent({
      userId: null,
      ip: undefined,
      route: '/api/analyze-meal',
      reason: 'global_budget',
    });

    expect(row).toEqual({
      userIdHash: null,
      ipHash: null,
      route: '/api/analyze-meal',
      reason: 'global_budget',
      retryAfterSeconds: null,
    });
  });

  it('allows deterministic fallback hashing only during tests', () => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'test');

    const first = buildAnalysisGuardEvent({
      userId: 'test-user',
      ip: '198.51.100.10',
      route: '/api/analyze-meal',
      reason: 'provider_pressure',
    });
    const second = buildAnalysisGuardEvent({
      userId: 'test-user',
      ip: '198.51.100.10',
      route: '/api/analyze-meal',
      reason: 'provider_pressure',
    });

    expect(first).toEqual(second);
    expect(first.userIdHash).toMatch(/^[0-9a-f]{64}$/);
    expect(first.ipHash).toMatch(/^[0-9a-f]{64}$/);
  });

  it('fails closed outside tests when ANALYSIS_GUARD_HASH_SECRET is absent', () => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', '');
    vi.stubEnv('NODE_ENV', 'production');

    expect(() =>
      buildAnalysisGuardEvent({
        userId: 'user-id',
        ip: '203.0.113.10',
        route: '/api/analyze-meal',
        reason: 'per_user_hour',
      })
    ).toThrow(/ANALYSIS_GUARD_HASH_SECRET/);
  });
});

describe('checkAnalysisGuards', () => {
  beforeEach(() => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', hashSecret);
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('creates and increments counters for allowed meal analysis requests', async () => {
    const store = new InMemoryAnalysisGuardDb();

    const first = expectAllowedMealGuard(await checkMealAnalysisGuard(store));
    await first.release?.();
    const second = expectAllowedMealGuard(await checkMealAnalysisGuard(store));

    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'minute', fixedNow)
    ).toBe(2);
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'hour', fixedNow)
    ).toBe(2);
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'day', fixedNow)
    ).toBe(2);
    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(1);

    await second.release?.();
    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(0);
  });

  it('prevents concurrent allowed meal analysis requests from exceeding quota under race', async () => {
    const store = new InMemoryAnalysisGuardDb();
    const results = await Promise.all(
      Array.from({ length: 5 }, () =>
        checkMealAnalysisGuard(store, {
          perUserMinute: 2,
          perUserHour: 2,
          perUserDay: 2,
          concurrentUser: 10,
        })
      )
    );

    const allowedResults = results.filter((result) => result.allowed);
    const blockedResults = results.filter((result) => !result.allowed);

    expect(allowedResults).toHaveLength(2);
    expect(blockedResults).toHaveLength(3);
    for (const blockedResult of blockedResults) {
      const blockedGuard = expectBlocked(blockedResult);
      expect(blockedGuard.reason).toBe('per_user_minute');
    }
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'minute', fixedNow)
    ).toBe(2);
    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(2);

    for (const allowedResult of allowedResults) {
      const allowedGuard = expectAllowedMealGuard(allowedResult);
      await allowedGuard.release?.();
    }
  });

  it('blocks per-user minute quota with retry-after', async () => {
    const store = new InMemoryAnalysisGuardDb();
    expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, { perUserMinute: 1 })
    );

    const blockedGuard = expectBlocked(
      await checkMealAnalysisGuard(store, { perUserMinute: 1 })
    );

    expect(blockedGuard.status).toBe(429);
    expect(blockedGuard.reason).toBe('per_user_minute');
    expect(blockedGuard.retryAfterSeconds).toBe(
      getAnalysisWindowRetryAfterSeconds(
        fixedNow,
        getAnalysisWindowStart(fixedNow, 'minute'),
        'minute'
      )
    );
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'minute', fixedNow)
    ).toBe(1);
  });

  it('blocks per-user hour quota', async () => {
    const store = new InMemoryAnalysisGuardDb();
    expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, { perUserHour: 1 })
    );

    const blockedGuard = expectBlocked(
      await checkMealAnalysisGuard(store, { perUserHour: 1 })
    );

    expect(blockedGuard.reason).toBe('per_user_hour');
    expect(blockedGuard.retryAfterSeconds).toBe(
      getAnalysisWindowRetryAfterSeconds(
        fixedNow,
        getAnalysisWindowStart(fixedNow, 'hour'),
        'hour'
      )
    );
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'hour', fixedNow)
    ).toBe(1);
  });

  it('blocks per-user day quota', async () => {
    const store = new InMemoryAnalysisGuardDb();
    expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, { perUserDay: 1 })
    );

    const blockedGuard = expectBlocked(
      await checkMealAnalysisGuard(store, { perUserDay: 1 })
    );

    expect(blockedGuard.reason).toBe('per_user_day');
    expect(blockedGuard.retryAfterSeconds).toBe(
      getAnalysisWindowRetryAfterSeconds(
        fixedNow,
        getAnalysisWindowStart(fixedNow, 'day'),
        'day'
      )
    );
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'day', fixedNow)
    ).toBe(1);
  });

  it('blocks in-flight concurrency when a user already has a running analysis', async () => {
    const store = new InMemoryAnalysisGuardDb();
    const runningGuard = expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, {
        concurrentUser: 1,
        concurrentRetryAfterSeconds: 9,
      })
    );

    const blockedGuard = expectBlocked(
      await checkMealAnalysisGuard(store, {
        concurrentUser: 1,
        concurrentRetryAfterSeconds: 9,
      })
    );

    expect(blockedGuard.reason).toBe('concurrent_user');
    expect(blockedGuard.retryAfterSeconds).toBe(9);
    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(1);
    expect(
      store.getWindowCount('user-1', analyzeMealRoute, 'minute', fixedNow)
    ).toBe(1);

    await runningGuard.release?.();
  });

  it('decrements in-flight count exactly once per release handle', async () => {
    const store = new InMemoryAnalysisGuardDb();
    const first = expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, { concurrentUser: 2 })
    );
    const second = expectAllowedMealGuard(
      await checkMealAnalysisGuard(store, { concurrentUser: 2 })
    );

    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(2);

    await first.release?.();
    await first.release?.();

    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(1);

    await second.release?.();
  });

  it('does not let repeated release drive in-flight count below zero', async () => {
    const store = new InMemoryAnalysisGuardDb();
    const guard = expectAllowedMealGuard(await checkMealAnalysisGuard(store));

    await guard.release?.();
    await guard.release?.();
    await guard.release?.();

    expect(store.getInFlightCount('user-1', analyzeMealRoute)).toBe(0);
  });
});

describe('checkAdminReplayGuard', () => {
  beforeEach(() => {
    vi.stubEnv('ANALYSIS_GUARD_HASH_SECRET', hashSecret);
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses an admin replay route and hash domain separate from meal analysis quotas', async () => {
    const store = new InMemoryAnalysisGuardDb();

    expectAllowed(await checkReplayGuard(store));

    expect(store.getAdminReplayWindowCount('admin-1', fixedNow)).toBe(1);
    expect(
      store.getWindowCount('admin-1', analyzeMealRoute, 'hour', fixedNow)
    ).toBe(0);
    expect(store.getInFlightCount('admin-1', analyzeMealRoute)).toBe(0);
  });

  it('blocks live admin replays when the per-admin hour quota is exhausted', async () => {
    const store = new InMemoryAnalysisGuardDb();
    expectAllowed(await checkReplayGuard(store, { perAdminHour: 1 }));

    const blockedGuard = expectBlocked(
      await checkReplayGuard(store, { perAdminHour: 1 })
    );

    expect(blockedGuard.status).toBe(429);
    expect(blockedGuard.reason).toBe('admin_replay');
    expect(blockedGuard.retryAfterSeconds).toBe(
      getAnalysisWindowRetryAfterSeconds(
        fixedNow,
        getAnalysisWindowStart(fixedNow, 'hour'),
        'hour'
      )
    );
    expect(store.getAdminReplayWindowCount('admin-1', fixedNow)).toBe(1);
  });

  it('uses the admin replay environment limit when no override is provided', async () => {
    vi.stubEnv('ANALYSIS_ADMIN_REPLAY_HOUR_LIMIT', '1');
    const store = new InMemoryAnalysisGuardDb();

    expectAllowed(await checkReplayGuard(store, {}));
    const blockedGuard = expectBlocked(await checkReplayGuard(store, {}));

    expect(blockedGuard.reason).toBe('admin_replay');
  });
});

describe('model budget events', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('records only operational budget metadata', async () => {
    const store = new InMemoryAnalysisGuardDb();

    await recordAnalysisModelBudgetEvent({
      db: store.client,
      now: () => fixedNow,
      requestId: 'request-1',
      route: analyzeMealRoute,
      workKind: 'shadow',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      requestCount: 1,
      inputTokens: 120,
      outputTokens: 80,
      errorCategory: null,
      rawInput: 'phở bò tái chín',
      userId: 'user-1',
    } as Parameters<typeof recordAnalysisModelBudgetEvent>[0] & {
      rawInput: string;
      userId: string;
    });

    const [event] = store.getBudgetEvents();
    expect(event).toMatchObject({
      createdAt: fixedNow,
      requestId: 'request-1',
      route: analyzeMealRoute,
      workKind: 'shadow',
      provider: 'gemini',
      model: 'gemini-2.5-flash-lite',
      requestCount: 1,
      inputTokens: 120,
      outputTokens: 80,
      errorCategory: null,
    });
    expect(event).not.toHaveProperty('rawInput');
    expect(event).not.toHaveProperty('userId');
    expect(JSON.stringify(event)).not.toContain('phở bò tái chín');
    expect(JSON.stringify(event)).not.toContain('user-1');
  });
});

describe('checkNonessentialAnalysisGuards', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('blocks shadow work when the daily shadow quota is exhausted', async () => {
    const source = makeBudgetSource({ shadowRequests: 2 });

    const result = await checkShadowNonessentialGuard(source, {
      shadowDailyRequestLimit: 2,
    });

    expect(result).toEqual({
      allowed: false,
      reason: 'shadow_quota',
      retryAfterSeconds: getAnalysisWindowRetryAfterSeconds(
        fixedNow,
        getAnalysisWindowStart(fixedNow, 'day'),
        'day'
      ),
    });
  });

  it('blocks nonessential work when the global daily request budget is exhausted', async () => {
    const source = makeBudgetSource({ globalRequests: 10 });

    const result = await checkShadowNonessentialGuard(source, {
      globalDailyRequestLimit: 10,
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected global request budget block');
    expect(result.reason).toBe('global_budget');
  });

  it('blocks nonessential work when the global daily token budget is exhausted', async () => {
    const source = makeBudgetSource({ globalTokens: 1_000 });

    const result = await checkShadowNonessentialGuard(source, {
      globalDailyTokenLimit: 1_000,
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected global token budget block');
    expect(result.reason).toBe('global_budget');
  });

  it('blocks nonessential work when provider pressure is forced on by env', async () => {
    vi.stubEnv('ANALYSIS_PROVIDER_PRESSURE_OVERRIDE', 'on');
    const source = makeBudgetSource({});

    const result = await checkShadowNonessentialGuard(source);

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected provider pressure block');
    expect(result.reason).toBe('provider_pressure');
  });

  it('blocks nonessential work during a recent provider error window', async () => {
    const source = makeBudgetSource({ providerErrors: 5 });

    const result = await checkShadowNonessentialGuard(source, {
      providerErrorThreshold: 5,
    });

    expect(result.allowed).toBe(false);
    if (result.allowed) throw new Error('Expected provider pressure block');
    expect(result.reason).toBe('provider_pressure');
  });

  it('uses the always-on event source when tracing is disabled and pipeline_llm_calls is empty', async () => {
    vi.stubEnv('PIPELINE_TRACE_ENABLED', 'false');
    const source = makeBudgetSource({ globalRequests: 1, globalTokens: 250 });

    const result = await checkShadowNonessentialGuard(source, {
      globalDailyRequestLimit: 2,
      globalDailyTokenLimit: 500,
    });

    expect(result).toEqual({ allowed: true });
    expect(source.getDailyUsage).toHaveBeenCalledOnce();
    expect(source.getProviderErrorCount).toHaveBeenCalledOnce();
  });

  it('allows env to force provider pressure off while keeping budgets active', async () => {
    vi.stubEnv('ANALYSIS_PROVIDER_PRESSURE_OVERRIDE', 'off');
    const source = makeBudgetSource({ providerErrors: 99 });

    const result = await checkShadowNonessentialGuard(source, {
      providerErrorThreshold: 1,
    });

    expect(result).toEqual({ allowed: true });
  });
});
