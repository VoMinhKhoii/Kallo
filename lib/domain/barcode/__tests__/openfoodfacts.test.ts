import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProductFromOpenFoodFacts } from '../openfoodfacts';

describe('fetchProductFromOpenFoodFacts', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('returns null for invalid/non-numeric barcodes', async () => {
    const result = await fetchProductFromOpenFoodFacts('abc123xyz');
    expect(result).toBeNull();
  });

  it('correctly fetches and parses a valid product', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Regular Name',
        product_name_vi: 'Tên Tiếng Việt',
        brands: 'Test Brand',
        serving_quantity: '30',
        product_quantity: 150,
        nutriments: {
          'energy-kcal_100g': 120,
          proteins_100g: 5.5,
          carbohydrates_100g: 22,
          fat_100g: 3,
          fiber_100g: 1.5,
          sodium_100g: 0.25,
        },
      },
    };

    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');

    expect(fetchSpy).toHaveBeenCalledWith(
      'https://world.openfoodfacts.org/api/v3/product/8934563138162.json',
      expect.any(Object)
    );
    expect(result).toEqual({
      barcode: '8934563138162',
      name: 'Tên Tiếng Việt',
      brand: 'Test Brand',
      caloriesKcal: 120,
      proteinG: 5.5,
      carbohydrateG: 22,
      fatG: 3,
      fiberG: 1.5,
      sodiumMg: 250,
      servingSizeG: 30,
      packageSizeG: 150,
    });
  });

  it('omits serving/package sizes that are absent or non-positive', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'No sizing',
        serving_quantity: 0, // non-positive → dropped
        // product_quantity absent → null
        nutriments: { 'energy-kcal_100g': 120 },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.servingSizeG).toBeNull();
    expect(result?.packageSizeG).toBeNull();
  });

  it('falls back to English name when Vietnamese is absent', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Regular Name',
        product_name_en: 'English Name',
        brands: 'Test Brand',
        nutriments: {
          'energy-kcal_100g': 120,
        },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.name).toBe('English Name');
  });

  it('converts kJ to kcal when energy-kcal is missing', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Energy product',
        nutriments: {
          energy_100g: 418.4, // 100 kcal
        },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.caloriesKcal).toBe(100);
  });

  it('overrides a garbage kcal value with the kJ-derived one', async () => {
    // Real OFF data for Ensure (8710428998392): a bogus 3.27 kcal alongside a
    // correct 1718.8 kJ (≈ 411 kcal). Trust the kJ.
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Ensure',
        nutriments: {
          'energy-kcal_100g': 3.27,
          'energy-kj_100g': 1718.8,
        },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8710428998392');
    expect(result?.caloriesKcal).toBe(411);
  });

  it('keeps a stated kcal that agrees with kJ', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Consistent product',
        nutriments: {
          'energy-kcal_100g': 250,
          'energy-kj_100g': 1046, // ≈ 250 kcal — within tolerance, keep stated
        },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.caloriesKcal).toBe(250);
  });

  it('honors an explicit timeout override', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(global, 'fetch').mockImplementation((_url, init) => {
      const signal = (init as RequestInit).signal as AbortSignal;
      return new Promise((_resolve, reject) => {
        signal.addEventListener('abort', () => reject(signal.reason));
      });
    });

    const started = Date.now();
    const result = await fetchProductFromOpenFoodFacts('8934563138162', 20);

    expect(result).toBeNull();
    expect(Date.now() - started).toBeLessThan(2000);
  });

  it('resolves sodium from salt when sodium is missing', async () => {
    const mockApiResponse = {
      status: 1,
      product: {
        product_name: 'Salty product',
        nutriments: {
          salt_100g: 2.5, // should correspond to 1g sodium = 1000mg sodium
        },
      },
    };

    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => mockApiResponse,
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.sodiumMg).toBe(1000);
  });
});
