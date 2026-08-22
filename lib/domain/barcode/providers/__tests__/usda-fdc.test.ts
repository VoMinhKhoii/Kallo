import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { fetchProductFromUsdaFdc } from '../usda-fdc';

const BARCODE = '049000050103';

function nutrient(nutrientNumber: string, value: number) {
  return { nutrientNumber, nutrientName: nutrientNumber, value };
}

function food(overrides: Record<string, unknown> = {}) {
  return {
    fdcId: 123456,
    description: 'Coca-Cola Original Taste',
    brandName: 'Coca-Cola',
    brandOwner: 'The Coca-Cola Company',
    gtinUpc: BARCODE,
    servingSize: 240,
    servingSizeUnit: 'ml',
    foodNutrients: [
      nutrient('208', 42),
      nutrient('203', 0),
      nutrient('205', 10.6),
      nutrient('204', 0),
      nutrient('291', 0),
      nutrient('307', 4),
    ],
    ...overrides,
  };
}

function mockSearch(body: unknown, ok = true, status = 200) {
  return vi.spyOn(global, 'fetch').mockResolvedValue({
    ok,
    status,
    json: async () => body,
  } as Response);
}

beforeEach(() => {
  vi.restoreAllMocks();
  vi.stubEnv('USDA_API_KEY', 'test-key');
  vi.spyOn(console, 'info').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('fetchProductFromUsdaFdc', () => {
  it('queries the branded dataset and maps nutrient numbers', async () => {
    const fetchSpy = mockSearch({ foods: [food()] });

    const result = await fetchProductFromUsdaFdc(BARCODE);

    const [url] = fetchSpy.mock.calls[0];
    expect(String(url)).toContain(
      'https://api.nal.usda.gov/fdc/v1/foods/search?'
    );
    expect(String(url)).toContain('dataType=Branded');
    expect(String(url)).toContain(`query=${BARCODE}`);
    expect(result).toEqual({
      barcode: BARCODE,
      name: 'Coca-Cola Original Taste',
      brand: 'Coca-Cola',
      caloriesKcal: 42,
      proteinG: 0,
      carbohydrateG: 10.6,
      fatG: 0,
      fiberG: 0,
      // 307 is already milligrams — no ×1000.
      sodiumMg: 4,
      servingSizeG: 240,
      packageSizeG: null,
    });
  });

  it('picks the exact GTIN match, not the top text match', async () => {
    mockSearch({
      foods: [
        food({
          fdcId: 999,
          description: 'Coca-Cola Zero Sugar',
          gtinUpc: '049000042559',
          foodNutrients: [nutrient('208', 0)],
        }),
        food(),
      ],
    });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.name).toBe('Coca-Cola Original Taste');
    expect(result?.caloriesKcal).toBe(42);
  });

  it('matches zero-padded GTIN spellings', async () => {
    mockSearch({ foods: [food({ gtinUpc: `00${BARCODE}` })] });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.barcode).toBe(BARCODE);
  });

  it('is null when no result carries the scanned GTIN', async () => {
    mockSearch({ foods: [food({ gtinUpc: '012345678905' })] });
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toBeNull();
  });

  it('is null for an empty result set', async () => {
    mockSearch({ foods: [] });
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toBeNull();
  });

  it('derives calories from kJ when only kJ is labelled', async () => {
    mockSearch({
      foods: [
        food({
          foodNutrients: [nutrient('268', 418.4), nutrient('203', 5)],
        }),
      ],
    });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.caloriesKcal).toBe(100);
  });

  it('falls back to brandOwner when brandName is absent', async () => {
    mockSearch({ foods: [food({ brandName: null })] });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.brand).toBe('The Coca-Cola Company');
  });

  it('rescales values that can only be per-serving', async () => {
    // A 500 g serving whose nutrients are stated per serving: 1750 kcal is
    // impossible per 100 g, but 350 kcal per 100 g is ordinary.
    mockSearch({
      foods: [
        food({
          servingSize: 500,
          servingSizeUnit: 'g',
          foodNutrients: [
            nutrient('208', 1750),
            nutrient('203', 37.5),
            nutrient('205', 260),
            nutrient('204', 60),
            nutrient('307', 4250),
          ],
        }),
      ],
    });

    const result = await fetchProductFromUsdaFdc(BARCODE);

    expect(result?.caloriesKcal).toBe(350);
    expect(result?.proteinG).toBe(7.5);
    expect(result?.carbohydrateG).toBe(52);
    expect(result?.fatG).toBe(12);
    expect(result?.sodiumMg).toBe(850);
    expect(console.warn).toHaveBeenCalled();
  });

  it('keeps a plausible per-100g reading untouched', async () => {
    mockSearch({ foods: [food()] });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.caloriesKcal).toBe(42);
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('takes a serving size in ml but not in exotic units', async () => {
    mockSearch({ foods: [food({ servingSize: 30, servingSizeUnit: 'GRM' })] });
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toMatchObject({
      servingSizeG: 30,
    });

    mockSearch({ foods: [food({ servingSize: 2, servingSizeUnit: 'tbsp' })] });
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toMatchObject({
      servingSizeG: null,
    });
  });

  it('never guesses a package size', async () => {
    mockSearch({
      foods: [food({ packageWeight: '1 LB 2 OZ' })],
    });

    const result = await fetchProductFromUsdaFdc(BARCODE);
    expect(result?.packageSizeG).toBeNull();
  });

  it('returns null on a non-2xx response', async () => {
    mockSearch({}, false, 429);
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('returns null on a malformed body instead of throwing', async () => {
    mockSearch({ foods: 'not-an-array' });
    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toBeNull();
    expect(console.error).toHaveBeenCalled();
  });

  it('returns null on a non-numeric barcode without a request', async () => {
    const fetchSpy = mockSearch({ foods: [food()] });
    await expect(fetchProductFromUsdaFdc('abc123')).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('returns null with zero requests when the key is missing', async () => {
    vi.stubEnv('USDA_API_KEY', '');
    const fetchSpy = mockSearch({ foods: [food()] });

    await expect(fetchProductFromUsdaFdc(BARCODE)).resolves.toBeNull();
    expect(fetchSpy).not.toHaveBeenCalled();
  });
});
