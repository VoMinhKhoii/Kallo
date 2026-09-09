import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The composer stages two kinds of pick — a past dish and a scanned product —
 * and one submit carries them in the same list. These pin the seam that keeps
 * them from drifting: where each is resolved, what a missing one does, and what
 * each contributes to the meal's confidence.
 */

const resolveRelogSources = vi.fn();
const findCachedRow = vi.fn();

vi.mock('@/lib/actions/meals/relog/resolve-sources', () => ({
  resolveRelogSources,
}));
vi.mock('@/lib/domain/barcode/cache', () => ({ findCachedRow }));
vi.mock('@/lib/infra/db/client', () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}));

const { resolveComposerPicks } = await import(
  '@/lib/actions/meals/relog/resolve-picks'
);

const DISH_REF = {
  kind: 'dish' as const,
  sourceMealId: '11111111-1111-4111-8111-111111111111',
  mealItemOrder: 0,
};

/** A cached product row, as `findCachedRow` returns it. */
function cachedRow(overrides: Record<string, unknown> = {}) {
  return {
    id: 'off:8935001234567',
    namePrimary: 'Sữa tươi TH true milk',
    caloriesKcal: '60',
    proteinG: '3.2',
    carbohydrateG: '4.8',
    fatG: '3.2',
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  resolveRelogSources.mockResolvedValue({
    dishes: [
      {
        name: 'Phở bò',
        rows: [
          {
            mealId: DISH_REF.sourceMealId,
            mealItemName: 'Phở bò',
            mealItemOrder: 0,
            ingredientName: 'Phở bò',
            foodCompositionId: null,
            estimatedGrams: 400,
            userFacingUnit: 'g',
            cookingMethod: null,
            matchConfidence: 1,
            caloriesKcal: '410',
          },
        ],
      },
    ],
    sourceConfidences: ['medium'],
  });
});

describe('resolveComposerPicks', () => {
  it('scales a scanned product to the grams the user chose', async () => {
    findCachedRow.mockResolvedValue(cachedRow());

    const picks = await resolveComposerPicks('user-1', [
      { kind: 'barcode', barcode: '8935001234567', grams: 250 },
    ]);

    expect(findCachedRow).toHaveBeenCalledWith('8935001234567');
    expect(picks.names).toEqual(['Sữa tươi TH true milk']);
    // 60 kcal/100g × 250g. The label's own numbers, not an estimate.
    expect(picks.items[0]?.displayedNutrition.caloriesKcal).toBe(150);
    expect(picks.items[0]?.ingredients[0]?.estimatedGrams).toBe(250);
  });

  it('freezes the scanned numbers so confirm cannot goal-adjust them', async () => {
    findCachedRow.mockResolvedValue(cachedRow());

    const picks = await resolveComposerPicks('user-1', [
      { kind: 'barcode', barcode: '8935001234567', grams: 100 },
    ]);

    // A degenerate triple — low === mid === high — is what makes confirm's
    // re-adjustment arithmetically a no-op.
    expect(picks.items[0]?.boundedNutrition.caloriesKcal).toEqual({
      low: 60,
      mid: 60,
      high: 60,
    });
  });

  it('resolves both kinds in one submit, relogged dishes first', async () => {
    findCachedRow.mockResolvedValue(cachedRow());

    const picks = await resolveComposerPicks('user-1', [
      { kind: 'barcode', barcode: '8935001234567', grams: 100 },
      DISH_REF,
    ]);

    expect(picks.names).toEqual(['Phở bò', 'Sữa tươi TH true milk']);
    // Only the relog half reaches the locked transaction; the scan is a plain
    // cache read that must not hold a pool connection open.
    expect(resolveRelogSources).toHaveBeenCalledWith({}, 'user-1', [DISH_REF], {
      lock: true,
    });
  });

  it('refuses a barcode nothing has searched rather than reaching out', async () => {
    findCachedRow.mockResolvedValue(undefined);

    await expect(
      resolveComposerPicks('user-1', [
        { kind: 'barcode', barcode: '8935001234567', grams: 100 },
      ])
    ).rejects.toThrow();
  });

  it('calls a scan-only submit high — a printed label is not an estimate', async () => {
    findCachedRow.mockResolvedValue(cachedRow());

    const picks = await resolveComposerPicks('user-1', [
      { kind: 'barcode', barcode: '8935001234567', grams: 100 },
    ]);

    // The 'low' default would make the same product read less certain through
    // the composer than through `stageBarcodeMeal`, which calls it 'high'.
    expect(picks.confidence).toBe('high');
    expect(resolveRelogSources).not.toHaveBeenCalled();
  });

  it('takes the WEAKEST source confidence once a relog pick is in', async () => {
    findCachedRow.mockResolvedValue(cachedRow());
    resolveRelogSources.mockResolvedValue({
      dishes: [{ name: 'Phở bò', rows: [] }],
      sourceConfidences: ['high', 'low', 'medium'],
    });

    const picks = await resolveComposerPicks('user-1', [
      DISH_REF,
      { kind: 'barcode', barcode: '8935001234567', grams: 100 },
    ]);

    // The scan does not lift the meal: it is no more confident than its least
    // confident part.
    expect(picks.confidence).toBe('low');
  });

  it('never upgrades an unrecognized or missing source confidence', async () => {
    resolveRelogSources.mockResolvedValue({
      dishes: [{ name: 'Phở bò', rows: [] }],
      sourceConfidences: [null, 'bogus'],
    });

    const picks = await resolveComposerPicks('user-1', [DISH_REF]);

    expect(picks.confidence).toBe('low');
  });
});
