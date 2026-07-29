import { describe, expect, it } from 'vitest';
import type { VesselEnvelope } from '../../portion/vessel-envelope';
import { buildCallTwoPayload } from '../grounded-support';
import type { MealDecompositionV2 } from '../schemas-v2';

describe('grounded vessel threading', () => {
  it('attaches envelopes to meal items by decomposition index', () => {
    const decomposition: MealDecompositionV2 = {
      isFood: true,
      mealSlot: 'lunch',
      mealItems: [
        {
          name: 'phở',
          cookingMethod: 'ninh',
          vesselToken: 'tô',
          ingredients: [{ rawName: 'bánh phở', canonicalName: 'Bánh phở' }],
        },
        {
          name: 'gà luộc',
          cookingMethod: 'luộc',
          ingredients: [{ rawName: 'gà', canonicalName: 'Gà' }],
        },
      ],
    };
    const envelope: VesselEnvelope = {
      family: 'bowl',
      tier: 2,
      dishClass: 'soup',
      token: 'tô',
      vesselMl: 700,
      guardG: { low: 470, high: 730 },
      midG: 595,
    };

    const payload = buildCallTwoPayload(
      decomposition,
      [],
      [null, null],
      [envelope, null]
    );

    expect(payload.map((item) => item.vesselEnvelope)).toEqual([
      envelope,
      null,
    ]);
  });
});
