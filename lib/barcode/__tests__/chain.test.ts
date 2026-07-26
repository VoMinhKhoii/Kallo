import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchOff } = vi.hoisted(() => ({
  mockFetchOff: vi.fn(),
}));

vi.mock('@/lib/barcode/openfoodfacts', () => ({
  OFF_TIMEOUT_MS: 8000,
  fetchProductFromOpenFoodFacts: mockFetchOff,
}));

import type { ParsedBarcodeProduct } from '@/lib/barcode/types';
import { BARCODE_PROVIDERS, resolveBarcodeProduct } from '../chain';

const BARCODE = '8934563138162';

function product(
  overrides: Partial<ParsedBarcodeProduct> = {}
): ParsedBarcodeProduct {
  return {
    barcode: BARCODE,
    name: 'Hảo Hảo',
    brand: 'Acecook',
    caloriesKcal: 350,
    proteinG: 7.5,
    carbohydrateG: 52,
    fatG: 12,
    fiberG: 2,
    sodiumMg: 850,
    servingSizeG: 75,
    packageSizeG: null,
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('BARCODE_PROVIDERS', () => {
  it('exposes Open Food Facts with its own timeout and no credentials', () => {
    const off = BARCODE_PROVIDERS.find((provider) => provider.id === 'off');

    expect(off).toBeDefined();
    expect(off?.sourceCode).toBe('OFF');
    expect(off?.cachePrefix).toBe('off_');
    expect(off?.timeoutMs).toBe(8000);
    expect(off?.isConfigured({})).toBe(true);
  });
});

describe('resolveBarcodeProduct', () => {
  it('returns a complete product with its resolving provider', async () => {
    const hit = product();
    mockFetchOff.mockResolvedValue(hit);

    const result = await resolveBarcodeProduct(BARCODE);

    expect(result?.provider.id).toBe('off');
    expect(result?.product).toBe(hit);
    expect(mockFetchOff).toHaveBeenCalledWith(BARCODE, 8000);
  });

  it('is null when the provider has no match', async () => {
    mockFetchOff.mockResolvedValue(null);
    await expect(resolveBarcodeProduct(BARCODE)).resolves.toBeNull();
  });

  it('gates out a barcode match that carries no nutrition', async () => {
    mockFetchOff.mockResolvedValue(
      product({
        caloriesKcal: null,
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: null,
        sodiumMg: null,
      })
    );

    await expect(resolveBarcodeProduct(BARCODE)).resolves.toBeNull();
  });

  it('keeps a kcal-only product as the held fallback', async () => {
    mockFetchOff.mockResolvedValue(
      product({
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: null,
        sodiumMg: null,
      })
    );

    const result = await resolveBarcodeProduct(BARCODE);
    expect(result?.product.caloriesKcal).toBe(350);
  });

  it('rejects an implausible per-100g candidate', async () => {
    mockFetchOff.mockResolvedValue(product({ caloriesKcal: 4200 }));
    await expect(resolveBarcodeProduct(BARCODE)).resolves.toBeNull();
  });

  it('catches a throwing provider instead of propagating', async () => {
    mockFetchOff.mockRejectedValue(new Error('socket hang up'));
    await expect(resolveBarcodeProduct(BARCODE)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });
});
