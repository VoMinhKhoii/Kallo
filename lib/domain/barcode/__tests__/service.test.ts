import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

vi.mock('@/lib/infra/db/schema', () => ({
  vietnameseFoodComposition: { id: 'vietnameseFoodComposition.id' },
  ingredientSources: {
    id: 'ingredientSources.id',
    code: 'ingredientSources.code',
  },
  pendingAnalyses: { id: 'pendingAnalyses.id' },
}));

vi.mock('@/lib/domain/barcode/openfoodfacts', async (importActual) => {
  // Keep the real parseSizeGrams (used by the cache-read path); only the
  // network fetch is stubbed.
  const actual =
    await importActual<typeof import('@/lib/domain/barcode/openfoodfacts')>();
  return {
    ...actual,
    fetchProductFromOpenFoodFacts: vi.fn(),
  };
});

import type { PipelineResult } from '@/lib/ai/types/result';
import { fetchProductFromOpenFoodFacts } from '@/lib/domain/barcode/openfoodfacts';
import {
  BarcodeServiceError,
  searchBarcodeProduct,
  stageBarcodeMeal,
} from '../service';

function mockSelectOnce(rows: unknown[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  };
}

const offProduct = {
  barcode: '8934563138162',
  name: 'Hảo Hảo Chua Cay',
  brand: 'Acecook',
  caloriesKcal: 350,
  proteinG: 7.5,
  carbohydrateG: 52,
  fatG: 12,
  fiberG: 2,
  sodiumMg: 850,
  servingSizeG: 75,
  packageSizeG: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('searchBarcodeProduct', () => {
  it('returns from local cache, parsing brand and validating sizes', async () => {
    mockDbSelect.mockReturnValue(
      mockSelectOnce([
        {
          id: 'off_8934563138162',
          namePrimary: '[Mì ăn liền] Hảo Hảo',
          caloriesKcal: 350,
          proteinG: 7.5,
          carbohydrateG: 52,
          fatG: 12,
          fiberG: 2,
          sodiumMg: 850,
          servingSizeG: '75',
          // Beyond the 100kg cap — must be rejected by parseSizeGrams, not
          // passed through raw.
          packageSizeG: '500000',
        },
      ])
    );

    const product = await searchBarcodeProduct('8934563138162');

    expect(product).toEqual({
      barcode: '8934563138162',
      name: 'Hảo Hảo',
      brand: 'Mì ăn liền',
      caloriesKcal: 350,
      proteinG: 7.5,
      carbohydrateG: 52,
      fatG: 12,
      fiberG: 2,
      sodiumMg: 850,
      servingSizeG: 75,
      packageSizeG: null,
    });
    expect(fetchProductFromOpenFoodFacts).not.toHaveBeenCalled();
  });

  it('fetches from OFF and caches on a miss', async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([])) // no cached item
      .mockReturnValueOnce(mockSelectOnce([{ id: 42 }])); // OFF source id

    vi.mocked(fetchProductFromOpenFoodFacts).mockResolvedValue(offProduct);

    const capturedValues: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        capturedValues.push(val);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      }),
    });

    const product = await searchBarcodeProduct('8934563138162');

    expect(product).toEqual(offProduct);
    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    expect(capturedValues[0]).toMatchObject({
      id: 'off_8934563138162',
      namePrimary: '[Acecook] Hảo Hảo Chua Cay',
      caloriesKcal: '350',
      sourceId: 42,
      servingSizeG: '75',
      packageSizeG: null,
    });
  });

  it('throws not_found when OFF has no product', async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([]))
      .mockReturnValueOnce(mockSelectOnce([{ id: 42 }]));
    vi.mocked(fetchProductFromOpenFoodFacts).mockResolvedValue(null);

    await expect(searchBarcodeProduct('0000000000000')).rejects.toMatchObject({
      name: 'BarcodeServiceError',
      code: 'not_found',
    });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it('throws server_error when the OFF source row is missing', async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([]))
      .mockReturnValueOnce(mockSelectOnce([])); // seeded source missing
    vi.mocked(fetchProductFromOpenFoodFacts).mockResolvedValue(offProduct);

    await expect(searchBarcodeProduct('8934563138162')).rejects.toMatchObject({
      name: 'BarcodeServiceError',
      code: 'server_error',
    });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });
});

describe('stageBarcodeMeal', () => {
  const stageInput = {
    barcode: '8934563138162',
    grams: 200,
    loggedDate: '2026-06-14',
    timezoneOffset: -420,
  };

  it('throws not_cached when the product was never searched', async () => {
    mockDbSelect.mockReturnValue(mockSelectOnce([]));

    await expect(stageBarcodeMeal('user-123', stageInput)).rejects.toEqual(
      new BarcodeServiceError('not_cached')
    );
  });

  it('scales nutrition (nulls preserved) and stages a precise-entry analysis', async () => {
    mockDbSelect.mockReturnValue(
      mockSelectOnce([
        {
          id: 'off_8934563138162',
          namePrimary: '[Acecook] Hảo Hảo',
          caloriesKcal: 350,
          proteinG: 8.33,
          carbohydrateG: 50,
          fatG: 10,
          fiberG: null,
          sodiumMg: 800,
        },
      ])
    );

    const capturedValues: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        capturedValues.push(val);
        return {
          returning: vi.fn().mockResolvedValue([{ id: 'pending-999' }]),
        };
      }),
    });

    const result = await stageBarcodeMeal('user-123', stageInput);

    expect(result).toEqual({ analysisId: 'pending-999' });
    const stagedRow = capturedValues[0] as Record<string, unknown>;
    expect(stagedRow.userId).toBe('user-123');
    expect(stagedRow.entryMode).toBe('precise');
    expect(stagedRow.rawInput).toBe('[Acecook] Hảo Hảo (200g)');

    const pipelineResult = stagedRow.pipelineResult as PipelineResult;
    expect(pipelineResult.displayedNutrition.caloriesKcal).toBe(700); // 350 × 2
    expect(pipelineResult.displayedNutrition.proteinG).toBe(16.66); // 2-dp rounding
    expect(pipelineResult.displayedNutrition.fiberG).toBeNull();
    expect(pipelineResult.boundedNutrition.caloriesKcal).toEqual({
      low: 700,
      mid: 700,
      high: 700,
    });
    expect(pipelineResult.boundedNutrition.fiberG).toBeNull();
    expect(pipelineResult.confidenceOverall).toBe('high');
    expect(pipelineResult.mealItems).toHaveLength(1);
    expect(pipelineResult.mealItems[0].ingredients[0]).toMatchObject({
      foodCompositionId: 'off_8934563138162',
      estimatedGrams: 200,
      matchConfidence: 1,
      userFacingUnit: 'g',
    });
  });

  it('throws stage_failed when the insert returns no row', async () => {
    mockDbSelect.mockReturnValue(
      mockSelectOnce([
        {
          id: 'off_8934563138162',
          namePrimary: 'Hảo Hảo',
          caloriesKcal: 350,
        },
      ])
    );
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([]),
      }),
    });

    await expect(stageBarcodeMeal('user-123', stageInput)).rejects.toEqual(
      new BarcodeServiceError('stage_failed')
    );
  });
});
