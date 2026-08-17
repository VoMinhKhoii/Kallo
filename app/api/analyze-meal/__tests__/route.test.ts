import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent } from '@/lib/ai/streaming/types';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockAnalyzeMeal = vi.fn();
const mockBuildUserContext = vi.fn();
const mockInsert = vi.fn();
const mockCreateGeminiClient = vi.fn((..._args: unknown[]) => ({}));
const mockCheckAnalysisGuards = vi.fn();
const mockCheckFeatureAccess = vi.fn();
const mockGetBillingConfig = vi.fn();
const mockLogPipelineStart = vi.fn();
const mockLogPipelineEnd = vi.fn();
const mockDbInsert = vi.fn();
const mockDbInsertValues = vi.fn();
const mockInsertValues = vi.fn();
const mockOnConflict = vi.fn();
const mockLogUnmatchedIngredients = vi.fn((..._args: unknown[]) =>
  Promise.resolve()
);
const mockEstimateCheatMeal = vi.fn();
const mockResolveRelogSources = vi.fn();
const mockMergeRelogIntoPipelineResult = vi.fn();
const mockAnalysisGuardEvents = { table: 'analysis_guard_events' };
const mockPendingAnalyses = {
  table: 'pending_analyses',
  id: 'id',
  userId: 'user_id',
  attemptId: 'attempt_id',
  loggedAt: 'loggedAt',
  expiresAt: 'expires_at',
};
const mockPipelineRequests = { table: 'pipeline_requests', id: 'id' };

interface MockBuildAnalysisGuardEventInput {
  userId?: string | null;
  ip?: string | null;
  route: string;
  reason: string;
  retryAfterSeconds?: number | null;
}

const mockBuildAnalysisGuardEvent = vi.fn(
  (input: MockBuildAnalysisGuardEventInput) => ({
    userIdHash: input.userId ? `hashed-user:${input.userId}` : null,
    ipHash: input.ip ? `hashed-ip:${input.ip}` : null,
    route: input.route,
    reason: input.reason,
    retryAfterSeconds: input.retryAfterSeconds ?? null,
  })
);

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock('@/lib/infra/db/client', () => {
  const selectChain = {
    select: () => selectChain,
    from: () => selectChain,
    where: () => selectChain,
    limit: () => mockSelect(),
  };
  const insertChain = {
    insert: (table?: unknown) => {
      mockDbInsert(table);
      return insertChain;
    },
    values: (values?: unknown) => {
      mockDbInsertValues(values);
      mockInsertValues(values);
      return insertChain;
    },
    onConflictDoUpdate: (arg?: unknown) => {
      mockOnConflict(arg); // pending_analyses attempt-id upsert
      return insertChain;
    },
    returning: () => mockInsert(),
    catch: () => undefined, // fire-and-forget path (pipelineRequests)
  };
  const updateChain = {
    update: () => updateChain,
    set: () => updateChain,
    where: () => Promise.resolve(),
    catch: () => Promise.resolve(),
  };
  return {
    db: {
      ...selectChain,
      insert: (table?: unknown) => {
        mockDbInsert(table);
        return insertChain;
      },
      update: () => updateChain,
      transaction: (fn: (tx: unknown) => unknown) => fn('tx'),
    },
  };
});

vi.mock('@/lib/infra/db/schema', () => ({
  userProfiles: { userId: 'userId' },
  analysisGuardEvents: mockAnalysisGuardEvents,
  pendingAnalyses: mockPendingAnalyses,
  pipelineRequests: mockPipelineRequests,
}));

vi.mock('@/lib/ai/provider/provider', () => ({
  createGeminiClient: (...args: unknown[]) => mockCreateGeminiClient(...args),
  resolveGeminiProvider: () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    return { provider: 'ai-studio' as const, apiKey };
  },
}));

vi.mock('@/lib/domain/billing/entitlement/config', () => ({
  getBillingConfig: () => mockGetBillingConfig(),
}));

vi.mock('@/lib/domain/billing/entitlement/service', () => ({
  checkFeatureAccess: (...args: unknown[]) => mockCheckFeatureAccess(...args),
}));

vi.mock('@/lib/infra/rate-limit/analysis-guards', () => ({
  buildAnalysisGuardEvent: (input: MockBuildAnalysisGuardEventInput) =>
    mockBuildAnalysisGuardEvent(input),
  checkAnalysisGuards: (...args: unknown[]) => mockCheckAnalysisGuards(...args),
}));

vi.mock('@/lib/ai/pipeline/telemetry/logging', () => ({
  logPipelineStart: (...args: unknown[]) => mockLogPipelineStart(...args),
  logPipelineEnd: (...args: unknown[]) => mockLogPipelineEnd(...args),
}));

vi.mock('@/lib/ai/pipeline/analyze-meal', () => ({
  analyzeMeal: (...args: unknown[]) => mockAnalyzeMeal(...args),
}));

vi.mock('@/lib/ai/matching/unmatched-log', () => ({
  logUnmatchedIngredients: (...args: unknown[]) =>
    mockLogUnmatchedIngredients(...args),
}));

vi.mock('@/lib/domain/cheat/estimate', () => ({
  estimateCheatMeal: (...args: unknown[]) => mockEstimateCheatMeal(...args),
}));

vi.mock('@/lib/actions/meals/relog/resolve-sources', () => ({
  resolveRelogSources: (...args: unknown[]) => mockResolveRelogSources(...args),
}));

vi.mock('@/lib/domain/logging/relog/build-relog-pipeline-result', () => ({
  buildFrozenMealItem: (dish: { name: string }) => ({ frozen: dish.name }),
  mergeRelogIntoPipelineResult: (...args: unknown[]) =>
    mockMergeRelogIntoPipelineResult(...args),
}));

interface MockNutrition {
  caloriesKcal?: number;
  proteinG?: number;
  carbohydrateG?: number;
  fatG?: number;
}

interface MockMealItem {
  name: string;
  displayedNutrition?: MockNutrition;
}

interface MockPipelineData {
  mealItems?: MockMealItem[];
  displayedNutrition?: MockNutrition;
}

vi.mock('@/lib/ai/adapters/user-context', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/ai/adapters/user-context')>();

  return {
    ...actual,
    buildUserContext: (...args: unknown[]) => mockBuildUserContext(...args),
  };
});

vi.mock('@/lib/ai/adapters/parsed-meal', async (importOriginal) => {
  const actual =
    await importOriginal<typeof import('@/lib/ai/adapters/parsed-meal')>();

  return {
    ...actual,
    toParsedMeal: (data: MockPipelineData) => ({
      mealName: data.mealItems?.[0]?.name ?? 'Meal',
      items: (data.mealItems ?? []).map((mi: MockMealItem) => ({
        name: mi.name,
        macros: {
          calories: mi.displayedNutrition?.caloriesKcal ?? 0,
          protein: mi.displayedNutrition?.proteinG ?? 0,
          carbs: mi.displayedNutrition?.carbohydrateG ?? 0,
          fat: mi.displayedNutrition?.fatG ?? 0,
        },
      })),
      totalMacros: {
        calories: data.displayedNutrition?.caloriesKcal ?? 0,
        protein: data.displayedNutrition?.proteinG ?? 0,
        carbs: data.displayedNutrition?.carbohydrateG ?? 0,
        fat: data.displayedNutrition?.fatG ?? 0,
      },
    }),
  };
});

const { POST } = await import('@/app/api/analyze-meal/route');

function createRequest(
  body: unknown,
  headers: Record<string, string> = {},
  signal?: AbortSignal
): NextRequest {
  return new Request('http://localhost/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  }) as unknown as NextRequest;
}

const TEST_ATTEMPT_ID = '11111111-1111-4111-8111-111111111111';
function mealRequestBody(message: string) {
  return {
    message,
    loggedDate: '2026-04-06',
    timezoneOffset: -420,
    attemptId: TEST_ATTEMPT_ID,
  };
}

/** Read all SSE events from a streaming Response */
async function readSSEEvents(res: Response): Promise<StreamEvent[]> {
  const text = await res.text();
  const buffer = { current: '' };
  const events = parseSSEChunk(text, buffer);
  // Flush any remaining buffered content
  if (buffer.current.trim()) {
    events.push(...parseSSEChunk('\n\n', buffer));
  }
  return events;
}

const mockProfile = {
  goal: 'cutting',
  aggression: '0.5',
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  oilUsage: 'normal',
  defaultRicePortion: 'medium',
  sugarBraised: 'medium',
  defaultProteinPortion: 'medium',
  brothConsumption: 'some',
  preferredLocale: 'en',
  createdAt: new Date('2026-01-01T00:00:00Z'),
};

const mockPipelineData = {
  mealItems: [
    {
      name: 'Phở bò',
      ingredients: [
        {
          ingredientName: 'Bánh phở',
          estimatedGrams: 200,
          cookingMethod: null,
          userFacingUnit: '1 tô',
          matchConfidence: 0.8,
          boundedNutrition: {},
          displayedNutrition: {
            caloriesKcal: 300,
            proteinG: 10,
            carbohydrateG: 50,
            fatG: 5,
          },
        },
      ],
      boundedNutrition: {},
      displayedNutrition: {
        caloriesKcal: 300,
        proteinG: 10,
        carbohydrateG: 50,
        fatG: 5,
      },
    },
  ],
  mealSlot: 'breakfast',
  confidenceOverall: 'high',
  boundedNutrition: {},
  displayedNutrition: {
    caloriesKcal: 300,
    proteinG: 10,
    carbohydrateG: 50,
    fatG: 5,
  },
  unmatchedIngredients: [],
};

describe('POST /api/analyze-meal', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSelect.mockResolvedValue([mockProfile]);
    mockAnalyzeMeal.mockReset();
    mockBuildUserContext.mockReset();
    mockBuildUserContext.mockImplementation((profile) => ({
      goal: 'maintaining',
      aggression: 0,
      countryOfOrigin: profile.countryOfOrigin,
      countryOfResidence: profile.countryOfResidence,
      cookingHabits: {
        oilUsage: profile.oilUsage,
        defaultRicePortion: profile.defaultRicePortion,
        sugarBraised: profile.sugarBraised,
        defaultProteinPortion: profile.defaultProteinPortion,
        brothConsumption: profile.brothConsumption,
      },
    }));
    mockCreateGeminiClient.mockReset();
    mockCreateGeminiClient.mockReturnValue({});
    mockCheckAnalysisGuards.mockReset();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true });
    // Enforcement OFF by default — existing tests must see no gating call.
    mockGetBillingConfig.mockReset();
    mockGetBillingConfig.mockReturnValue({
      launchDate: null,
      trialDays: 7,
      enforcementEnabled: false,
    });
    mockCheckFeatureAccess.mockReset();
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });
    mockBuildAnalysisGuardEvent.mockClear();
    mockLogPipelineStart.mockReset();
    mockLogPipelineStart.mockResolvedValue('request-123');
    mockLogPipelineEnd.mockClear();
    mockDbInsert.mockClear();
    mockDbInsertValues.mockClear();
    mockInsert.mockResolvedValue([{ id: 'analysis-123' }]);
    mockInsertValues.mockClear();
    mockOnConflict.mockClear();
    mockLogUnmatchedIngredients.mockClear();
    mockEstimateCheatMeal.mockReset();
    mockResolveRelogSources.mockReset();
    mockMergeRelogIntoPipelineResult.mockReset();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  // Pre-stream validation tests — these return JSON before SSE starts
  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(
      createRequest({ loggedDate: '2026-04-06', timezoneOffset: -420 })
    );
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 400 when locale is unsupported', async () => {
    const res = await POST(createRequest({ message: 'phở bò', locale: 'fr' }));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
  });

  it('returns 404 when profile row is missing', async () => {
    mockSelect.mockResolvedValue([]);
    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
  });

  it('returns JSON 429 before SSE when analysis guards block', async () => {
    const rawMealText = 'Phở bò tái';
    const retryAfterSeconds = 45;

    mockCheckAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'per_user_minute',
      retryAfterSeconds,
    });

    const res = await POST(
      createRequest(mealRequestBody(rawMealText), {
        'x-forwarded-for': '203.0.113.24, 10.0.0.7',
      })
    );

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe(String(retryAfterSeconds));
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Type')).not.toContain('text/event-stream');

    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');

    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
    expect(mockLogPipelineStart).not.toHaveBeenCalled();
    expect(mockDbInsert).toHaveBeenCalledWith(mockAnalysisGuardEvents);
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPipelineRequests);

    const guardContext = mockCheckAnalysisGuards.mock.calls[0]?.[0] as {
      db?: unknown;
      [key: string]: unknown;
    };
    const { db: _db, ...guardContextWithoutDb } = guardContext;
    expect(guardContextWithoutDb).toEqual({
      userId: 'user-1',
      ip: '203.0.113.24',
      route: '/api/analyze-meal',
    });
    expect(guardContextWithoutDb).not.toHaveProperty('message');
    expect(guardContextWithoutDb).not.toHaveProperty('rawInput');
    expect(JSON.stringify(guardContextWithoutDb)).not.toContain(rawMealText);

    expect(mockBuildAnalysisGuardEvent).toHaveBeenCalledTimes(1);
    const guardEventInput = mockBuildAnalysisGuardEvent.mock.calls[0]?.[0];
    expect(guardEventInput).toEqual({
      userId: 'user-1',
      ip: '203.0.113.24',
      route: '/api/analyze-meal',
      reason: 'per_user_minute',
      retryAfterSeconds,
    });
    expect(guardEventInput).not.toHaveProperty('rawMealText');
    expect(guardEventInput).not.toHaveProperty('message');
    expect(guardEventInput).not.toHaveProperty('rawInput');
    expect(JSON.stringify(guardEventInput)).not.toContain(rawMealText);

    const insertedGuardEvent = mockDbInsertValues.mock.calls[0]?.[0];
    expect(insertedGuardEvent).toEqual({
      userIdHash: 'hashed-user:user-1',
      ipHash: 'hashed-ip:203.0.113.24',
      route: '/api/analyze-meal',
      reason: 'per_user_minute',
      retryAfterSeconds,
    });
    expect(insertedGuardEvent).not.toHaveProperty('rawMealText');
    expect(insertedGuardEvent).not.toHaveProperty('message');
    expect(insertedGuardEvent).not.toHaveProperty('rawInput');
    expect(JSON.stringify(insertedGuardEvent)).not.toContain(rawMealText);
  });

  it('still returns JSON 429 when blocked-request telemetry fails', async () => {
    const retryAfterSeconds = 30;
    const consoleErrorSpy = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    mockCheckAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'provider_pressure',
      retryAfterSeconds,
    });
    mockDbInsertValues.mockImplementationOnce(() => {
      throw new Error('telemetry failed');
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const json = await res.json();
    expect(json.error.code).toBe('RATE_LIMITED');
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
    expect(mockLogPipelineStart).not.toHaveBeenCalled();
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[analyze-meal] Failed to log analysis guard event:',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });

  it('skips analysis_guard_events insert when ANALYSIS_GUARD_EVENT_LOGGING_ENABLED=false', async () => {
    vi.stubEnv('ANALYSIS_GUARD_EVENT_LOGGING_ENABLED', 'false');
    mockCheckAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'per_user_minute',
      retryAfterSeconds: 30,
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('30');

    expect(mockBuildAnalysisGuardEvent).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockAnalysisGuardEvents);

    vi.unstubAllEnvs();
  });

  it('releases an allowed guard exactly once on pipeline success', async () => {
    const release = vi.fn();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true, release });
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    await res.text();

    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases an allowed guard exactly once when the pipeline throws inside the stream', async () => {
    const release = vi.fn();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true, release });
    mockAnalyzeMeal.mockRejectedValue(new Error('mid-stream failure'));

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const events = await readSSEEvents(res);

    // The route catches the throw and emits an error event rather than
    // failing the stream — assert that and that the guard still released.
    expect(events.some((e) => e.type === 'error')).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  it('releases an allowed guard when pipeline logging fails before SSE starts', async () => {
    const release = vi.fn();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true, release });
    mockLogPipelineStart.mockRejectedValue(new Error('log start failed'));

    await expect(
      POST(createRequest(mealRequestBody('phở bò')))
    ).rejects.toThrow('log start failed');

    expect(release).toHaveBeenCalledTimes(1);
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
  });

  it('awaits an abort-started guard release during stream cleanup', async () => {
    const abortController = new AbortController();
    let resolveRelease!: () => void;
    let notifyReleaseStarted!: () => void;
    const releaseStarted = new Promise<void>((resolve) => {
      notifyReleaseStarted = resolve;
    });
    const releaseFinished = new Promise<void>((resolve) => {
      resolveRelease = resolve;
    });
    const release = vi.fn(() => {
      notifyReleaseStarted();
      return releaseFinished;
    });
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true, release });
    mockAnalyzeMeal.mockImplementation(async () => {
      abortController.abort();
      return { success: true, data: mockPipelineData };
    });

    const res = await POST(
      createRequest(mealRequestBody('phở bò'), {}, abortController.signal)
    );
    let streamCompleted = false;
    const readPromise = res.text().then(() => {
      streamCompleted = true;
    });

    await releaseStarted;
    await Promise.resolve();

    expect(release).toHaveBeenCalledTimes(1);
    expect(streamCompleted).toBe(false);

    resolveRelease();
    await readPromise;

    expect(streamCompleted).toBe(true);
    expect(release).toHaveBeenCalledTimes(1);
  });

  // Entitlement enforcement (Phase E)
  it('does not call the gating check when enforcement is off', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    await res.text();

    expect(res.status).toBe(200);
    expect(mockCheckFeatureAccess).not.toHaveBeenCalled();
  });

  it('passes through when enforcement is on and the trial is active', async () => {
    mockGetBillingConfig.mockReturnValue({
      launchDate: null,
      trialDays: 7,
      enforcementEnabled: true,
    });
    mockCheckFeatureAccess.mockResolvedValue({ allowed: true });
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(200);

    const events = await readSSEEvents(res);
    expect(events.map((e) => e.type)).toContain('analysis_complete');

    expect(mockCheckFeatureAccess).toHaveBeenCalledWith(
      { userId: 'user-1', profileCreatedAt: mockProfile.createdAt },
      'ai_analysis'
    );
  });

  it('returns 402 with the feature_locked body when blocked', async () => {
    mockGetBillingConfig.mockReturnValue({
      launchDate: new Date('2026-01-01T00:00:00Z'),
      trialDays: 7,
      enforcementEnabled: true,
    });
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'trial_expired',
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));

    expect(res.status).toBe(402);
    expect(res.headers.get('Content-Type')).toContain('application/json');
    expect(res.headers.get('Content-Type')).not.toContain('text/event-stream');

    const json = await res.json();
    expect(json.error.code).toBe('feature_locked');
    expect(json.error.status).toBe(402);
    expect(json.error.retryable).toBe(false);
    expect(json.error.feature).toBe('ai_analysis');
    expect(json.error.reason).toBe('trial_expired');
    expect(typeof json.error.message).toBe('string');
    expect(json.error.message.length).toBeGreaterThan(0);

    // Blocked BEFORE the pipeline / any streaming starts.
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
    expect(mockLogPipelineStart).not.toHaveBeenCalled();
  });

  it('checks entitlement BEFORE the rate-limit guards', async () => {
    mockGetBillingConfig.mockReturnValue({
      launchDate: new Date('2026-01-01T00:00:00Z'),
      trialDays: 7,
      enforcementEnabled: true,
    });
    mockCheckFeatureAccess.mockResolvedValue({
      allowed: false,
      reason: 'not_entitled',
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(402);

    const json = await res.json();
    expect(json.error.reason).toBe('not_entitled');

    // The guard check must never run for a locked-out user — they don't
    // consume a rate-limit slot.
    expect(mockCheckAnalysisGuards).not.toHaveBeenCalled();
  });

  // SSE streaming tests — these return 200 with event stream
  it('streams result and analysis_complete on pipeline success', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest(mealRequestBody('Phở bò tái')));
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('text/event-stream');

    const events = await readSSEEvents(res);
    const types = events.map((e) => e.type);

    expect(types).toContain('result');
    expect(types).toContain('analysis_complete');

    // Terminal event is last
    const last = events[events.length - 1];
    expect(last.type).toBe('analysis_complete');
    if (last.type === 'analysis_complete') {
      expect(last.analysisId).toBe('analysis-123');
    }

    // Result contains meal data
    const resultEvent = events.find((e) => e.type === 'result');
    if (resultEvent?.type === 'result') {
      expect(resultEvent.data.mealName).toBe('Phở bò');
    }

    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        rawInput: 'Phở bò tái',
        loggedAt: expect.any(Date),
        attemptId: TEST_ATTEMPT_ID,
      })
    );
    // Upserts on (user_id, attempt_id) and refreshes expiresAt so a re-analysis
    // of the same attempt supersedes its staging row instead of orphaning it.
    expect(mockOnConflict).toHaveBeenCalledWith(
      expect.objectContaining({
        target: [mockPendingAnalyses.userId, mockPendingAnalyses.attemptId],
        set: expect.objectContaining({
          expiresAt: expect.anything(),
          rawInput: 'Phở bò tái',
        }),
      })
    );
  });

  it('passes request locale as fallback for mixed-language meal input', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(
      createRequest({
        ...mealRequestBody('pho bo with extra beef'),
        locale: 'vi',
      })
    );
    await res.text();

    const userContext = mockAnalyzeMeal.mock.calls[0]?.[1];
    expect(userContext).toMatchObject({
      inputLanguage: 'mixed',
      outputLanguage: 'vi',
    });
  });

  it('uses profile locale fallback when request locale is omitted', async () => {
    mockSelect.mockResolvedValue([{ ...mockProfile, preferredLocale: 'vi' }]);
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(
      createRequest(mealRequestBody('pho bo with extra beef'))
    );
    await res.text();

    const userContext = mockAnalyzeMeal.mock.calls[0]?.[1];
    expect(userContext).toMatchObject({
      inputLanguage: 'mixed',
      outputLanguage: 'vi',
    });
  });

  it('keeps clear English input in English despite Vietnamese profile locale', async () => {
    mockSelect.mockResolvedValue([{ ...mockProfile, preferredLocale: 'vi' }]);
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(
      createRequest(mealRequestBody('grilled chicken with rice'))
    );
    await res.text();

    const userContext = mockAnalyzeMeal.mock.calls[0]?.[1];
    expect(userContext).toMatchObject({
      inputLanguage: 'en',
      outputLanguage: 'en',
    });
  });

  it('streams error event when pipeline returns failure', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: false,
      error: {
        type: 'non_food_input',
        message: 'Not a food',
        retryable: false,
      },
    });

    const res = await POST(createRequest(mealRequestBody('hello world')));
    expect(res.status).toBe(200);

    const events = await readSSEEvents(res);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('non_food_input');
      expect(errorEvent.message).toBe('Not a food');
    }
  });

  it('emits a retryable timeout error (not a hang) when the pendingAnalyses insert stalls', async () => {
    vi.useFakeTimers();
    try {
      mockAnalyzeMeal.mockResolvedValue({
        success: true,
        data: mockPipelineData,
      });
      // The insert never settles — simulates a starved DB pool. Without the
      // deadline this would leave the SSE stream open forever (the reported
      // "Putting it all together…" hang).
      mockInsert.mockReturnValue(new Promise(() => {}));

      const res = await POST(createRequest(mealRequestBody('phở bò')));
      const textPromise = res.text();

      // Advance past PERSIST_DEADLINE_MS (15s) so withDeadline fires.
      await vi.advanceTimersByTimeAsync(15_000);

      const text = await textPromise;
      const buffer = { current: '' };
      const events = parseSSEChunk(text, buffer);

      const errorEvent = events.find((e) => e.type === 'error');
      expect(errorEvent).toBeDefined();
      if (errorEvent?.type === 'error') {
        expect(errorEvent.code).toBe('pipeline_timeout');
        expect(errorEvent.retryable).toBe(true);
      }
      // Never reaches the terminal success event — the stream still closes.
      expect(events.some((e) => e.type === 'analysis_complete')).toBe(false);
    } finally {
      vi.useRealTimers();
    }
  });

  it('streams error event on unexpected exceptions', async () => {
    mockAnalyzeMeal.mockRejectedValue(new Error('unexpected'));

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    expect(res.status).toBe(200);

    const events = await readSSEEvents(res);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('internal');
      expect(errorEvent.message).toBe('Failed to process meal');
    }
  });

  // -------------------------------------------------------------------------
  // Abort handling — every stage checks `request.signal.aborted` and returns
  // silently rather than emitting into a stream nobody is reading.
  // -------------------------------------------------------------------------

  it('emits nothing and never builds a client when aborted before the pipeline', async () => {
    const abortController = new AbortController();
    abortController.abort();

    const res = await POST(
      createRequest(mealRequestBody('phở bò'), {}, abortController.signal)
    );
    const events = await readSSEEvents(res);

    expect(events).toEqual([]);
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
    expect(mockAnalyzeMeal).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
  });

  it('emits nothing and stages nothing when aborted during the pipeline', async () => {
    const abortController = new AbortController();
    mockAnalyzeMeal.mockImplementation(async () => {
      abortController.abort();
      return { success: true, data: mockPipelineData };
    });

    const res = await POST(
      createRequest(mealRequestBody('phở bò'), {}, abortController.signal)
    );
    const events = await readSSEEvents(res);

    expect(events).toEqual([]);
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
    expect(mockLogPipelineEnd).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Cheat-meal branch — a slider spec instead of the decomposition pipeline.
  // -------------------------------------------------------------------------

  function cheatRequestBody(message: string) {
    return { ...mealRequestBody(message), mode: 'cheat' as const };
  }

  it('surfaces a clarifying question without staging anything', async () => {
    const spec = { clarifyingQuestion: 'Bao nhiêu ly bia?', sliders: [] };
    mockEstimateCheatMeal.mockResolvedValue(spec);

    const res = await POST(createRequest(cheatRequestBody('nhậu tối qua')));
    const events = await readSSEEvents(res);

    expect(events).toEqual([{ type: 'cheat_estimate', spec }]);
    expect(mockAnalyzeMeal).not.toHaveBeenCalled();
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
    expect(mockLogPipelineEnd).toHaveBeenCalledWith(
      'request-123',
      'success',
      expect.any(Number),
      expect.anything(),
      undefined,
      null
    );
  });

  it('stages the cheat spec BEFORE surfacing it, then terminates', async () => {
    const spec = { sliders: [{ id: 'beer' }] };
    mockEstimateCheatMeal.mockResolvedValue(spec);
    mockInsert.mockResolvedValue([{ id: 'cheat-analysis-1' }]);

    const res = await POST(createRequest(cheatRequestBody('nhậu tối qua')));
    const events = await readSSEEvents(res);

    expect(events).toEqual([
      { type: 'cheat_estimate', spec },
      { type: 'analysis_complete', analysisId: 'cheat-analysis-1' },
    ]);
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        entryMode: 'cheat',
        rawInput: 'nhậu tối qua',
        pipelineResult: { entryMode: 'cheat', spec },
        attemptId: TEST_ATTEMPT_ID,
      })
    );
  });

  it('passes the cheat chips and intensity through to the estimator', async () => {
    mockEstimateCheatMeal.mockResolvedValue({ sliders: [] });

    const res = await POST(
      createRequest({
        ...cheatRequestBody('nhậu tối qua'),
        cheatType: 'bia',
        clarifyAnswer: 'ba ly',
        cheatIntensity: 'heavy',
      })
    );
    await res.text();

    expect(mockEstimateCheatMeal).toHaveBeenCalledWith(
      expect.objectContaining({
        description: 'nhậu tối qua',
        cheatType: 'bia',
        clarifyAnswer: 'ba ly',
        cheatIntensity: 'heavy',
      }),
      expect.anything(),
      expect.any(Function)
    );
  });

  it('emits nothing when the cheat estimate lands after an abort', async () => {
    const abortController = new AbortController();
    mockEstimateCheatMeal.mockImplementation(async () => {
      abortController.abort();
      return { sliders: [] };
    });

    const res = await POST(
      createRequest(cheatRequestBody('nhậu'), {}, abortController.signal)
    );

    expect(await readSSEEvents(res)).toEqual([]);
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
  });

  it('rejects cheat mode combined with relog picks before streaming', async () => {
    const res = await POST(
      createRequest({
        ...cheatRequestBody('nhậu'),
        refs: [
          {
            kind: 'dish',
            sourceMealId: '22222222-2222-4222-8222-222222222222',
            mealItemOrder: 0,
          },
        ],
      })
    );

    expect(res.status).toBe(400);
    expect((await res.json()).error.code).toBe('VALIDATION_FAILED');
  });

  // -------------------------------------------------------------------------
  // Completeness gate — runs BEFORE the empty-nutrition check, per ingredient.
  // -------------------------------------------------------------------------

  it('terminates on a chunk failure with a generic try-again message', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
      unresolved: { reason: 'chunk_failure' },
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const events = await readSSEEvents(res);

    expect(events).toEqual([
      {
        type: 'error',
        code: 'partial_analysis_failure',
        message:
          'Part of your meal could not be analyzed just now. Please try again.',
        retryable: true,
      },
    ]);
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
    expect(mockLogPipelineEnd).toHaveBeenCalledWith(
      'request-123',
      'error',
      expect.any(Number),
      expect.anything(),
      'chunk_failure',
      null
    );
    // A chunk failure is an infra signal, never a coverage signal.
    expect(mockLogUnmatchedIngredients).not.toHaveBeenCalled();
  });

  it('names the food and logs coverage on a no_macro_data carve-out', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
      unresolved: {
        reason: 'no_macro_data',
        ingredientName: 'Mì gói',
        carvedOutNames: ['Mì gói'],
      },
    });

    const res = await POST(createRequest(mealRequestBody('mì gói')));
    const events = await readSSEEvents(res);

    expect(events).toEqual([
      {
        type: 'error',
        code: 'partial_analysis_failure',
        message:
          'Could not work out the nutrition for "Mì gói". Please try describing that part differently.',
        retryable: true,
      },
    ]);
    expect(mockLogPipelineEnd).toHaveBeenCalledWith(
      'request-123',
      'error',
      expect.any(Number),
      expect.anything(),
      'no_macro_data',
      null
    );
    expect(mockLogUnmatchedIngredients).toHaveBeenCalledWith(
      [{ ingredientName: 'Mì gói', mealContext: 'no_macro_data carve-out' }],
      null,
      expect.anything()
    );
  });

  it('falls back to an unnamed carve-out message', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
      unresolved: { reason: 'no_macro_data', carvedOutNames: [] },
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const events = await readSSEEvents(res);

    expect(events[0]).toMatchObject({
      code: 'partial_analysis_failure',
      message:
        'Could not work out the nutrition for part of this meal. Please try describing it differently.',
    });
    expect(mockLogUnmatchedIngredients).not.toHaveBeenCalled();
  });

  // -------------------------------------------------------------------------
  // Empty-nutrition gate and success-path bookkeeping.
  // -------------------------------------------------------------------------

  it('emits empty_nutrition when every item has zero calories and protein', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: {
        ...mockPipelineData,
        mealItems: [
          {
            name: 'Nước lọc',
            displayedNutrition: {
              caloriesKcal: 0,
              proteinG: 0,
              carbohydrateG: 0,
              fatG: 0,
            },
          },
        ],
      },
    });

    const res = await POST(createRequest(mealRequestBody('nước lọc')));
    const events = await readSSEEvents(res);

    expect(events).toEqual([
      {
        type: 'error',
        code: 'empty_nutrition',
        message:
          'Could not estimate nutrition for this meal. Please try describing it differently.',
        retryable: true,
      },
    ]);
    expect(mockDbInsert).not.toHaveBeenCalledWith(mockPendingAnalyses);
  });

  it('logs unmatched ingredients after the terminal success event', async () => {
    const unmatched = [{ ingredientName: 'rau đắng', mealContext: 'canh' }];
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: { ...mockPipelineData, unmatchedIngredients: unmatched },
    });

    const res = await POST(createRequest(mealRequestBody('canh rau đắng')));
    await res.text();

    expect(mockLogUnmatchedIngredients).toHaveBeenCalledWith(
      unmatched,
      null,
      expect.anything()
    );
  });

  it('reports the prompt versions the pipeline recorded', async () => {
    mockAnalyzeMeal.mockImplementation(
      async (
        _msg: unknown,
        _ctx: unknown,
        _db: unknown,
        _gemini: unknown,
        _emit: unknown,
        trace: { promptVersionsUsed: Map<string, string> }
      ) => {
        trace.promptVersionsUsed.set('decomposition', 'v2');
        return { success: true, data: mockPipelineData };
      }
    );

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    await res.text();

    expect(mockLogPipelineEnd).toHaveBeenCalledWith(
      'request-123',
      'success',
      expect.any(Number),
      expect.anything(),
      undefined,
      { decomposition: 'v2' }
    );
  });

  it('never surfaces a meal it could not stage', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });
    mockInsert.mockRejectedValue(new Error('insert exploded'));

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    const events = await readSSEEvents(res);

    expect(events.map((e) => e.type)).toEqual(['error']);
    expect(events[0]).toMatchObject({ code: 'internal', retryable: true });
  });

  // -------------------------------------------------------------------------
  // Combined relog — picks folded in AFTER the pipeline ran on free text alone.
  // -------------------------------------------------------------------------

  const RELOG_REF = {
    kind: 'dish' as const,
    sourceMealId: '33333333-3333-4333-8333-333333333333',
    mealItemOrder: 2,
  };

  it('merges relog picks into the staged result and the saved raw input', async () => {
    mockAnalyzeMeal.mockImplementation(async () => ({
      success: true,
      data: { ...mockPipelineData },
    }));
    mockResolveRelogSources.mockResolvedValue({
      dishes: [{ name: 'Cơm tấm' }, { name: 'Chè' }],
      sourceConfidences: ['high', 'medium'],
    });
    mockMergeRelogIntoPipelineResult.mockImplementation(
      (aiResult: object, items: unknown, confidence: string) => ({
        ...aiResult,
        merged: { items, confidence },
      })
    );

    const res = await POST(
      createRequest({ ...mealRequestBody('phở bò'), refs: [RELOG_REF] })
    );
    await res.text();

    // The picks never entered the AI call.
    expect(mockAnalyzeMeal.mock.calls[0]?.[0]).toBe('phở bò');
    expect(mockResolveRelogSources).toHaveBeenCalledWith(
      'tx',
      'user-1',
      [RELOG_REF],
      { lock: true }
    );
    expect(mockMergeRelogIntoPipelineResult).toHaveBeenCalledWith(
      expect.objectContaining({ mealSlot: 'breakfast' }),
      [{ frozen: 'Cơm tấm' }, { frozen: 'Chè' }],
      'medium'
    );
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        rawInput: 'phở bò, Cơm tấm, Chè',
        entryMode: 'precise',
        pipelineResult: expect.objectContaining({
          merged: expect.anything(),
        }),
      })
    );
  });

  it('downgrades an unrecognized relog confidence to low', async () => {
    mockAnalyzeMeal.mockImplementation(async () => ({
      success: true,
      data: { ...mockPipelineData },
    }));
    mockResolveRelogSources.mockResolvedValue({
      dishes: [{ name: 'Cơm tấm' }],
      sourceConfidences: [null],
    });
    mockMergeRelogIntoPipelineResult.mockImplementation(
      (aiResult: object) => aiResult
    );

    const res = await POST(
      createRequest({ ...mealRequestBody('phở bò'), refs: [RELOG_REF] })
    );
    await res.text();

    expect(mockMergeRelogIntoPipelineResult.mock.calls[0]?.[2]).toBe('low');
  });

  it('leaves the raw input alone when there are no picks', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest(mealRequestBody('phở bò')));
    await res.text();

    expect(mockResolveRelogSources).not.toHaveBeenCalled();
    expect(mockInsertValues).toHaveBeenCalledWith(
      expect.objectContaining({ rawInput: 'phở bò' })
    );
  });
});
