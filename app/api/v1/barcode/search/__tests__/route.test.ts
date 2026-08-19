import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const requireAuthAndProfile = vi.fn();
const searchBarcodeProduct = vi.fn();

vi.mock('@/lib/infra/auth/session', () => ({
  requireAuthAndProfile,
}));

vi.mock('@/lib/domain/barcode/service', async (importActual) => {
  // Keep the real BarcodeServiceError so instanceof checks in the route's
  // error mapper see the same class the mock throws.
  const actual =
    await importActual<typeof import('@/lib/domain/barcode/service')>();
  return {
    BarcodeServiceError: actual.BarcodeServiceError,
    searchBarcodeProduct,
    stageBarcodeMeal: vi.fn(),
  };
});

const { BarcodeServiceError } = await import('@/lib/domain/barcode/service');
const { GET } = await import('@/app/api/v1/barcode/search/route');

function makeRequest(params: Record<string, string>): NextRequest {
  const url = new URL('http://localhost/api/v1/barcode/search');
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return { nextUrl: url } as unknown as NextRequest;
}

const product = {
  barcode: '5449000000996',
  name: 'Coca-Cola',
  brand: 'Coca-Cola',
  caloriesKcal: 42,
  proteinG: 0,
  carbohydrateG: 10.6,
  fatG: 0,
  fiberG: null,
  sodiumMg: null,
  servingSizeG: 330,
  packageSizeG: null,
};

beforeEach(() => {
  requireAuthAndProfile.mockReset();
  searchBarcodeProduct.mockReset();
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
});

describe('GET /api/v1/barcode/search', () => {
  it('returns the product for a valid barcode', async () => {
    searchBarcodeProduct.mockResolvedValue(product);

    const res = await GET(makeRequest({ code: '5449000000996' }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ product });
    expect(searchBarcodeProduct).toHaveBeenCalledWith('5449000000996');
  });

  it('rejects a non-numeric barcode with 400 before hitting the service', async () => {
    const res = await GET(makeRequest({ code: 'abc123' }));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(searchBarcodeProduct).not.toHaveBeenCalled();
  });

  it('rejects a missing code with 400', async () => {
    const res = await GET(makeRequest({}));
    expect(res.status).toBe(400);
    expect(searchBarcodeProduct).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await GET(makeRequest({ code: '5449000000996' }));
    expect(res.status).toBe(401);
    expect(searchBarcodeProduct).not.toHaveBeenCalled();
  });

  it('maps not_found to a 404 BARCODE_NOT_FOUND envelope', async () => {
    searchBarcodeProduct.mockRejectedValue(
      new BarcodeServiceError('not_found')
    );

    const res = await GET(makeRequest({ code: '0000000000000' }));
    expect(res.status).toBe(404);
    const { error } = await res.json();
    expect(error).toMatchObject({
      code: 'BARCODE_NOT_FOUND',
      status: 404,
      retryable: false,
    });
  });

  it('maps server_error to a generic 500 INTERNAL envelope', async () => {
    searchBarcodeProduct.mockRejectedValue(
      new BarcodeServiceError('server_error')
    );

    const res = await GET(makeRequest({ code: '5449000000996' }));
    expect(res.status).toBe(500);
    const { error } = await res.json();
    expect(error.code).toBe('INTERNAL');
  });
});
