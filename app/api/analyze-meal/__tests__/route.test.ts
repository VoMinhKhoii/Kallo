import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mockGetUser = vi.fn();
const mockSelect = vi.fn();
const mockAnalyzeMeal = vi.fn();

vi.mock('@/lib/supabase/server', () => ({
  createClient: () =>
    Promise.resolve({
      auth: { getUser: mockGetUser },
    }),
}));

vi.mock('@/lib/db', () => {
  const chain = {
    select: () => chain,
    from: () => chain,
    where: () => chain,
    limit: () => mockSelect(),
  };
  return { db: chain };
});

vi.mock('@/lib/db/schema', () => ({
  userProfiles: { userId: 'userId' },
}));

vi.mock('@/lib/ai/gemini', () => ({
  createGeminiClient: () => ({}),
}));

vi.mock('@/lib/ai/pipeline', () => ({
  analyzeMeal: (...args: unknown[]) => mockAnalyzeMeal(...args),
}));

const { POST } = await import('@/app/api/analyze-meal/route');

function createRequest(body: unknown): NextRequest {
  return new Request('http://localhost/api/analyze-meal', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
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

describe('POST /api/analyze-meal', () => {
  const originalEnv = process.env.GEMINI_API_KEY;

  beforeEach(() => {
    process.env.GEMINI_API_KEY = 'test-api-key';
    mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } } });
    mockSelect.mockResolvedValue([mockProfile]);
    mockAnalyzeMeal.mockReset();
  });

  afterEach(() => {
    if (originalEnv) {
      process.env.GEMINI_API_KEY = originalEnv;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  });

  it('returns 401 when user is not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(createRequest({ message: 'phở bò' }));
    expect(res.status).toBe(401);
  });

  it('returns 400 when message is missing', async () => {
    const res = await POST(createRequest({}));
    expect(res.status).toBe(400);
  });

  it('returns 400 when profile is incomplete', async () => {
    mockSelect.mockResolvedValue([{ goal: null, regionalProfile: null }]);
    const res = await POST(createRequest({ message: 'phở bò' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toContain('onboarding');
  });

  it('returns 500 when GEMINI_API_KEY is missing', async () => {
    delete process.env.GEMINI_API_KEY;
    const res = await POST(createRequest({ message: 'phở bò' }));
    expect(res.status).toBe(500);
  });

  it('returns parsed meal on pipeline success', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: true,
      data: {
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
      },
    });

    const res = await POST(createRequest({ message: 'Phở bò tái' }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.mealName).toBe('Phở bò');
    expect(json.items).toHaveLength(1);
    expect(json.totalMacros.calories).toBe(300);
  });

  it('returns error status when pipeline fails', async () => {
    mockAnalyzeMeal.mockResolvedValue({
      success: false,
      error: {
        type: 'non_food_input',
        message: 'Not a food',
        retryable: false,
      },
    });

    const res = await POST(createRequest({ message: 'hello world' }));
    const json = await res.json();

    expect(res.status).toBe(400);
    expect(json.error).toBe('Not a food');
  });

  it('returns 500 on unexpected errors', async () => {
    mockAnalyzeMeal.mockRejectedValue(new Error('unexpected'));

    const res = await POST(createRequest({ message: 'phở bò' }));
    const json = await res.json();

    expect(res.status).toBe(500);
    expect(json.error).toBe('Failed to process meal');
  });
});
