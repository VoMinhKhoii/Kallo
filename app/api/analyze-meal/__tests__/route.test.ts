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

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock('@/lib/db', () => {
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
    },
  };
});

vi.mock('@/lib/db/schema', () => ({
  userProfiles: { userId: 'userId' },
  analysisGuardEvents: mockAnalysisGuardEvents,
  pendingAnalyses: mockPendingAnalyses,
  pipelineRequests: mockPipelineRequests,
}));

vi.mock('@/lib/ai/gemini', () => ({
  createGeminiClient: (...args: unknown[]) => mockCreateGeminiClient(...args),
  resolveGeminiProvider: () => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error('GEMINI_API_KEY missing');
    return { provider: 'ai-studio' as const, apiKey };
  },
}));

vi.mock('@/lib/entitlements/config', () => ({
  getBillingConfig: () => mockGetBillingConfig(),
}));

vi.mock('@/lib/entitlements/service', () => ({
  checkFeatureAccess: (...args: unknown[]) => mockCheckFeatureAccess(...args),
}));

vi.mock('@/lib/rate-limit/analysis-guards', () => ({
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

vi.mock('@/lib/ai/matching', () => ({
  logUnmatchedIngredients: () => Promise.resolve(),
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

vi.mock('@/lib/ai/mappers', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/ai/mappers')>();

  return {
    ...actual,
    buildUserContext: (...args: unknown[]) => mockBuildUserContext(...args),
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
});
