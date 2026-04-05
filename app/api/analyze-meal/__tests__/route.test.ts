import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { parseSSEChunk } from '@/lib/ai/streaming/encoder';
import type { StreamEvent } from '@/lib/ai/streaming/types';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockAnalyzeMeal = vi.fn();
const mockInsert = vi.fn();

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
    insert: () => insertChain,
    values: () => insertChain,
    returning: () => mockInsert(),
  };
  return {
    db: {
      ...selectChain,
      insert: () => insertChain,
    },
  };
});

vi.mock('@/lib/db/schema', () => ({
  userProfiles: { userId: 'userId' },
  pendingAnalyses: { id: 'id' },
}));

vi.mock('@/lib/ai/gemini', () => ({
  createGeminiClient: () => ({}),
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

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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
  regionalProfile: 'mien_nam',
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

  it('returns 403 when profile is incomplete', async () => {
    mockSelect.mockResolvedValue([{ goal: null, regionalProfile: null }]);
    const res = await POST(createRequest({ message: 'phở bò' }));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error.code).toBe('ONBOARDING_INCOMPLETE');
  });

  it('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(createRequest({ message: 'phở bò' }));
    expect(res.status).toBe(500);
    const json = await res.json();
    expect(json.error.code).toBe('INTERNAL');
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
