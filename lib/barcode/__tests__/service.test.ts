import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockDbSelect, mockDbInsert } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
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

// The chain owns all provider I/O, so stubbing it is what keeps this suite
// off the network; the real cache module still runs against the db mock above
// so the persisted row is asserted for real.
vi.mock('@/lib/barcode/chain', () => ({
  resolveBarcodeProduct: vi.fn(),
}));

import type { PipelineResult } from '@/lib/ai/types';
import { resolveBarcodeProduct } from '@/lib/barcode/chain';
import type { BarcodeProvider } from '@/lib/barcode/providers/types';
import {
  BarcodeServiceError,
  searchBarcodeProduct,
  stageBarcodeMeal,
} from '../service';

function providerStub(
  overrides: Partial<BarcodeProvider> & Pick<BarcodeProvider, 'id'>
): BarcodeProvider {
  return {
    sourceCode: 'OFF',
    cachePrefix: 'off_',
    timeoutMs: 8000,
    isConfigured: () => true,
    fetch: vi.fn(),
    ...overrides,
  };
}

const offProvider = providerStub({ id: 'off' });
const fdcProvider = providerStub({
  id: 'usda_fdc',
  sourceCode: 'USDA_FDC',
  cachePrefix: 'fdc_',
});

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
    expect(resolveBarcodeProduct).not.toHaveBeenCalled();
  });

  it('resolves through the chain and caches on a miss', async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([])) // no cached item
      .mockReturnValueOnce(mockSelectOnce([{ id: 42, code: 'OFF' }]));

    vi.mocked(resolveBarcodeProduct).mockResolvedValue({
      provider: offProvider,
      product: offProduct,
    });

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

  it('caches under the resolving provider prefix and source id', async () => {
    mockDbSelect.mockReturnValueOnce(mockSelectOnce([])).mockReturnValueOnce(
      mockSelectOnce([
        { id: 42, code: 'OFF' },
        { id: 77, code: 'USDA_FDC' },
      ])
    );

    vi.mocked(resolveBarcodeProduct).mockResolvedValue({
      provider: fdcProvider,
      product: offProduct,
    });

    const capturedValues: unknown[] = [];
    mockDbInsert.mockReturnValue({
      values: vi.fn().mockImplementation((val) => {
        capturedValues.push(val);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      }),
    });

    await searchBarcodeProduct('8934563138162');

    expect(capturedValues[0]).toMatchObject({
      id: 'fdc_8934563138162',
      sourceId: 77,
    });
  });

  it('throws not_found when the chain is exhausted', async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([]))
      .mockReturnValueOnce(mockSelectOnce([{ id: 42, code: 'OFF' }]));
    vi.mocked(resolveBarcodeProduct).mockResolvedValue(null);

    await expect(searchBarcodeProduct('0000000000000')).rejects.toMatchObject({
      name: 'BarcodeServiceError',
      code: 'not_found',
    });
    expect(mockDbInsert).not.toHaveBeenCalled();
  });

  it("throws server_error when the resolving provider's source row is missing", async () => {
    mockDbSelect
      .mockReturnValueOnce(mockSelectOnce([]))
      .mockReturnValueOnce(mockSelectOnce([])); // seeded source missing
    vi.mocked(resolveBarcodeProduct).mockResolvedValue({
      provider: offProvider,
      product: offProduct,
    });

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
