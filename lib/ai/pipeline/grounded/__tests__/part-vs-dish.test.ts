import { describe, expect, it } from 'vitest';
import type {
  IngredientV2MatchResult,
  V2MatchCandidate,
} from '@/lib/ai/matching/candidate';
import type { EatenState } from '@/lib/ai/matching/match-constants';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { dropWholeDishRowsFromParts } from '@/lib/ai/pipeline/grounded/part-vs-dish';

function row(
  id: string,
  eatenState: EatenState | undefined,
  names: string[]
): V2MatchCandidate {
  return {
    info: {
      ingredientName: 'x',
      foodCompositionId: id,
      matchedName: names[0],
      similarity: 0.8,
      confidence: 'medium',
      state: 'unknown',
      ...(eatenState ? { eatenState } : {}),
      // Card retrieval attaches names to whole-dish rows only.
      ...(eatenState === 'dish' ? { rowNames: names } : {}),
    },
    nutrition: null,
    inediblePct: null,
    prompt: { name: names[0], nameEn: null, score: 1 },
  };
}

type Part = { rawName: string; canonicalName: string };

function meal(...items: Array<{ name: string; parts: Part[] }>) {
  const decomposition: MealDecompositionV2 = {
    isFood: true,
    mealSlot: 'lunch',
    mealItems: items.map((it) => ({
      name: it.name,
      cookingMethod: 'mixed',
      ingredients: it.parts,
    })),
  };
  return decomposition;
}

const part = (
  rawName: string,
  canonicalName = rawName,
  nameVi?: string
): Part => ({
  rawName,
  canonicalName,
  ...(nameVi ? { nameVi } : {}),
});

function results(...lists: V2MatchCandidate[][]): IngredientV2MatchResult[] {
  return lists.map((candidates, ingredientIndex) => ({
    ingredientIndex,
    candidates,
  }));
}

const ids = (r: IngredientV2MatchResult) =>
  r.candidates.map((c) => c.info.foodCompositionId);

const CHA_LA_LOT_ROW = row('nin_cha_la_lot', 'dish', [
  'Chả lá lốt, rán',
  'Fried pork rolls in betel leaves',
  'chả lá lốt',
]);
const LA_LOT_ROW = row('fao_la_lot', 'ingredient', ['Lá lốt']);
const PORK_ROW = row('fao_pork_minced', 'ingredient', ['Thịt lợn xay']);

describe('dropWholeDishRowsFromParts', () => {
  it('takes the whole-dish row off a part of that dish (VI)', () => {
    const decomposition = meal({
      name: 'Chả lá lốt',
      parts: [
        part('Thịt heo xay', 'Minced pork'),
        part('Lá lốt', 'Lolot leaves'),
        part('Trứng', 'Egg'),
        part('Dầu ăn', 'Cooking oil'),
      ],
    });
    const input = results(
      [PORK_ROW, CHA_LA_LOT_ROW],
      [CHA_LA_LOT_ROW, LA_LOT_ROW],
      [row('fao_egg', 'ingredient', ['Trứng gà'])],
      [row('fao_oil', 'ingredient', ['Dầu thực vật'])]
    );
    const out = dropWholeDishRowsFromParts(decomposition, input);
    expect(ids(out[0])).toEqual(['fao_pork_minced']);
    expect(ids(out[1])).toEqual(['fao_la_lot']);
    expect(out[2]).toBe(input[2]);
    // The input is not modified.
    expect(ids(input[1])).toEqual(['nin_cha_la_lot', 'fao_la_lot']);
  });

  it('takes the whole filled dumpling off its wrapper', () => {
    const decomposition = meal({
      name: 'Bánh giò',
      parts: [
        part('Vỏ bánh giò', 'Rice flour dough'),
        part('Nhân thịt', 'Pork filling'),
      ],
    });
    const banhGio = row('nin_banh_gio', 'dish', [
      'Bánh giò',
      'bánh giò (pyramid rice dumpling)',
      'pyramid rice dumpling',
    ]);
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [banhGio, row('fao_rice_flour', 'ingredient', ['Bột gạo tẻ'])],
        [PORK_ROW]
      )
    );
    expect(ids(out[0])).toEqual(['fao_rice_flour']);
  });

  it('works on English names, folded for case', () => {
    const decomposition = meal({
      name: 'Chicken Pot Pie',
      parts: [part('pie crust'), part('chicken'), part('peas')],
    });
    const pie = row('usda_pot_pie', 'dish', [
      'Chicken pot pie, frozen entree, prepared',
    ]);
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [pie, row('usda_crust', 'ingredient', ['Pie crust, baked'])],
        [pie, row('usda_chicken', 'ingredient', ['Chicken, roasted'])],
        [row('usda_peas', 'ingredient', ['Peas, green, cooked'])]
      )
    );
    expect(ids(out[0])).toEqual(['usda_crust']);
    expect(ids(out[1])).toEqual(['usda_chicken']);
  });

  it('keeps a dish row whose names miss a word of the dish name', () => {
    // "Bún chả giò": the fried spring roll row has no "bún".
    const decomposition = meal({
      name: 'Bún chả giò',
      parts: [part('Bún'), part('Chả giò'), part('Rau sống')],
    });
    const chaGio = row('nin_cha_gio', 'dish', ['Chả giò chiên', 'chả giò']);
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [row('fao_bun', 'ingredient', ['Bún'])],
        [chaGio],
        [row('fao_herbs', 'ingredient', ['Rau thơm'])]
      )
    );
    expect(ids(out[1])).toEqual(['nin_cha_gio']);
  });

  it('keeps an ingredient row even when its name covers the dish name', () => {
    const decomposition = meal({
      name: 'Gà luộc',
      parts: [part('Gà', 'Chicken'), part('Gừng', 'Ginger')],
    });
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [row('fao_chicken_boiled', 'ingredient', ['Thịt gà luộc'])],
        [row('fao_ginger', 'ingredient', ['Gừng'])]
      )
    );
    expect(ids(out[0])).toEqual(['fao_chicken_boiled']);
  });

  it('leaves a one-part dish alone (oil does not count as a part)', () => {
    const decomposition = meal({
      name: 'Chả lá lốt',
      parts: [part('Chả lá lốt'), part('Dầu ăn', 'Cooking oil')],
    });
    const input = results(
      [CHA_LA_LOT_ROW, LA_LOT_ROW],
      [row('fao_oil', 'ingredient', ['Dầu thực vật'])]
    );
    expect(dropWholeDishRowsFromParts(decomposition, input)).toEqual(input);
  });

  it('keeps the dish row on a part named as the dish itself', () => {
    const decomposition = meal(
      { name: 'Chả lá lốt', parts: [part('Chả lá lốt'), part('Bún')] },
      // A cooking word on the part: the row still names it.
      { name: 'Chả lá lốt', parts: [part('Chả lá lốt rán'), part('Bún')] },
      {
        name: 'Fried pork rolls',
        parts: [part('Chả', 'Fried pork rolls in betel leaves'), part('Bún')],
      }
    );
    const bun = row('fao_bun', 'ingredient', ['Bún']);
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [bun],
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [bun],
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [bun]
      )
    );
    for (const i of [0, 2, 4])
      expect(ids(out[i])).toEqual(['nin_cha_la_lot', 'fao_la_lot']);
  });

  it('keeps the dish row when only the Vietnamese name says it is the dish', () => {
    const decomposition = meal(
      {
        name: 'Chả lá lốt',
        parts: [
          part('Chả', 'Fried pork rolls in lolot leaves', 'chả lá lốt'),
          part('Bún', 'Rice vermicelli', 'bún'),
        ],
      },
      {
        name: 'Chả lá lốt',
        parts: [
          part('Lá lốt', 'Betel leaves', 'lá lốt'),
          part('Thịt heo xay', 'Ground pork', 'thịt heo xay'),
        ],
      }
    );
    const bun = row('fao_bun', 'ingredient', ['Bún']);
    const pork = row('usda_pork', 'ingredient', ['Thịt heo xay']);
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [bun],
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [pork]
      )
    );
    expect(ids(out[0])).toEqual(['nin_cha_la_lot', 'fao_la_lot']);
    // The leaf is still a part, whatever language its names are in.
    expect(ids(out[2])).toEqual(['fao_la_lot']);
  });

  it('never empties a list', () => {
    const decomposition = meal({
      name: 'Chả lá lốt',
      parts: [part('Lá lốt'), part('Thịt heo xay')],
    });
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results([CHA_LA_LOT_ROW], [PORK_ROW])
    );
    expect(ids(out[0])).toEqual(['nin_cha_la_lot']);
  });

  it('changes nothing for candidates without eatenState (an older artifact)', () => {
    const decomposition = meal({
      name: 'Chả lá lốt',
      parts: [part('Lá lốt'), part('Thịt heo xay')],
    });
    const oldDishRow = row('nin_cha_la_lot', undefined, ['Chả lá lốt, rán']);
    const input = results([oldDishRow, LA_LOT_ROW], [PORK_ROW]);
    expect(dropWholeDishRowsFromParts(decomposition, input)).toEqual(input);
  });

  it('lines results up with the right meal item across several items', () => {
    const decomposition = meal(
      { name: 'Cơm trắng', parts: [part('Cơm')] },
      {
        name: 'Chả lá lốt',
        parts: [part('Lá lốt'), part('Thịt heo xay')],
      }
    );
    const out = dropWholeDishRowsFromParts(
      decomposition,
      results(
        [row('fao_rice', 'ingredient', ['Cơm trắng'])],
        [CHA_LA_LOT_ROW, LA_LOT_ROW],
        [PORK_ROW]
      )
    );
    expect(ids(out[0])).toEqual(['fao_rice']);
    expect(ids(out[1])).toEqual(['fao_la_lot']);
    expect(ids(out[2])).toEqual(['fao_pork_minced']);
  });
});
