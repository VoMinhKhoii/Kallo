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
      expect.stringMatching(
        /^https:\/\/world\.openfoodfacts\.org\/api\/v3\/product\/8934563138162\.json\?fields=/
      ),
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
      amountUnit: 'g',
      micronutrients: {},
      sourceImageUrl: null,
      polyolsG: null,
    });
  });

  it('reads sugar alcohols from polyols_100g', async () => {
    // A sugar-free isomalt candy as OFF serves it: polyols are inside
    // carbohydrates_100g and also listed on their own, here as a string.
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 1,
        product: {
          product_name: 'Sugar-free mints',
          nutriments: {
            'energy-kcal_100g': 240,
            carbohydrates_100g: 98,
            polyols_100g: '97.5',
            proteins_100g: 0,
          },
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');

    expect(result?.polyolsG).toBe(97.5);
    expect(result?.carbohydrateG).toBe(98);
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

  it('asks only for the fields it reads', async () => {
    const fetchSpy = vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({ product: { product_name: 'x' } }),
    } as Response);

    await fetchProductFromOpenFoodFacts('8934563138162');

    const url = new URL(String(fetchSpy.mock.calls[0][0]));
    const fields = url.searchParams.get('fields')?.split(',') ?? [];
    expect(fields).toEqual(
      expect.arrayContaining([
        'nutriments',
        'nutrition_data_per',
        'serving_quantity_unit',
        'product_quantity_unit',
        'image_front_url',
        // Unread, but without them OFF drops the derived sizes (see OFF_FIELDS).
        'quantity',
        'serving_size',
      ])
    );
  });

  it('reads a per-100ml drink as ml with its minerals and photo', async () => {
    // Trimmed from the live OFF record for Coco Xim coconut water, 1 L.
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        product: {
          product_name: 'Coconut Water',
          brands: 'Coco Xim',
          serving_quantity: 100,
          serving_quantity_unit: 'ml',
          product_quantity: 1000,
          product_quantity_unit: 'ml',
          nutrition_data_per: '100ml',
          image_front_url:
            'https://images.openfoodfacts.org/images/products/893/850/784/9131/front_en.44.400.jpg',
          nutriments: {
            'energy-kcal_100g': 16,
            'energy-kj_100g': 68,
            carbohydrates_100g: 4,
            proteins_100g: 0,
            fat_100g: 0,
            sodium_100g: 0.039,
            calcium_100g: 0.01,
            potassium_100g: 0.17,
          },
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8938507849131');

    expect(result).toMatchObject({
      amountUnit: 'ml',
      servingSizeG: 100,
      packageSizeG: 1000,
      sodiumMg: 39,
      micronutrients: { calciumMg: 10, potassiumMg: 170 },
      sourceImageUrl:
        'https://images.openfoodfacts.org/images/products/893/850/784/9131/front_en.44.400.jpg',
    });
  });

  it('reads a carton sold in ml as ml even when labelled per 100g', async () => {
    // Vinamilk 100% fresh milk: nutrition typed per 100g, sold as 1 l, and
    // carries vitamins that OFF normalizes to grams.
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          product_name: '100 % fresh milk',
          product_quantity: 1000,
          product_quantity_unit: 'ml',
          nutrition_data_per: '100g',
          nutriments: {
            'energy-kcal_100g': 66,
            calcium_100g: 0.11,
            phosphorus_100g: 0.08,
            'vitamin-a_100g': 0.00006,
            'vitamin-d_100g': 0.0000015,
          },
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934673576390');

    expect(result?.amountUnit).toBe('ml');
    expect(result?.micronutrients).toEqual({
      calciumMg: 110,
      phosphorusMg: 80,
      vitaminAMcg: 60,
      vitaminDMcg: 1.5,
    });
  });

  it('stays in grams when a gram quantity is present or units are absent', async () => {
    const respond = (product: Record<string, unknown>) =>
      vi.spyOn(global, 'fetch').mockResolvedValueOnce({
        ok: true,
        json: async () => ({ product }),
      } as Response);

    respond({
      product_name: 'Snack',
      serving_quantity_unit: 'g',
      product_quantity_unit: 'ml',
      nutriments: { 'energy-kcal_100g': 500 },
    });
    expect(
      (await fetchProductFromOpenFoodFacts('8934563138162'))?.amountUnit
    ).toBe('g');

    respond({ product_name: 'Unknown', nutriments: {} });
    expect(
      (await fetchProductFromOpenFoodFacts('8934563138162'))?.amountUnit
    ).toBe('g');
  });

  it('drops micronutrients that cannot be per-100 figures', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          product_name: 'Bad data',
          nutriments: {
            calcium_100g: -1,
            iron_100g: 250,
            'vitamin-c_100g': '',
            zinc_100g: 0.002,
          },
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.micronutrients).toEqual({ zincMg: 2 });
  });

  it('never stores a photo URL off the trusted image host', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          product_name: 'x',
          image_front_url: 'https://evil.example/front.jpg',
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.sourceImageUrl).toBeNull();
  });

  it('ignores the unsuffixed energy figure, which may be per serving', async () => {
    vi.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        product: {
          product_name: 'Per-serving label',
          nutrition_data_per: 'serving',
          nutriments: { 'energy-kcal': 240 },
        },
      }),
    } as Response);

    const result = await fetchProductFromOpenFoodFacts('8934563138162');
    expect(result?.caloriesKcal).toBeNull();
  });
});
