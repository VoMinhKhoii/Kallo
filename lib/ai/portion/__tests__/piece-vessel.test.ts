import { describe, expect, it } from 'vitest';
import type { PipelineMealItem } from '../../types';
import {
  PIECE_UNIT_TOKENS,
  type PieceDishLike,
  resolvePieceVessel,
} from '../piece-vessel';
import { nearestPieceTier, PIECE_TIERS, pieceAssetFor } from '../vessel-data';
import { attachVesselToMealItems } from '../vessel-envelope';

function item(
  ingredients: Array<{ name: string; grams: number; foodGroupEn?: string }>
): PipelineMealItem {
  return {
    name: ingredients.map(({ name }) => name).join(' + '),
    ingredients: ingredients.map(({ name, grams, foodGroupEn }) => ({
      ingredientName: name,
      foodCompositionId: null,
      foodGroupEn,
      estimatedGrams: grams,
      rawEquivalentGrams: grams,
      cookingMethod: null,
      userFacingUnit: null,
      matchConfidence: null,
      boundedNutrition: {
        caloriesKcal: { low: 0, mid: 0, high: 0 },
        proteinG: { low: 0, mid: 0, high: 0 },
        carbohydrateG: { low: 0, mid: 0, high: 0 },
        fatG: { low: 0, mid: 0, high: 0 },
      },
      displayedNutrition: {
        caloriesKcal: 0,
        proteinG: 0,
        carbohydrateG: 0,
        fatG: 0,
      },
    })),
    boundedNutrition: {
      caloriesKcal: { low: 0, mid: 0, high: 0 },
      proteinG: { low: 0, mid: 0, high: 0 },
      carbohydrateG: { low: 0, mid: 0, high: 0 },
      fatG: { low: 0, mid: 0, high: 0 },
    },
    displayedNutrition: {
      caloriesKcal: 0,
      proteinG: 0,
      carbohydrateG: 0,
      fatG: 0,
    },
  } as unknown as PipelineMealItem;
}

function dish(ingredients: PieceDishLike['ingredients']): PieceDishLike & {
  name: string;
  cookingMethod: string;
} {
  return { name: 'dish', cookingMethod: 'cooked', ingredients };
}

describe('resolvePieceVessel', () => {
  it('classifies one salmon piece at 160 g as protein tier 3', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'cá hồi', grams: 160 }]),
        dish([
          {
            rawName: 'cá hồi',
            canonicalName: 'salmon',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toEqual({
      family: 'piece',
      tier: 3,
      count: 1,
      kind: 'fish',
      provenance: 'piece_prior',
    });
  });

  it('classifies two fish cuts at 150 g each as tier 3', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'cá kho', grams: 300 }]),
        dish([
          {
            rawName: 'cá kho',
            canonicalName: 'fish',
            count: 2,
            unitToken: 'khứa',
          },
        ])
      )
    ).toMatchObject({ family: 'piece', tier: 3, count: 2 });
  });

  it('rejects fish below the 85% dominance threshold', () => {
    expect(
      resolvePieceVessel(
        item([
          { name: 'cơm', grams: 180 },
          { name: 'cá', grams: 120 },
        ]),
        dish([
          { rawName: 'cơm' },
          { rawName: 'cá', count: 1, unitToken: 'miếng' },
        ])
      )
    ).toBeNull();
  });

  it.each([
    ['gà nướng', 'chicken', 2],
    ['tôm nướng', 'shrimp', 1],
  ])('classifies animal protein %s', (rawName, canonicalName, count) => {
    expect(
      resolvePieceVessel(
        item([{ name: rawName, grams: 150 * count }]),
        dish([{ rawName, canonicalName, count, unitToken: 'miếng' }])
      )
    ).toMatchObject({
      family: 'piece',
      tier: 3,
      count,
      kind: canonicalName === 'shrimp' ? 'fish' : 'poultry',
    });
  });

  it('uses the matched DB group to classify poultry', () => {
    expect(
      resolvePieceVessel(
        item([
          {
            name: 'gà nướng',
            grams: 150,
            foodGroupEn: 'Poultry Products',
          },
        ]),
        dish([
          {
            rawName: 'gà nướng',
            canonicalName: 'chicken',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ kind: 'poultry' });
  });

  it.each([
    ['thịt gà', 'chicken', 'poultry'],
    ['thịt bò', 'beef', 'meat'],
    ['thịt vịt', 'duck', 'poultry'],
  ] as const)('refines the coarse FAO meat group for %s', (rawName, canonicalName, kind) => {
    expect(
      resolvePieceVessel(
        item([
          {
            name: rawName,
            grams: 150,
            foodGroupEn: 'Meat and meat products',
          },
        ]),
        dish([
          {
            rawName,
            canonicalName,
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ kind });
  });

  it('vetoes processed sausage even when the name matches the meat lexicon', () => {
    expect(
      resolvePieceVessel(
        item([
          {
            name: 'chả lụa',
            grams: 140,
            foodGroupEn: 'Sausages and Luncheon Meats',
          },
        ]),
        dish([
          {
            rawName: 'chả lụa',
            canonicalName: 'thịt',
            count: 2,
            unitToken: 'miếng',
          },
        ])
      )
    ).toBeNull();
  });

  it('rejects a matched non-protein food group with a piece token', () => {
    expect(
      resolvePieceVessel(
        item([
          {
            name: 'cá giả chay',
            grams: 150,
            foodGroupEn: 'Vegetables and Vegetable Products',
          },
        ]),
        dish([
          {
            rawName: 'cá giả chay',
            canonicalName: 'fish-style vegetable',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toBeNull();
  });

  it('falls back to the fish lexicon for an unmatched ingredient', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'cá thu', grams: 150 }]),
        dish([
          {
            rawName: 'cá thu',
            canonicalName: 'mackerel',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ kind: 'fish' });
  });

  it('falls back to the poultry lexicon for an unmatched ingredient', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'vịt quay', grams: 150 }]),
        dish([
          {
            rawName: 'vịt quay',
            canonicalName: 'roast duck',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ kind: 'poultry' });
  });

  it('rejects plant protein even with a piece token', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'đậu hũ chiên', grams: 160 }]),
        dish([
          {
            rawName: 'đậu hũ chiên',
            canonicalName: 'fried tofu',
            count: 2,
            unitToken: 'miếng',
          },
        ])
      )
    ).toBeNull();
  });

  it('classifies a 250 g beef steak as meat tier 4', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'bò bít tết', grams: 250 }]),
        dish([
          {
            rawName: 'bò bít tết',
            canonicalName: 'beef steak',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ family: 'piece', tier: 4, count: 1, kind: 'meat' });
  });

  it.each([
    ['Salmon fillet', 'Salmon', 'fish'],
    ['Steak', 'Beef steak', 'meat'],
  ] as const)('recovers a trailing high-variance cut unit from %s', (rawName, canonicalName, kind) => {
    expect(
      resolvePieceVessel(
        item([{ name: rawName, grams: 250 }]),
        dish([{ rawName, canonicalName, count: 1 }])
      )
    ).toMatchObject({ family: 'piece', tier: 4, count: 1, kind });
  });

  it.each([
    ['Beef burger', 'Beef burger'],
    ['Chicken thigh', 'Chicken thigh'],
    ['Greens', 'Leafy greens'],
  ])('does not invent a piece vessel for %s', (rawName, canonicalName) => {
    expect(
      resolvePieceVessel(
        item([{ name: rawName, grams: 150 }]),
        dish([{ rawName, canonicalName, count: 1 }])
      )
    ).toBeNull();
  });

  it('requires a preserved count and does not override an explicit unit', () => {
    const mealItem = item([{ name: 'Salmon fillet', grams: 250 }]);
    expect(
      resolvePieceVessel(
        mealItem,
        dish([{ rawName: 'Salmon fillet', canonicalName: 'Salmon' }])
      )
    ).toBeNull();
    expect(
      resolvePieceVessel(
        mealItem,
        dish([
          {
            rawName: 'Salmon fillet',
            canonicalName: 'Salmon',
            count: 1,
            unitToken: 'serving',
          },
        ])
      )
    ).toBeNull();
  });

  it('joins the dominant pipeline ingredient by name after an index shift', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'ca hoi', grams: 160 }]),
        dish([
          { rawName: 'cơm', count: 2, unitToken: 'miếng' },
          {
            rawName: 'cá hồi',
            canonicalName: 'salmon',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toMatchObject({ family: 'piece', tier: 3, count: 1 });
  });

  it('returns null when the dominant pipeline ingredient has no name match', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'cá hồi', grams: 160 }]),
        dish([
          {
            rawName: 'cá thu',
            canonicalName: 'mackerel',
            count: 1,
            unitToken: 'miếng',
          },
        ])
      )
    ).toBeNull();
  });

  it('returns null when multiple dish ingredients match the dominant name', () => {
    expect(
      resolvePieceVessel(
        item([{ name: 'cá hồi', grams: 160 }]),
        dish([
          { rawName: 'cá hồi', count: 1, unitToken: 'miếng' },
          { canonicalName: 'ca hoi', count: 2, unitToken: 'khúc' },
        ])
      )
    ).toBeNull();
  });

  it('does not replace an existing container vessel', () => {
    const mealItem = item([{ name: 'cá hồi', grams: 160 }]);
    mealItem.vessel = {
      family: 'plate',
      tier: 2,
      dishClass: 'solid',
      provenance: 'vessel_prior',
    };

    expect(
      resolvePieceVessel(
        mealItem,
        dish([{ rawName: 'cá hồi', count: 1, unitToken: 'miếng' }])
      )
    ).toBeNull();
  });

  it('does not attach a piece vessel to a misaligned meal item', () => {
    const mealItem = item([{ name: 'cá hồi', grams: 160 }]);
    const source = dish([{ rawName: 'cá hồi', count: 1, unitToken: 'miếng' }]);
    mealItem.name = 'different dish';

    attachVesselToMealItems([mealItem], [source], [null]);

    expect(mealItem.vessel).toBeUndefined();
  });
});

describe('nearestPieceTier', () => {
  it('chooses the lower tier at an exact midpoint and clamps high values', () => {
    expect(nearestPieceTier(50)).toBe(1);
    expect(nearestPieceTier(500)).toBe(5);
    expect(nearestPieceTier(900)).toBe(5);
  });

  it('selects the fish and meat silhouette families', () => {
    expect(pieceAssetFor(PIECE_TIERS[2], 'fish')).toEqual({
      file: 'fish-3-khoanh.webp',
      aspect: 1.29,
    });
    expect(pieceAssetFor(PIECE_TIERS[2], 'meat')).toEqual({
      file: 'meat-3-chop.webp',
      aspect: 0.82,
    });
  });

  it('selects the poultry silhouette for every tier', () => {
    expect(PIECE_TIERS.map((tier) => pieceAssetFor(tier, 'poultry'))).toEqual([
      { file: 'poultry-1-chunk.webp', aspect: 1.02 },
      { file: 'poultry-2-wing.webp', aspect: 0.95 },
      { file: 'poultry-3-drumstick.webp', aspect: 0.49 },
      { file: 'poultry-4-breast.webp', aspect: 0.58 },
      { file: 'poultry-5-quarter.webp', aspect: 1.03 },
    ]);
  });

  it('documents the exact normalized cut-token allowlist', () => {
    expect([...PIECE_UNIT_TOKENS]).toEqual([
      'mieng',
      'lat',
      'khuc',
      'khua',
      'khoanh',
      'phi le',
      'cuc',
      'fillet',
      'piece',
      'pieces',
      'slice',
      'slices',
      'steak',
      'steaks',
      'fillets',
      'filet',
      'filets',
      'chunk',
      'chunks',
      'cut',
      'cuts',
    ]);
  });
});
