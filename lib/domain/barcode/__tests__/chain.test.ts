import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetchOff, mockFetchFdc } = vi.hoisted(() => ({
  mockFetchOff: vi.fn(),
  mockFetchFdc: vi.fn(),
}));

vi.mock('@/lib/domain/barcode/openfoodfacts', () => ({
  OFF_TIMEOUT_MS: 8000,
  fetchProductFromOpenFoodFacts: mockFetchOff,
}));

vi.mock('@/lib/domain/barcode/providers/usda-fdc', () => ({
  FDC_TIMEOUT_MS: 4000,
  fetchProductFromUsdaFdc: mockFetchFdc,
}));

import type { ParsedBarcodeProduct } from '@/lib/domain/barcode/types';
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

/** A promise resolved by hand, for ordering-sensitive cases. */
function deferred<T>() {
  let resolve: (value: T) => void = () => undefined;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
}

const CONFIGURED_ENV = { USDA_API_KEY: 'test-key' };

beforeEach(() => {
  vi.clearAllMocks();
  mockFetchFdc.mockResolvedValue(null);
  mockFetchOff.mockResolvedValue(null);
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('BARCODE_PROVIDERS', () => {
  it('ranks USDA FDC ahead of Open Food Facts', () => {
    expect(BARCODE_PROVIDERS.map((provider) => provider.id)).toEqual([
      'usda_fdc',
      'off',
    ]);
  });

  it('exposes Open Food Facts with its own timeout and no credentials', () => {
    const off = BARCODE_PROVIDERS.find((provider) => provider.id === 'off');

    expect(off).toBeDefined();
    expect(off?.sourceCode).toBe('OFF');
    expect(off?.cachePrefix).toBe('off_');
    expect(off?.timeoutMs).toBe(8000);
    expect(off?.isConfigured({})).toBe(true);
  });

  it('gates USDA FDC on its API key', () => {
    const fdc = BARCODE_PROVIDERS.find(
      (provider) => provider.id === 'usda_fdc'
    );

    expect(fdc?.sourceCode).toBe('USDA_FDC');
    expect(fdc?.cachePrefix).toBe('fdc_');
    expect(fdc?.timeoutMs).toBe(4000);
    expect(fdc?.isConfigured({})).toBe(false);
    expect(fdc?.isConfigured(CONFIGURED_ENV)).toBe(true);
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

  it('returns a complete FDC hit and ignores the OFF answer', async () => {
    const fdcHit = product({ name: 'FDC product' });
    mockFetchFdc.mockResolvedValue(fdcHit);
    mockFetchOff.mockResolvedValue(product({ name: 'OFF product' }));

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });

    expect(result?.provider.id).toBe('usda_fdc');
    expect(result?.product).toBe(fdcHit);
    expect(mockFetchFdc).toHaveBeenCalledWith(BARCODE, 4000);
    // Hedged, not a cascade: OFF must have been dispatched too. A degeneration
    // to a sequential chain would silently skip it and fail here.
    expect(mockFetchOff).toHaveBeenCalledWith(BARCODE, 8000);
  });

  it('falls through to OFF when FDC has no match', async () => {
    mockFetchFdc.mockResolvedValue(null);
    mockFetchOff.mockResolvedValue(product());

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });
    expect(result?.provider.id).toBe('off');
  });

  it('lets a slow complete FDC answer beat a fast OFF answer', async () => {
    const slowFdc = deferred<ParsedBarcodeProduct>();
    mockFetchFdc.mockReturnValue(slowFdc.promise);
    mockFetchOff.mockResolvedValue(product({ name: 'OFF product' }));

    const pending = resolveBarcodeProduct(BARCODE, { env: CONFIGURED_ENV });
    // Let the fast OFF promise settle before FDC produces anything.
    await Promise.resolve();
    await Promise.resolve();
    slowFdc.resolve(product({ name: 'FDC product' }));

    const result = await pending;
    expect(result?.provider.id).toBe('usda_fdc');
    expect(result?.product.name).toBe('FDC product');
  });

  it("prefers OFF's nutrition over an FDC match with none", async () => {
    mockFetchFdc.mockResolvedValue(
      product({
        name: 'FDC shell',
        caloriesKcal: null,
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: null,
        sodiumMg: null,
      })
    );
    mockFetchOff.mockResolvedValue(product({ name: 'OFF product' }));

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });

    expect(result?.provider.id).toBe('off');
    expect(result?.product.name).toBe('OFF product');
  });

  it('prefers a complete OFF product over a kcal-only FDC one', async () => {
    mockFetchFdc.mockResolvedValue(
      product({
        name: 'FDC kcal only',
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: null,
        sodiumMg: null,
      })
    );
    mockFetchOff.mockResolvedValue(product({ name: 'OFF product' }));

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });
    expect(result?.product.name).toBe('OFF product');
  });

  it('returns a held kcal-only FDC product when OFF has nothing', async () => {
    mockFetchFdc.mockResolvedValue(
      product({
        name: 'FDC kcal only',
        proteinG: null,
        carbohydrateG: null,
        fatG: null,
        fiberG: null,
        sodiumMg: null,
      })
    );
    mockFetchOff.mockResolvedValue(null);

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });
    expect(result?.provider.id).toBe('usda_fdc');
    expect(result?.product.name).toBe('FDC kcal only');
  });

  it('is null when both providers match but neither has nutrition', async () => {
    const shell = {
      caloriesKcal: null,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
      fiberG: null,
      sodiumMg: null,
    };
    mockFetchFdc.mockResolvedValue(product(shell));
    mockFetchOff.mockResolvedValue(product(shell));

    await expect(
      resolveBarcodeProduct(BARCODE, { env: CONFIGURED_ENV })
    ).resolves.toBeNull();
  });

  it('skips an unconfigured provider without a request', async () => {
    mockFetchOff.mockResolvedValue(product());

    const result = await resolveBarcodeProduct(BARCODE, { env: {} });

    expect(mockFetchFdc).not.toHaveBeenCalled();
    expect(result?.provider.id).toBe('off');
  });

  it('uses the next provider when one returns implausible values', async () => {
    mockFetchFdc.mockResolvedValue(product({ caloriesKcal: 4200 }));
    mockFetchOff.mockResolvedValue(product({ name: 'OFF product' }));

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });
    expect(result?.product.name).toBe('OFF product');
  });

  it('does not leave an unhandled rejection when returning early', async () => {
    const unhandled = vi.fn();
    process.on('unhandledRejection', unhandled);

    mockFetchFdc.mockResolvedValue(product({ name: 'FDC product' }));
    mockFetchOff.mockRejectedValue(new Error('socket hang up'));

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
    });
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off('unhandledRejection', unhandled);

    expect(result?.product.name).toBe('FDC product');
    expect(unhandled).not.toHaveBeenCalled();
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

  it('contains a synchronously throwing provider', async () => {
    mockFetchOff.mockImplementation(() => {
      throw new Error('sync boom');
    });

    await expect(resolveBarcodeProduct(BARCODE)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('skips a provider whose ingredient source row is not seeded', async () => {
    mockFetchOff.mockResolvedValue(product());

    const result = await resolveBarcodeProduct(BARCODE, {
      env: CONFIGURED_ENV,
      seededSourceCodes: new Set(['OFF']),
    });

    expect(mockFetchFdc).not.toHaveBeenCalled();
    expect(result?.provider.id).toBe('off');
    expect(console.error).toHaveBeenCalled();
  });
});
