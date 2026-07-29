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
});
