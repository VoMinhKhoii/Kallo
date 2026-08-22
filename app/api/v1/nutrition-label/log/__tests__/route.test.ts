import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();
const stageOcrMeal = vi.fn();
const confirmAndSaveMealAction = vi.fn();

vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));

vi.mock('@/lib/domain/nutrition/ocr/stage', async (importActual) => {
  const actual =
    await importActual<typeof import('@/lib/domain/nutrition/ocr/stage')>();
  return {
    NutritionOcrStageError: actual.NutritionOcrStageError,
    stageOcrMeal,
  };
});

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction,
}));

const { POST } = await import('@/app/api/v1/nutrition-label/log/route');

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const validBody = {
  productName: 'Bánh quy Cosy',
  amount: 100,
  unit: 'g',
  confidence: 'high',
  calories: 480,
  proteinGrams: 6,
  carbsGrams: 62,
  fatGrams: 22,
  fiberGrams: 2,
  sodiumMg: 320,
  mealId: '2b8e2f6a-4f9f-4d38-9f6e-1a2b3c4d5e6f',
  loggedDate: '2026-07-02',
  timezoneOffset: -420,
};

const confirmResponse = { mealId: 'meal-1', totals: { caloriesKcal: 480 } };

beforeEach(() => {
  requireAuthAndProfile.mockReset();
  stageOcrMeal.mockReset();
  confirmAndSaveMealAction.mockReset();
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  stageOcrMeal.mockResolvedValue({ analysisId: 'analysis-1' });
  confirmAndSaveMealAction.mockResolvedValue(confirmResponse);
});

describe('POST /api/v1/nutrition-label/log', () => {
  it('stages for the authenticated user then confirms, forwarding mealId', async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(confirmResponse);
    expect(stageOcrMeal).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        productName: 'Bánh quy Cosy',
        amount: 100,
        unit: 'g',
        calories: 480,
        loggedDate: '2026-07-02',
        timezoneOffset: -420,
      })
    );
    expect(confirmAndSaveMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: validBody.mealId,
    });
  });

  it('accepts a body without mealId', async () => {
    const { mealId: _omitted, ...withoutMealId } = validBody;

    const res = await POST(makeRequest(withoutMealId));
    expect(res.status).toBe(200);
    expect(confirmAndSaveMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: undefined,
    });
  });

  it('rejects a null required macro with 400 before staging', async () => {
    const res = await POST(makeRequest({ ...validBody, proteinGrams: null }));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(stageOcrMeal).not.toHaveBeenCalled();
  });

  it('rejects a non-positive amount with 400', async () => {
    const res = await POST(makeRequest({ ...validBody, amount: 0 }));
    expect(res.status).toBe(400);
    expect(stageOcrMeal).not.toHaveBeenCalled();
  });

  it('rejects an unknown unit with 400', async () => {
    const res = await POST(makeRequest({ ...validBody, unit: 'oz' }));
    expect(res.status).toBe(400);
    expect(stageOcrMeal).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(stageOcrMeal).not.toHaveBeenCalled();
  });

  it('propagates AppErrors thrown by confirm (e.g. consumed analysis)', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    confirmAndSaveMealAction.mockRejectedValueOnce(
      Errors.validationFailed('Phân tích không tồn tại hoặc đã được lưu.')
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
  });

  it('returns a generic 500 when staging fails', async () => {
    stageOcrMeal.mockRejectedValueOnce(new Error('db down'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(500);
    expect(confirmAndSaveMealAction).not.toHaveBeenCalled();
  });
});
