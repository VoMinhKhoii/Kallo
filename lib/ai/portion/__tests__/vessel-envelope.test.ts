import { describe, expect, it } from 'vitest';
import {
  type DishClass,
  guardBandG,
  midG,
  normalizeVesselToken,
  resolveVesselFromToken,
  type VesselTier,
} from '../vessel-data';
import {
  attachVesselToResult,
  classifyDishClass,
  type DishLike,
} from '../vessel-envelope';

const dish = (overrides: Partial<DishLike> = {}): DishLike => ({
  name: 'test dish',
  ingredients: [],
  ...overrides,
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

describe('dish classification', () => {
  it.each([
    ['phở', 'bowl', 'soup'],
    ['beef ramen', 'bowl', 'soup'],
    ['cơm tấm', 'plate', 'solid'],
    ['gỏi cuốn', 'plate', 'airy'],
    ['trà sữa', 'cup', 'drink'],
    ['cereal with milk', 'bowl', 'solid'],
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
});

describe('attachVesselToResult', () => {
  it('aligns by index and skips absent or unknown vessels', () => {
    const result = {
      mealItems: [
        { name: 'first' },
        { name: 'second', vessel: 'unchanged' },
        { name: 'third' },
      ],
    };
    const returned = attachVesselToResult(result, [
      dish({ name: 'phở', vesselToken: 'tô' }),
      dish({ vesselToken: 'jar' }),
      dish(),
    ]);

    expect(returned).toBe(result);
    expect(result.mealItems[0].vessel).toMatchObject({
      family: 'bowl',
      tier: 2,
      dishClass: 'soup',
    });
    expect(result.mealItems[1].vessel).toBe('unchanged');
    expect(result.mealItems[2]).not.toHaveProperty('vessel');
  });
});
