import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';

const execute = vi.fn();
vi.mock('@/lib/infra/db/client', () => ({ db: { execute } }));

const { attachCardDisplay } = await import('../card-enrichment');

function result(id: string, namePrimary: string): IngredientSearchResult {
  return {
    id,
    namePrimary,
    nameEn: null,
    nameAlt: null,
    state: 'raw',
    similarity: 1,
    per100g: { caloriesKcal: 120, proteinG: 22.5, carbohydrateG: 0, fatG: 2.6 },
  };
}

beforeEach(() => {
  execute.mockReset();
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('attachCardDisplay', () => {
  it('adds the display fields in one query and keeps the ranked order', async () => {
    execute.mockResolvedValueOnce([
      // Returned out of order on purpose: the ranking must not change.
      {
        id: 'b',
        name_primary: 'Thịt bò hộp',
        type_en: 'Canned Foods',
        food: 'canned beef',
        cooking_method: null,
        brand: null,
      },
      {
        id: 'a',
        name_primary: 'Ức gà',
        type_en: 'Poultry Products',
        food: 'raw skinless chicken breast',
        cooking_method: null,
        brand: null,
      },
    ]);

    const out = await attachCardDisplay([
      result('a', 'Ức gà'),
      result('b', 'Thịt bò hộp'),
    ]);

    expect(execute).toHaveBeenCalledTimes(1);
    expect(out.map((r) => r.id)).toEqual(['a', 'b']);
    expect(out[0]).toMatchObject({
      displayNameEn: 'Skinless chicken breast',
      stateLabel: 'raw',
      brand: null,
      vessel: { family: 'piece', kind: 'poultry' },
    });
    expect(out[1]).toMatchObject({
      displayNameEn: 'Canned beef',
      stateLabel: null,
      vessel: null,
    });
  });

  it('leaves a row without a card on its own names', async () => {
    execute.mockResolvedValueOnce([
      {
        id: 'a',
        name_primary: 'Cơm trắng',
        type_en: 'Cereal Grains and Pasta',
        food: null,
        cooking_method: null,
        brand: null,
      },
    ]);
    const [out] = await attachCardDisplay([result('a', 'Cơm trắng')]);
    expect(out.displayNameEn).toBeNull();
    expect(out.stateLabel).toBeNull();
  });

  it('skips the query for an empty list', async () => {
    expect(await attachCardDisplay([])).toEqual([]);
    expect(execute).not.toHaveBeenCalled();
  });

  it('returns the results untouched when the lookup fails', async () => {
    execute.mockRejectedValueOnce(new Error('db down'));
    const input = [result('a', 'Ức gà')];
    expect(await attachCardDisplay(input)).toEqual(input);
  });
});
