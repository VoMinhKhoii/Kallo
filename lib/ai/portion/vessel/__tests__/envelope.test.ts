import { describe, expect, it } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__fixtures__/test-helpers';
import {
  type DishClass,
  PIECE_TIERS,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import {
  attachVesselToMealItems,
  classifyDishClass,
  type DishLike,
  resolveVesselEnvelope,
} from '@/lib/ai/portion/vessel/envelope';
import {
  guardBandG,
  midG,
  normalizeVesselToken,
  resolveVesselFromToken,
} from '@/lib/ai/portion/vessel/geometry';
import type { PipelineMealItem } from '@/lib/ai/types/result';

const dish = (overrides: Partial<DishLike> = {}): DishLike => ({
  name: 'test dish',
  ingredients: [],
  ...overrides,
});

const mealItem = (name: string): PipelineMealItem => ({
  name,
  ingredients: [],
  boundedNutrition: NULL_BOUNDED_NUTRITION,
  displayedNutrition: NULL_NUTRITION_VALUES,
});

describe('vessel token resolution', () => {
  it('normalizes case and Vietnamese diacritics', () => {
    expect(normalizeVesselToken(' TÔ ')).toBe('to');
    expect(normalizeVesselToken('dĩa')).toBe('dia');
    expect(normalizeVesselToken('đĩa')).toBe('dia');
    expect(resolveVesselFromToken('Bowl')).toEqual({
      family: 'bowl',
      tier: 2,
    });
  });

  it('shifts and clamps tiers from the bare-token default', () => {
    expect(resolveVesselFromToken('chén', 'small')?.tier).toBe(1);
    expect(resolveVesselFromToken('chén', 'large')?.tier).toBe(2);
    expect(resolveVesselFromToken('tô', 'small')?.tier).toBe(1);
    expect(resolveVesselFromToken('tô', 'large')?.tier).toBe(3);
    expect(resolveVesselFromToken('tách', 'small')?.tier).toBe(1);
  });

  it.each(['bathtub', 'jar'])('returns null for unknown token %s', (token) => {
    expect(resolveVesselFromToken(token)).toBeNull();
  });
});

describe('piece tier assets', () => {
  it('uses the species-neutral five-tier ladder', () => {
    expect(
      PIECE_TIERS.map(({ grams, sizeLabel, label }) => ({
        grams,
        sizeLabel,
        label,
      }))
    ).toEqual([
      {
        grams: 30,
        sizeLabel: '30 g',
        label: { vi: 'miếng nhỏ', en: 'small piece' },
      },
      {
        grams: 70,
        sizeLabel: '70 g',
        label: { vi: 'lát', en: 'slice' },
      },
      {
        grams: 150,
        sizeLabel: '150 g',
        label: { vi: 'miếng vừa', en: 'medium cut' },
      },
      {
        grams: 250,
        sizeLabel: '250 g',
        label: { vi: 'phi lê', en: 'fillet' },
      },
      {
        grams: 500,
        sizeLabel: '500 g',
        label: { vi: 'phần lớn', en: 'large cut' },
      },
    ]);
  });

  it('matches the generated portion filenames', () => {
    expect(PIECE_TIERS.map((tier) => tier.assets)).toEqual([
      [
        { file: 'fish-1-chunk.webp', aspect: 1.06 },
        { file: 'meat-1-cubes.webp', aspect: 1.83 },
        { file: 'poultry-1-chunk.webp', aspect: 1.02 },
      ],
      [
        { file: 'fish-2-lat.webp', aspect: 2.19 },
        { file: 'meat-2-belly-slices.webp', aspect: 1.28 },
        { file: 'poultry-2-wing.webp', aspect: 0.95 },
      ],
      [
        { file: 'fish-3-khoanh.webp', aspect: 1.29 },
        { file: 'meat-3-chop.webp', aspect: 0.82 },
        { file: 'poultry-3-drumstick.webp', aspect: 0.49 },
      ],
      [
        { file: 'fish-4-portion.webp', aspect: 2.17 },
        { file: 'meat-4-steak.webp', aspect: 0.74 },
        { file: 'poultry-4-breast.webp', aspect: 0.58 },
      ],
      [
        { file: 'fish-5-large.webp', aspect: 2.17 },
        { file: 'meat-5-big-steak.webp', aspect: 0.72 },
        { file: 'poultry-5-quarter.webp', aspect: 1.03 },
      ],
    ]);
  });
});

describe('dish classification', () => {
  it.each([
    ['phở', 'bowl', 'soup'],
    ['beef ramen', 'bowl', 'soup'],
    ['cơm tấm', 'plate', 'solid'],
    ['gỏi cuốn', 'plate', 'airy'],
    ['trà sữa', 'cup', 'drink'],
    ['cup noodles', 'cup', 'soup'],
    ['mug cake', 'cup', 'solid'],
    ['cereal with milk', 'bowl', 'solid'],
    // "1 tô mì gói" classified `solid` and drew a dense-food gram band for
    // what is mostly broth. The qualified instant-noodle forms are soup; the
    // bare `mì` ones are deliberately not, since mì xào / mì khô are dry.
    ['mì gói', 'bowl', 'soup'],
    ['mì gói sữa', 'bowl', 'soup'],
    ['mì tôm trứng', 'bowl', 'soup'],
    ['mì ăn liền', 'bowl', 'soup'],
    ['mi goi', 'bowl', 'soup'],
    ['instant noodles with egg', 'bowl', 'soup'],
    ['mì xào giòn', 'plate', 'solid'],
    ['mì Quảng khô', 'bowl', 'solid'],
  ] as const)('%s in a %s is %s', (name, family, expected) => {
    expect(classifyDishClass(dish({ name }), family)).toBe(expected);
  });
});

describe('vessel gram envelopes', () => {
  const families = ['bowl', 'plate', 'cup'] as const;
  const tiers: VesselTier[] = [1, 2, 3, 4];
  const classes: DishClass[] = ['soup', 'solid', 'airy', 'drink'];

  it('matches the full family, tier, and dish-class guard-band table', () => {
    const table = Object.fromEntries(
      families.map((family) => [
        family,
        Object.fromEntries(
          tiers.map((tier) => [
            tier,
            Object.fromEntries(
              classes.map((dishClass) => [
                dishClass,
                guardBandG(family, tier, dishClass),
              ])
            ),
          ])
        ),
      ])
    );

    expect(table).toMatchInlineSnapshot(`
      {
        "bowl": {
          "1": {
            "airy": {
              "high": 240,
              "low": 80,
            },
            "drink": {
              "high": 420,
              "low": 320,
            },
            "solid": {
              "high": 320,
              "low": 140,
            },
            "soup": {
              "high": 420,
              "low": 270,
            },
          },
          "2": {
            "airy": {
              "high": 420,
              "low": 150,
            },
            "drink": {
              "high": 740,
              "low": 570,
            },
            "solid": {
              "high": 570,
              "low": 250,
            },
            "soup": {
              "high": 730,
              "low": 470,
            },
          },
          "3": {
            "airy": {
              "high": 600,
              "low": 210,
            },
            "drink": {
              "high": 1050,
              "low": 810,
            },
            "solid": {
              "high": 810,
              "low": 360,
            },
            "soup": {
              "high": 1050,
              "low": 680,
            },
          },
          "4": {
            "airy": {
              "high": 780,
              "low": 270,
            },
            "drink": {
              "high": 1370,
              "low": 1050,
            },
            "solid": {
              "high": 1050,
              "low": 470,
            },
            "soup": {
              "high": 1360,
              "low": 880,
            },
          },
        },
        "cup": {
          "1": {
            "airy": {
              "high": 90,
              "low": 30,
            },
            "drink": {
              "high": 160,
              "low": 120,
            },
            "solid": {
              "high": 120,
              "low": 50,
            },
            "soup": {
              "high": 160,
              "low": 100,
            },
          },
          "2": {
            "airy": {
              "high": 150,
              "low": 50,
            },
            "drink": {
              "high": 260,
              "low": 200,
            },
            "solid": {
              "high": 200,
              "low": 90,
            },
            "soup": {
              "high": 260,
              "low": 170,
            },
          },
          "3": {
            "airy": {
              "high": 300,
              "low": 110,
            },
            "drink": {
              "high": 530,
              "low": 400,
            },
            "solid": {
              "high": 410,
              "low": 180,
            },
            "soup": {
              "high": 520,
              "low": 340,
            },
          },
          "4": {
            "airy": {
              "high": 420,
              "low": 150,
            },
            "drink": {
              "high": 740,
              "low": 570,
            },
            "solid": {
              "high": 570,
              "low": 250,
            },
            "soup": {
              "high": 730,
              "low": 470,
            },
          },
        },
        "plate": {
          "1": {
            "airy": {
              "high": 250,
              "low": 90,
            },
            "drink": {
              "high": 440,
              "low": 340,
            },
            "solid": {
              "high": 340,
              "low": 150,
            },
            "soup": {
              "high": 440,
              "low": 280,
            },
          },
          "2": {
            "airy": {
              "high": 400,
              "low": 140,
            },
            "drink": {
              "high": 690,
              "low": 530,
            },
            "solid": {
              "high": 530,
              "low": 240,
            },
            "soup": {
              "high": 690,
              "low": 450,
            },
          },
          "3": {
            "airy": {
              "high": 620,
              "low": 220,
            },
            "drink": {
              "high": 1080,
              "low": 830,
            },
            "solid": {
              "high": 830,
              "low": 370,
            },
            "soup": {
              "high": 1080,
              "low": 700,
            },
          },
          "4": {
            "airy": {
              "high": 890,
              "low": 310,
            },
            "drink": {
              "high": 1550,
              "low": 1200,
            },
            "solid": {
              "high": 1200,
              "low": 530,
            },
            "soup": {
              "high": 1550,
              "low": 1000,
            },
          },
        },
      }
    `);
  });

  it('increases mid grams monotonically with vessel tier', () => {
    for (const family of families) {
      for (const dishClass of classes) {
        const mids = tiers.map((tier) => midG(family, tier, dishClass));
        expect(mids).toEqual([...mids].sort((a, b) => a - b));
        expect(new Set(mids).size).toBe(tiers.length);
      }
    }
  });

  it('returns no envelope when any dish ingredient has a zero count', () => {
    expect(
      resolveVesselEnvelope(
        dish({
          vesselToken: 'tô',
          ingredients: [{ rawName: 'phở', count: 0 }],
        })
      )
    ).toBeNull();
  });
});

describe('attachVesselToMealItems', () => {
  it('aligns by index and skips absent or unknown vessels', () => {
    const dishes = [
      dish({ name: 'phở', vesselToken: 'tô' }),
      dish({ name: 'second', vesselToken: 'jar' }),
      dish({ name: 'third' }),
    ];
    const mealItems = [mealItem('PHỞ'), mealItem('second'), mealItem('third')];
    attachVesselToMealItems(
      mealItems,
      dishes,
      dishes.map(resolveVesselEnvelope)
    );

    expect(mealItems[0].vessel).toMatchObject({
      family: 'bowl',
      tier: 2,
      dishClass: 'soup',
    });
    expect(mealItems[1]).not.toHaveProperty('vessel');
    expect(mealItems[2]).not.toHaveProperty('vessel');
  });

  it('skips envelopes when result items are in a mismatched order', () => {
    const dishes = [
      dish({ name: 'phở', vesselToken: 'tô' }),
      dish({ name: 'cơm tấm', vesselToken: 'đĩa' }),
    ];
    const mealItems = [mealItem('cơm tấm'), mealItem('phở')];

    attachVesselToMealItems(
      mealItems,
      dishes,
      dishes.map(resolveVesselEnvelope)
    );

    expect(mealItems.every((item) => !('vessel' in item))).toBe(true);
  });
});

/**
 * Regression from a real capture of Call 1 for
 * "3 piece of salmon + 2 steaks + 1 cup of milk + 1 plate of spaghetti":
 *
 *   Salmon    count 3, unitToken "piece",  vesselToken —
 *   Steaks    count 2, unitToken "steaks", vesselToken —
 *   Milk      count 1, unitToken "cup",    vesselToken —
 *   Spaghetti count —, unitToken —,        vesselToken "plate"
 *
 * The model put the container word on the DISH for spaghetti and on the
 * INGREDIENT for milk. Only spaghetti got a portion affordance; milk fell
 * through both resolvers and showed nothing.
 */
describe('container word on the ingredient instead of the dish', () => {
  const milk = {
    name: 'Milk',
    ingredients: [{ canonicalName: 'Milk', count: 1, unitToken: 'cup' }],
  };

  it('resolves a cup that Call 1 attached to the ingredient', () => {
    const envelope = resolveVesselEnvelope(milk);
    expect(envelope?.family).toBe('cup');
    // Milk in a cup is a drink, not food served in a cup.
    expect(envelope?.dishClass).toBe('drink');
    expect(envelope?.token).toBe('cup');
  });

  it('still prefers an explicit dish vessel when both are present', () => {
    const envelope = resolveVesselEnvelope({
      name: 'Cơm',
      vesselToken: 'chén',
      ingredients: [{ canonicalName: 'Cơm', count: 1, unitToken: 'cup' }],
    });
    expect(envelope?.family).toBe('bowl');
    expect(envelope?.token).toBe('chén');
  });

  it('never promotes a piece or mass unit to a vessel', () => {
    for (const unitToken of ['steaks', 'piece', 'g', 'slice']) {
      expect(
        resolveVesselEnvelope({
          name: 'Steaks',
          ingredients: [{ canonicalName: 'Beef steak', count: 2, unitToken }],
        }),
        unitToken
      ).toBeNull();
    }
  });

  it('ignores a multi-serving ingredient, whose grams outrun one vessel', () => {
    // The envelope's guard band and midG describe ONE cup, but "3 cups of
    // milk" is three of them. Promoting it would fit a ~720 g total into a
    // one-cup band and tell the estimator the portion is far too small — worse
    // than the no-affordance behaviour this promotion path exists to fix.
    expect(
      resolveVesselEnvelope({
        name: 'Milk',
        ingredients: [{ canonicalName: 'Milk', count: 3, unitToken: 'cup' }],
      })
    ).toBeNull();
  });

  it('still promotes a fractional serving', () => {
    // Half a cup is inside a one-cup envelope, so the guard band still holds.
    expect(
      resolveVesselEnvelope({
        name: 'Milk',
        ingredients: [{ canonicalName: 'Milk', count: 0.5, unitToken: 'cup' }],
      })?.family
    ).toBe('cup');
  });

  it('ignores a composed dish where one ingredient is measured in cups', () => {
    // "phở with a cup of broth" says nothing about what the DISH was served in.
    expect(
      resolveVesselEnvelope({
        name: 'Phở bò',
        ingredients: [
          { canonicalName: 'Nước dùng', count: 1, unitToken: 'cup' },
          { canonicalName: 'Bánh phở' },
        ],
      })
    ).toBeNull();
  });
});
