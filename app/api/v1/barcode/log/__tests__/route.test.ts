import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();
const stageBarcodeMeal = vi.fn();
const confirmAndSaveMealAction = vi.fn();

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile,
}));

vi.mock('@/lib/barcode/service', async (importActual) => {
  // Keep the real BarcodeServiceError so instanceof checks in the route's
  // error mapper see the same class the mock throws.
  const actual = await importActual<typeof import('@/lib/barcode/service')>();
  return {
    BarcodeServiceError: actual.BarcodeServiceError,
    searchBarcodeProduct: vi.fn(),
    stageBarcodeMeal,
  };
});

vi.mock('@/lib/actions/meals/confirm-and-save', () => ({
  confirmAndSaveMealAction,
}));

const { BarcodeServiceError } = await import('@/lib/barcode/service');
const { POST } = await import('@/app/api/v1/barcode/log/route');

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const validBody = {
  barcode: '8934563138162',
  grams: 150,
  mealId: '2b8e2f6a-4f9f-4d38-9f6e-1a2b3c4d5e6f',
  loggedDate: '2026-07-02',
  timezoneOffset: -420,
};

const confirmResponse = {
  mealId: 'meal-1',
  totals: { caloriesKcal: 525 },
};

beforeEach(() => {
  requireAuthAndProfile.mockReset();
  stageBarcodeMeal.mockReset();
  confirmAndSaveMealAction.mockReset();
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  stageBarcodeMeal.mockResolvedValue({ analysisId: 'analysis-1' });
  confirmAndSaveMealAction.mockResolvedValue(confirmResponse);
});

describe('POST /api/v1/barcode/log', () => {
  it('stages for the authenticated user then confirms, forwarding mealId', async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(confirmResponse);
    expect(stageBarcodeMeal).toHaveBeenCalledWith(
      'user-123',
      expect.objectContaining({
        barcode: '8934563138162',
        grams: 150,
        loggedDate: '2026-07-02',
        timezoneOffset: -420,
      })
    );
    expect(confirmAndSaveMealAction).toHaveBeenCalledWith({
      analysisId: 'analysis-1',
      mealId: validBody.mealId,
    });
  });

  it('rejects invalid grams with 400 before staging', async () => {
    const res = await POST(makeRequest({ ...validBody, grams: -5 }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(stageBarcodeMeal).not.toHaveBeenCalled();
  });

  it('rejects a non-numeric barcode with 400', async () => {
    const res = await POST(makeRequest({ ...validBody, barcode: 'nope' }));
    expect(res.status).toBe(400);
    expect(stageBarcodeMeal).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { Errors } = await import('@/lib/errors');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(stageBarcodeMeal).not.toHaveBeenCalled();
  });

  it('maps not_cached to a 404 BARCODE_NOT_CACHED envelope', async () => {
    stageBarcodeMeal.mockRejectedValue(new BarcodeServiceError('not_cached'));

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'BARCODE_NOT_CACHED',
      status: 404,
      retryable: false,
    });
    expect(confirmAndSaveMealAction).not.toHaveBeenCalled();
  });

  it('propagates AppErrors thrown by confirm (e.g. consumed analysis)', async () => {
    const { Errors } = await import('@/lib/errors');
    confirmAndSaveMealAction.mockRejectedValueOnce(
      Errors.validationFailed('Phân tích không tồn tại hoặc đã được lưu.')
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
  });
});
