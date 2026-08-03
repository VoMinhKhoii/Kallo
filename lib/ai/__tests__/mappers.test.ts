import { describe, expect, it } from 'vitest';
import { toParsedMeal } from '../mappers';
import type { PipelineResult } from '../types';
import { NULL_BOUNDED_NUTRITION, NULL_NUTRITION_VALUES } from './test-helpers';

function pipelineResult(
  vessel?: PipelineResult['mealItems'][number]['vessel']
): PipelineResult {
  return {
    mealItems: [
      {
        name: 'Phở bò',
        ingredients: [
          {
            ingredientName: 'Phở bò',
            foodCompositionId: null,
            estimatedGrams: 500,
            rawEquivalentGrams: 500,
            cookingMethod: null,
            userFacingUnit: null,
            matchConfidence: null,
            boundedNutrition: NULL_BOUNDED_NUTRITION,
            displayedNutrition: NULL_NUTRITION_VALUES,
          },
        ],
        boundedNutrition: NULL_BOUNDED_NUTRITION,
        displayedNutrition: NULL_NUTRITION_VALUES,
        vessel,
      },
    ],
    mealSlot: 'lunch',
    confidenceOverall: 'medium',
    boundedNutrition: NULL_BOUNDED_NUTRITION,
    displayedNutrition: NULL_NUTRITION_VALUES,
    unmatchedIngredients: [],
  };
}

describe('toParsedMeal vessel mapping', () => {
  it('passes through only client vessel fields and keeps grams as the unit', () => {
    const parsed = toParsedMeal(
      pipelineResult(
        // Round-tripped through JSON to model a legacy `pending_analyses` row:
        // staged before token/guardG/midG left PipelineVessel, so it still
        // carries them. The mapper must ignore the extras, not choke on them.
        JSON.parse(
          JSON.stringify({
            family: 'bowl',
            tier: 3,
            dishClass: 'soup',
            token: 'tô',
            guardG: { low: 680, high: 1050 },
            midG: 850,
            provenance: 'vessel_prior',
          })
        )
      )
    );

    expect(parsed.items[0]).toMatchObject({
      unit: 'g',
      vessel: { family: 'bowl', tier: 3, dishClass: 'soup' },
    });
    expect(parsed.items[0]?.vessel).not.toHaveProperty('token');
    expect(parsed.items[0]?.vessel).not.toHaveProperty('guardG');
    expect(parsed.items[0]?.vessel).not.toHaveProperty('midG');
  });

  it('leaves vessel undefined for legacy results', () => {
    const parsed = toParsedMeal(pipelineResult());

    expect(parsed.items[0]?.unit).toBe('g');
    expect(parsed.items[0]?.vessel).toBeUndefined();
  });

  it('passes real piece vessel metadata through', () => {
    const parsed = toParsedMeal(
      pipelineResult({
        family: 'piece',
        tier: 3,
        count: 2,
        kind: 'fish',
        provenance: 'piece_prior',
      })
    );

    expect(parsed.items[0]?.vessel).toEqual({
      family: 'piece',
      tier: 3,
      count: 2,
      kind: 'fish',
    });
  });

  // The vessel is a decoration; it must never be able to break the dish it
  // decorates. Both clients build an envelope from it and clamp the dish's
  // grams into that range, so an out-of-range value does real damage: a
  // negative count throws in Flutter's `clamp` and shows a -600 g portion on
  // web, and a huge one stages a multi-billion-gram meal for confirmation.
  // Dropping it here is the correct degradation — the dish just shows no
  // portion line — and it covers restored `pending_analyses` rows too, since
  // `loadPendingAnalysesByDate` re-runs this mapper on read.
  describe('drops vessels a picker cannot safely render', () => {
    const unusable = [
      { label: 'zero count', count: 0 },
      { label: 'negative count', count: -1 },
      { label: 'fractional-but-below-one count', count: 0.5 },
      { label: 'absurd count', count: 1e9 },
      { label: 'NaN count', count: Number.NaN },
      { label: 'infinite count', count: Number.POSITIVE_INFINITY },
    ];

    for (const { label, count } of unusable) {
      it(`drops a piece vessel with a ${label}`, () => {
        const parsed = toParsedMeal(
          pipelineResult({
            family: 'piece',
            tier: 3,
            count,
            kind: 'fish',
            provenance: 'piece_prior',
          })
        );
        expect(parsed.items[0]?.vessel).toBeUndefined();
      });
    }

    it('drops a vessel whose tier is outside its family table', () => {
      // `VESSEL_FAMILIES.bowl.tiers[9]` is undefined; reading `.asset` off it
      // throws while rendering the assumption line.
      const parsed = toParsedMeal(
        pipelineResult({
          family: 'bowl',
          tier: 9 as 1,
          dishClass: 'soup',
          provenance: 'vessel_prior',
        })
      );
      expect(parsed.items[0]?.vessel).toBeUndefined();
    });

    it('keeps the fractional counts the prompt legitimately emits', () => {
      // "một lát rưỡi" → 1.5. Valid, and both clients must render it.
      const parsed = toParsedMeal(
        pipelineResult({
          family: 'piece',
          tier: 3,
          count: 1.5,
          kind: 'fish',
          provenance: 'piece_prior',
        })
      );
      expect(parsed.items[0]?.vessel).toEqual({
        family: 'piece',
        tier: 3,
        count: 1.5,
        kind: 'fish',
      });
    });
  });
});
