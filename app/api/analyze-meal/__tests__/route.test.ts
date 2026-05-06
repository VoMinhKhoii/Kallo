import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent } from '@/lib/ai/streaming/types';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockAnalyzeMeal = vi.fn();
const mockInsert = vi.fn();
const mockCreateGeminiClient = vi.fn(() => ({}));
const mockCheckAnalysisGuards = vi.fn();
const mockLogPipelineStart = vi.fn();
const mockLogPipelineEnd = vi.fn();
const mockDbInsert = vi.fn();
const mockDbInsertValues = vi.fn();
const mockAnalysisGuardEvents = { table: 'analysis_guard_events' };
const mockPendingAnalyses = { table: 'pending_analyses', id: 'id' };
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
}));

vi.mock('@/lib/rate-limit/analysis-guards', () => ({
  buildAnalysisGuardEvent: (input: MockBuildAnalysisGuardEventInput) =>
    mockBuildAnalysisGuardEvent(input),
  checkAnalysisGuards: (...args: unknown[]) => mockCheckAnalysisGuards(...args),
}));

vi.mock('@/lib/ai/pipeline/logging', () => ({
  logPipelineStart: (...args: unknown[]) => mockLogPipelineStart(...args),
  logPipelineEnd: (...args: unknown[]) => mockLogPipelineEnd(...args),
}));

vi.mock('@/lib/ai/pipeline', () => ({
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

vi.mock('@/lib/ai/mappers', () => ({
  buildUserContext: () => ({}),
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
}));

const { POST } = await import('@/app/api/analyze-meal/route');

function createRequest(
  body: unknown,
  headers: Record<string, string> = {}
): NextRequest {
  return new Request('http://localhost/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
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
    mockCreateGeminiClient.mockReset();
    mockCreateGeminiClient.mockReturnValue({});
    mockCheckAnalysisGuards.mockReset();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true });
    mockBuildAnalysisGuardEvent.mockClear();
    mockLogPipelineStart.mockReset();
    mockLogPipelineStart.mockResolvedValue('request-123');
    mockLogPipelineEnd.mockClear();
    mockDbInsert.mockClear();
    mockDbInsertValues.mockClear();
    mockInsert.mockResolvedValue([{ id: 'analysis-123' }]);
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
    const res = await POST(createRequest({ message: 'phở bò' }));
    expect(res.status).toBe(401);
    const json = await res.json();
    expect(json.error.code).toBe('NOT_AUTHENTICATED');
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error.code).toBe('VALIDATION_FAILED');
  });

  it('returns 404 when profile row is missing', async () => {
    mockSelect.mockResolvedValue([]);
    const res = await POST(createRequest({ message: 'phở bò' }));
    const json = await res.json();

    expect(res.status).toBe(404);
    expect(json.error.code).toBe('PROFILE_NOT_FOUND');
  });

  it('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(createRequest({ message: 'phở bò' }));
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
      createRequest(
        { message: rawMealText },
        { 'x-forwarded-for': '203.0.113.24, 10.0.0.7' }
      )
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

  it('releases an allowed guard when pipeline logging fails before SSE starts', async () => {
    const release = vi.fn();
    mockCheckAnalysisGuards.mockResolvedValue({ allowed: true, release });
    mockLogPipelineStart.mockRejectedValue(new Error('log start failed'));

    await expect(POST(createRequest({ message: 'phở bò' }))).rejects.toThrow(
      'log start failed'
    );

    expect(release).toHaveBeenCalledTimes(1);
    expect(mockCreateGeminiClient).not.toHaveBeenCalled();
  });

  // SSE streaming tests — these return 200 with event stream
  it('streams result and analysis_complete on pipeline success', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: mockPipelineData,
    });

    const res = await POST(createRequest({ message: 'Phở bò tái' }));
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

    const res = await POST(createRequest({ message: 'hello world' }));
    expect(res.status).toBe(200);

    const events = await readSSEEvents(res);
    const errorEvent = events.find((e) => e.type === 'error');

    expect(errorEvent).toBeDefined();
    if (errorEvent?.type === 'error') {
      expect(errorEvent.code).toBe('non_food_input');
      expect(errorEvent.message).toBe('Not a food');
    }
  });

  it('streams error event on unexpected exceptions', async () => {
    mockAnalyzeMeal.mockRejectedValue(new Error('unexpected'));

    const res = await POST(createRequest({ message: 'phở bò' }));
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
