import { describe, expect, it } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '@/lib/ai/__fixtures__/test-helpers';
import { riceBowlFor } from '@/lib/ai/portion/data/rice-bowls';
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
              "high": 200,
              "low": 40,
            },
            "drink": {
              "high": 310,
              "low": 170,
            },
            "solid": {
              "high": 260,
              "low": 110,
            },
            "soup": {
              "high": 280,
              "low": 170,
            },
          },
          "2": {
            "airy": {
              "high": 460,
              "low": 100,
            },
            "drink": {
              "high": 720,
              "low": 400,
            },
            "solid": {
              "high": 600,
              "low": 250,
            },
            "soup": {
              "high": 640,
              "low": 400,
            },
          },
          "3": {
            "airy": {
              "high": 650,
              "low": 140,
            },
            "drink": {
              "high": 1030,
              "low": 570,
            },
            "solid": {
              "high": 860,
              "low": 360,
            },
            "soup": {
              "high": 920,
              "low": 570,
            },
          },
          "4": {
            "airy": {
              "high": 980,
              "low": 210,
            },
            "drink": {
              "high": 1540,
              "low": 860,
            },
            "solid": {
              "high": 1280,
              "low": 540,
            },
            "soup": {
              "high": 1380,
              "low": 860,
            },
          },
        },
        "cup": {
          "1": {
            "airy": {
              "high": 100,
              "low": 20,
            },
            "drink": {
              "high": 150,
              "low": 90,
            },
            "solid": {
              "high": 130,
              "low": 50,
            },
            "soup": {
              "high": 140,
              "low": 90,
            },
          },
          "2": {
            "airy": {
              "high": 200,
              "low": 40,
            },
            "drink": {
              "high": 310,
              "low": 170,
            },
            "solid": {
              "high": 260,
              "low": 110,
            },
            "soup": {
              "high": 280,
              "low": 170,
            },
          },
          "3": {
            "airy": {
              "high": 330,
              "low": 70,
            },
            "drink": {
              "high": 510,
              "low": 290,
            },
            "solid": {
              "high": 430,
              "low": 180,
            },
            "soup": {
              "high": 460,
              "low": 290,
            },
          },
          "4": {
            "airy": {
              "high": 460,
              "low": 100,
            },
            "drink": {
              "high": 720,
              "low": 400,
            },
            "solid": {
              "high": 600,
              "low": 250,
            },
            "soup": {
              "high": 640,
              "low": 400,
            },
          },
        },
        "plate": {
          "1": {
            "airy": {
              "high": 160,
              "low": 40,
            },
            "drink": {
              "high": 260,
              "low": 140,
            },
            "solid": {
              "high": 210,
              "low": 90,
            },
            "soup": {
              "high": 230,
              "low": 140,
            },
          },
          "2": {
            "airy": {
              "high": 360,
              "low": 80,
            },
            "drink": {
              "high": 560,
              "low": 310,
            },
            "solid": {
              "high": 470,
              "low": 200,
            },
            "soup": {
              "high": 500,
              "low": 310,
            },
          },
          "3": {
            "airy": {
              "high": 550,
              "low": 120,
            },
            "drink": {
              "high": 870,
              "low": 480,
            },
            "solid": {
              "high": 730,
              "low": 310,
            },
            "soup": {
              "high": 780,
              "low": 480,
            },
          },
          "4": {
            "airy": {
              "high": 780,
              "low": 170,
            },
            "drink": {
              "high": 1230,
              "low": 680,
            },
            "solid": {
              "high": 1030,
              "low": 430,
            },
            "soup": {
              "high": 1100,
              "low": 680,
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

describe("the dish's own count", () => {
  const pho = (extra: Partial<DishLike>) =>
    resolveVesselEnvelope(
      dish({
        name: 'phở bò',
        vesselToken: 'tô',
        ingredients: [{ rawName: 'bánh phở' }, { rawName: 'thịt bò' }],
        ...extra,
      })
    );

  it('scales the band by dishCount in the vessel word', () => {
    const one = pho({});
    const two = pho({ dishCount: { count: 2, unitToken: 'tô' } });
    const half = pho({ dishCount: { count: 0.5, unitToken: 'tô' } });
    expect(one?.servings).toBe(1);
    expect(two?.servings).toBe(2);
    expect(two?.midG).toBe(Math.round((one?.midG ?? 0) * 2));
    expect(two?.guardG.high).toBe(Math.round((one?.guardG.high ?? 0) * 2));
    expect(half?.servings).toBe(0.5);
    expect(half?.midG).toBe(Math.round((one?.midG ?? 0) * 0.5));
  });

  it('reads a bowl word of the same family as the vessel count', () => {
    expect(pho({ dishCount: { count: 2, unitToken: 'bowl' } })?.servings).toBe(
      2
    );
    expect(pho({ dishCount: { count: 2, unitToken: 'bowls' } })?.servings).toBe(
      2
    );
  });

  it('ignores a dish count in another word, and falls back to the parts', () => {
    expect(pho({ dishCount: { count: 2, unitToken: 'phần' } })?.servings).toBe(
      1
    );
    expect(
      pho({
        ingredients: [
          { rawName: 'bánh phở', count: 2, unitToken: 'tô' },
          { rawName: 'thịt bò', count: 2, unitToken: 'tô' },
        ],
      })?.servings
    ).toBe(2);
  });

  it('hands the picker the count, and leaves it out for one', () => {
    const dishes = [
      dish({
        name: 'phở',
        vesselToken: 'tô',
        dishCount: { count: 2, unitToken: 'tô' },
        ingredients: [{ rawName: 'bánh phở' }, { rawName: 'thịt bò' }],
      }),
      dish({ name: 'bún', vesselToken: 'tô' }),
    ];
    const items = [mealItem('phở'), mealItem('bún')];
    attachVesselToMealItems(
      items,
      dishes,
      dishes.map((d) => resolveVesselEnvelope(d))
    );
    expect(items[0].vessel).toMatchObject({ family: 'bowl', count: 2 });
    expect(items[1].vessel).not.toHaveProperty('count');
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
      dishes.map((d) => resolveVesselEnvelope(d))
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
      dishes.map((d) => resolveVesselEnvelope(d))
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

  it('sizes a dish for every vessel its parts count', () => {
    const bowl = (count?: number) =>
      resolveVesselEnvelope({
        name: 'Tonkotsu ramen',
        vesselToken: 'bowl',
        ingredients: ['Ramen noodles', 'Pork broth', 'Chashu pork'].map(
          (rawName) => ({
            rawName,
            count,
            unitToken: count ? 'bowl' : undefined,
          })
        ),
      });
    const one = bowl();
    const two = bowl(2);
    expect(one).not.toBeNull();
    expect(two?.guardG).toEqual({
      low: Math.round((one?.guardG.low ?? 0) * 2),
      high: Math.round((one?.guardG.high ?? 0) * 2),
    });
    expect(two?.midG).toBe(Math.round((one?.midG ?? 0) * 2));
  });

  it('reads one part counted in the vessel word as its own amount', () => {
    // Every part has its own amount; only the broth is counted in "bowl".
    const envelope = (broth?: number) =>
      resolveVesselEnvelope({
        name: 'Tonkotsu ramen',
        vesselToken: 'bowl',
        ingredients: [
          { rawName: 'ramen noodles', count: 1, unitToken: 'packet' },
          { rawName: 'chashu pork', count: 2, unitToken: 'slice' },
          {
            rawName: 'pork broth',
            ...(broth ? { count: broth, unitToken: 'bowl' } : {}),
          },
        ],
      });
    expect(envelope(0.5)?.guardG).toEqual(envelope()?.guardG);
  });

  it('reads half a vessel on the main food, beside unmeasured parts, as half the dish', () => {
    // Call 1 wrote "1/2 chén cà ri gà" as 0.5 chén on the chicken only.
    const envelope = (count?: number) =>
      resolveVesselEnvelope({
        name: 'Cà ri gà',
        vesselToken: 'chén',
        ingredients: [
          {
            rawName: 'thịt gà',
            count,
            unitToken: count ? 'chén' : undefined,
          },
          { rawName: 'dầu ăn' },
          { rawName: 'sả' },
          { rawName: 'nước dùng gà' },
        ],
      });
    const whole = envelope();
    const half = envelope(0.5);
    expect(half?.midG).toBe(Math.round((whole?.midG ?? 0) * 0.5));
    expect(half?.guardG.high).toBeLessThan(whole?.midG ?? 0);
  });

  it('reads half a vessel on one part, beside parts weighed in grams, as that part only', () => {
    // "150 g noodles, 100 g beef, half a bowl of broth": the half is the broth's.
    const envelope = (count?: number) =>
      resolveVesselEnvelope({
        name: 'Beef noodle soup',
        vesselToken: 'bowl',
        ingredients: [
          {
            rawName: 'rice noodles',
            explicitMass: { grams: 150 },
          },
          { rawName: 'beef', explicitMass: { grams: 100 } },
          {
            rawName: 'broth',
            count,
            unitToken: count ? 'bowl' : undefined,
          },
        ],
      });
    expect(envelope(0.5)?.guardG).toEqual(envelope()?.guardG);
  });

  it('reads a one-food dish counted in its vessel as that many vessels', () => {
    const envelope = (count?: number) =>
      resolveVesselEnvelope({
        name: 'Cơm chiên',
        vesselToken: 'dĩa',
        ingredients: [
          { rawName: 'cơm chiên', count, unitToken: count ? 'dĩa' : undefined },
          { rawName: 'dầu ăn' },
        ],
      });
    expect(envelope(2)?.midG).toBe(Math.round((envelope()?.midG ?? 0) * 2));
  });

  it('reads parts that count the vessel differently as one vessel', () => {
    const envelope = (counts: number[]) =>
      resolveVesselEnvelope({
        name: 'Phở bò',
        vesselToken: 'tô',
        ingredients: counts.map((count, i) => ({
          rawName: `part ${i}`,
          count,
          unitToken: 'tô',
        })),
      });
    expect(envelope([2, 3])?.guardG).toEqual(envelope([1, 1])?.guardG);
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

/**
 * A bowl of plain rice is sized by the user's country, in any language: the
 * generic bowl bands (a chén 140–320 g, an English "bowl" 250–570 g) sat far
 * above a real bowl of rice and pulled Call 2's rice up.
 */
describe('a bowl of plain rice', () => {
  const korea = riceBowlFor({ countryOfOrigin: 'South Korea' });
  const vietnam = riceBowlFor({ countryOfOrigin: 'Vietnam' });
  const rice = (
    count: number | undefined,
    vesselToken = 'chén',
    names: { name?: string; rawName?: string; queryEn?: string } = {}
  ) =>
    resolveVesselEnvelope(
      {
        name: names.name ?? 'Cơm trắng',
        vesselToken,
        ingredients: [
          {
            rawName: names.rawName ?? 'cơm',
            queryEn: names.queryEn ?? 'steamed white rice, cooked',
            count,
            unitToken: vesselToken,
          },
        ],
      },
      vietnam
    );

  it('bands one Vietnamese chén or bát at 80–160 g', () => {
    for (const token of ['chén', 'bát']) {
      expect(rice(1, token)?.guardG, token).toEqual({ low: 80, high: 160 });
      expect(rice(1, token)?.smallBowlG, token).toBe(120);
    }
  });

  it('treats an English bowl of rice as one small rice bowl', () => {
    const envelope = rice(1, 'bowl', {
      name: 'White rice',
      rawName: 'White rice',
      queryEn: 'cooked white rice',
    });
    expect(envelope?.tier).toBe(1);
    expect(envelope?.guardG).toEqual({ low: 80, high: 160 });
  });

  it("uses the user's country's bowl and scales by the bowls eaten", () => {
    const one = resolveVesselEnvelope(
      {
        name: 'Steamed rice',
        vesselToken: 'bowl',
        ingredients: [{ rawName: 'Rice', queryEn: 'steamed white rice' }],
      },
      korea
    );
    expect(one?.guardG).toEqual({ low: 140, high: 280 });
    expect(one?.smallBowlG).toBe(210);
    expect(rice(2)?.guardG).toEqual({ low: 160, high: 320 });
    expect(rice(0.5)?.guardG).toEqual({ low: 40, high: 80 });
  });

  it('gives the picker one rice bowl and how many of it were eaten', () => {
    expect(rice(0.5)).toMatchObject({ smallBowlG: 120, servings: 0.5 });
    expect(rice(2)).toMatchObject({ smallBowlG: 120, servings: 2 });
    expect(rice(1)).toMatchObject({ smallBowlG: 120, servings: 1 });
  });

  it('hands the picker the count of bowls beside the one bowl', () => {
    const items = [mealItem('Cơm'), mealItem('Cơm 2')];
    const dishes = [0.5, 2].map((count, i) => ({
      name: i ? 'Cơm 2' : 'Cơm',
      vesselToken: 'chén',
      ingredients: [{ rawName: 'cơm', count, unitToken: 'chén' }],
    }));
    attachVesselToMealItems(
      items,
      dishes,
      dishes.map((d) => resolveVesselEnvelope(d, vietnam))
    );
    expect(items[0].vessel).toMatchObject({ smallBowlG: 120, count: 0.5 });
    expect(items[1].vessel).toMatchObject({ smallBowlG: 120, count: 2 });
  });

  it('leaves other dishes in a chén on the generic band', () => {
    const che = resolveVesselEnvelope({
      name: 'Chè đậu xanh',
      vesselToken: 'chén',
      ingredients: [{ rawName: 'chè đậu xanh', count: 1, unitToken: 'chén' }],
    });
    expect(che?.guardG).toEqual(guardBandG('bowl', 1, 'solid'));
    expect(che?.smallBowlG).toBeUndefined();
    const friedRice = rice(1, 'bowl', {
      name: 'Fried rice',
      rawName: 'Fried rice',
      queryEn: 'egg fried rice',
    });
    expect(friedRice?.guardG).toEqual(guardBandG('bowl', 2, 'solid'));
    const ricePasta = rice(1, 'bowl', {
      name: 'Rice pasta',
      rawName: 'Rice pasta',
      queryEn: 'brown rice pasta, cooked',
    });
    expect(ricePasta?.guardG).toEqual(guardBandG('bowl', 2, 'solid'));
    expect(ricePasta?.smallBowlG).toBeUndefined();
  });

  it('leaves rice in a tô, or with other food, on the generic band', () => {
    expect(rice(1, 'tô')?.guardG).toEqual(guardBandG('bowl', 2, 'solid'));
    const riceAndEgg = resolveVesselEnvelope({
      name: 'Cơm',
      vesselToken: 'chén',
      ingredients: [{ rawName: 'cơm' }, { rawName: 'trứng chiên' }],
    });
    expect(riceAndEgg?.guardG).toEqual(guardBandG('bowl', 1, 'solid'));
  });

  it('hands the rice bowl size to the meal item for the picker', () => {
    const items = [mealItem('Cơm trắng')];
    const dish = {
      name: 'Cơm trắng',
      vesselToken: 'chén',
      ingredients: [{ rawName: 'cơm', count: 1, unitToken: 'chén' }],
    };
    attachVesselToMealItems(
      items,
      [dish],
      [resolveVesselEnvelope(dish, vietnam)]
    );
    expect(items[0].vessel).toMatchObject({ tier: 1, smallBowlG: 120 });
  });
});

describe('dish class and tier from the dish name', () => {
  const dish = (name: string, vesselToken: string, extra = {}) => ({
    name,
    vesselToken,
    ...extra,
    ingredients: [{ rawName: 'thịt' }, { rawName: 'nước dùng' }],
  });

  it('sizes a braise as solid food even when Call 1 lists a stock', () => {
    expect(resolveVesselEnvelope(dish('Bò kho xả', 'chén'))?.dishClass).toBe(
      'solid'
    );
    expect(
      resolveVesselEnvelope(dish('Chicken curry', 'bowl'))?.dishClass
    ).toBe('solid');
    // NFD input, as some keyboards send it.
    expect(
      resolveVesselEnvelope(dish('Cà ri gà'.normalize('NFD'), 'chén'))
        ?.dishClass
    ).toBe('solid');
  });

  it('keeps a braise in noodle soup, and words that only start with kho, as soup', () => {
    for (const name of ['Hủ tiếu bò kho', 'Curry laksa', 'Canh khoai mỡ']) {
      expect(resolveVesselEnvelope(dish(name, 'tô'))?.dishClass).toBe('soup');
    }
  });

  it('reads bánh mì as bread, not noodles', () => {
    const envelope = resolveVesselEnvelope(dish('Bánh mì bò kho', 'bát'));
    expect(envelope?.dishClass).toBe('solid');
    expect(envelope?.tier).toBe(1);
  });

  it('reads a bát of noodle soup as a noodle bowl and a bát of canh as a small bowl', () => {
    expect(resolveVesselEnvelope(dish('Phở bò', 'bát'))?.tier).toBe(2);
    expect(resolveVesselEnvelope(dish('Canh cải', 'bát'))?.tier).toBe(1);
    expect(resolveVesselEnvelope(dish('Phở bò', 'chén'))?.tier).toBe(1);
    // A ramen bowl with no size typed stays the large bowl, in a bát too.
    expect(resolveVesselEnvelope(dish('Shoyu ramen', 'bát'))?.tier).toBe(3);
    // Plain noodles on the side of bún chả are a small bowl.
    expect(
      resolveVesselEnvelope({
        name: 'Bún',
        vesselToken: 'bát',
        ingredients: [{ rawName: 'bún tươi' }],
      })?.tier
    ).toBe(1);
  });

  it('puts a cup of milk tea in the 500 ml cup, one up when typed large', () => {
    const tea = (vesselSize?: 'large') =>
      resolveVesselEnvelope({
        name: 'Trà sữa trân châu',
        vesselToken: 'ly',
        vesselSize,
        ingredients: [{ rawName: 'trà' }, { rawName: 'sữa' }],
      });
    expect(tea()?.vesselMl).toBe(500);
    expect(tea('large')?.vesselMl).toBe(700);
    expect(
      resolveVesselEnvelope({
        name: 'Trà đá',
        vesselToken: 'ly',
        ingredients: [{ rawName: 'trà' }],
      })?.vesselMl
    ).toBe(300);
  });
});
