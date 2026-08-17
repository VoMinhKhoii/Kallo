import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockDbInsert, mockUser } = vi.hoisted(() => {
  const mockDbSelect = vi.fn();
  const mockDbInsert = vi.fn();
  const mockUser = { id: 'user-123', email: 'test@example.com' };
  return {
    mockDbSelect,
    mockDbInsert,
    mockUser,
  };
});

vi.mock('@/lib/auth/session', () => ({
  requireAuthAndProfile: vi.fn().mockResolvedValue({
    user: mockUser,
    profile: {
      goal: 'cutting',
      aggression: '0.5',
    },
  }),
}));

vi.mock('@/lib/db', () => ({
  db: {
    select: mockDbSelect,
    insert: mockDbInsert,
  },
}));

vi.mock('@/lib/db/schema', () => ({
  vietnameseFoodComposition: { id: 'vietnameseFoodComposition.id' },
  ingredientSources: {
    id: 'ingredientSources.id',
    code: 'ingredientSources.code',
  },
  pendingAnalyses: { id: 'pendingAnalyses.id' },
}));

vi.mock('@/lib/barcode/openfoodfacts', async (importActual) => {
  // Keep the real parseSizeGrams (used by the cache-read path); only the
  // network fetch is stubbed.
  const actual =
    await importActual<typeof import('@/lib/barcode/openfoodfacts')>();
  return {
    ...actual,
    fetchProductFromOpenFoodFacts: vi.fn(),
  };
});

// Import modules under test
import {
  searchBarcodeAction,
  stageBarcodeMealAction,
} from '@/lib/actions/logging/barcode';
import type { PipelineResult } from '@/lib/ai/types/result';
import { fetchProductFromOpenFoodFacts } from '@/lib/barcode/openfoodfacts';

describe('searchBarcodeAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return from local cache if present', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
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
              packageSizeG: '150',
            },
          ]),
        }),
      }),
    });

    const result = await searchBarcodeAction({ barcode: '8934563138162' });

    expect(result).toEqual({
      success: true,
      data: {
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
        packageSizeG: 150,
      },
    });
  });

  it('should fetch from API and cache if not in local cache', async () => {
    // 1. db.select returns empty for product lookup
    // 2. db.select returns source row for ingredientSources
    mockDbSelect
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]), // no cached item
          }),
        }),
      })
      .mockReturnValueOnce({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([{ id: 42 }]), // source ID
          }),
        }),
      });

    const mockProduct = {
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

    vi.mocked(fetchProductFromOpenFoodFacts).mockResolvedValue(mockProduct);

    const capturedValues: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        capturedValues.push(val);
        return {
          onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
        };
      }),
    });

    const result = await searchBarcodeAction({ barcode: '8934563138162' });

    expect(fetchProductFromOpenFoodFacts).toHaveBeenCalledWith('8934563138162');
    expect(result).toEqual({
      success: true,
      data: mockProduct,
    });
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
});

describe('stageBarcodeMealAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return error if product not cached', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([]),
        }),
      }),
    });

    const result = await stageBarcodeMealAction({
      barcode: '8934563138162',
      grams: 200,
      loggedDate: '2026-06-14',
      timezoneOffset: -420,
    });

    expect(result).toEqual({
      success: false,
      code: 'not_cached',
    });
  });

  it('should scale nutrition and stage analysis correctly', async () => {
    mockDbSelect.mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue([
            {
              id: 'off_8934563138162',
              namePrimary: '[Acecook] Hảo Hảo',
              caloriesKcal: 350, // 350 kcal per 100g
              proteinG: 8,
              carbohydrateG: 50,
              fatG: 10,
              fiberG: 2,
              sodiumMg: 800,
            },
          ]),
        }),
      }),
    });

    const capturedValues: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        capturedValues.push(val);
        return {
          returning: vi
            .fn()
            .mockResolvedValue([{ id: 'pending-analysis-999' }]),
        };
      }),
    });

    const result = await stageBarcodeMealAction({
      barcode: '8934563138162',
      grams: 200, // 2x multiplier
      loggedDate: '2026-06-14',
      timezoneOffset: -420,
    });

    expect(result).toEqual({
      success: true,
      analysisId: 'pending-analysis-999',
    });

    expect(mockDbInsert).toHaveBeenCalledTimes(1);
    const stagedRow = capturedValues[0] as Record<string, unknown>;
    expect(stagedRow.userId).toBe(mockUser.id);
    expect(stagedRow.entryMode).toBe('precise');

    const pipelineResult = stagedRow.pipelineResult as PipelineResult;
    expect(pipelineResult.displayedNutrition.caloriesKcal).toBe(700); // 350 * 2
    expect(pipelineResult.displayedNutrition.proteinG).toBe(16); // 8 * 2
    expect(pipelineResult.boundedNutrition.caloriesKcal).toEqual({
      low: 700,
      mid: 700,
      high: 700,
    });
  });
});
