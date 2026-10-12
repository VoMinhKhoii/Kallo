import { describe, expect, it } from 'vitest';
import { cardDisplayFields, cleanCardFoodName } from '../card-display';

/** A row as the enrichment query hands it over; real card text from
 *  data/food-cards/cards.jsonl and groups from the unified categories. */
function row(
  namePrimary: string,
  typeEn: string,
  food: string | null,
  extra: { cookingMethod?: string; brand?: string } = {}
) {
  return {
    namePrimary,
    typeEn,
    food,
    cookingMethod: extra.cookingMethod ?? null,
    brand: extra.brand ?? null,
  };
}

describe('cleanCardFoodName', () => {
  it.each([
    ['raw skinless chicken breast', 'Skinless chicken breast'],
    ['beef, grade I, raw', 'Beef, grade I'],
    ['goby (cá bống), raw', 'Goby'],
    [
      'glutinous rice, machine-milled, uncooked',
      'Glutinous rice, machine-milled',
    ],
    [
      'fermented soybean sauce with glutinous rice (tương nếp)',
      'Fermented soybean sauce with glutinous rice',
    ],
    // An English aside stays: it is the only explanation of the food.
    [
      'cá dầu (small Vietnamese river fish), raw',
      'Cá dầu (small Vietnamese river fish)',
    ],
    ['long-grain white rice, cooked', 'Long-grain white rice, cooked'],
  ])('%s → %s', (food, expected) => {
    expect(cleanCardFoodName(food)).toBe(expected);
  });

  it('keeps words that merely contain "raw"', () => {
    expect(cleanCardFoodName('strawberries')).toBe('Strawberries');
  });
});

describe('cardDisplayFields — state label', () => {
  it('labels raw only when the card says raw or uncooked', () => {
    expect(
      cardDisplayFields(
        row('Ức gà', 'Poultry Products', 'raw skinless chicken breast')
      ).stateLabel
    ).toBe('raw');
    expect(
      cardDisplayFields(
        row(
          'Gạo nếp máy (Loại thường)',
          'Cereal Grains and Pasta',
          'glutinous rice, machine-milled, uncooked'
        )
      ).stateLabel
    ).toBe('raw');
  });

  it('labels cooked from a cooking word or the cooking method', () => {
    expect(
      cardDisplayFields(
        row('Đậu phụ nướng', 'Legumes and Legume Products', 'grilled tofu')
      ).stateLabel
    ).toBe('cooked');
    expect(
      cardDisplayFields(
        row('Gà quay', 'Poultry Products', 'BBQ chicken breast, skinless', {
          cookingMethod: 'rotisserie',
        })
      ).stateLabel
    ).toBe('cooked');
  });

  it('gives canned, dried and plain foods no label instead of the default raw', () => {
    for (const [name, group, food] of [
      ['Thịt bò hộp', 'Canned Foods', 'canned beef'],
      ['Thịt bò khô', 'Beef Products', 'dried beef, beef jerky'],
      [
        'Sữa chua (từ sữa bò)',
        'Dairy and Egg Products',
        'plain whole-milk yogurt',
      ],
      ['Đậu phụ', 'Legumes and Legume Products', 'tofu (pressed bean curd)'],
      ['Sữa bột đậu nành', 'Legumes and Legume Products', 'soy milk powder'],
    ] as const) {
      expect(cardDisplayFields(row(name, group, food)).stateLabel).toBeNull();
    }
  });

  it('shows the brand instead of a state for packaged foods', () => {
    const fields = cardDisplayFields(
      row(
        'Xúc xích gan',
        'Sausages and Luncheon Meats',
        'Braunschweiger liver sausage, sliced',
        {
          brand: 'Oscar Mayer',
        }
      )
    );
    expect(fields.brand).toBe('Oscar Mayer');
    expect(fields.stateLabel).toBeNull();
  });

  it('has no display fields when the row has no card', () => {
    const fields = cardDisplayFields(
      row('Cơm trắng', 'Cereal Grains and Pasta', null)
    );
    expect(fields.displayNameEn).toBeNull();
    expect(fields.stateLabel).toBeNull();
  });
});

describe('cardDisplayFields — vessel', () => {
  const vesselOf = (r: ReturnType<typeof row>) => cardDisplayFields(r).vessel;

  it('cuts meat, poultry and fish into pieces', () => {
    expect(
      vesselOf(row('Ức gà', 'Poultry Products', 'raw skinless chicken breast'))
    ).toEqual({
      family: 'piece',
      kind: 'poultry',
    });
    expect(
      vesselOf(row('Thịt bò loại I', 'Beef Products', 'beef, grade I, raw'))
    ).toEqual({
      family: 'piece',
      kind: 'meat',
    });
    expect(
      vesselOf(row('Cá hồi', 'Finfish and Shellfish Products', 'salmon, raw'))
    ).toEqual({
      family: 'piece',
      kind: 'fish',
    });
  });

  it('pours drinks, milks and juices into cups', () => {
    const cup = { family: 'cup', dishClass: 'drink' };
    expect(vesselOf(row('Trà xanh', 'Beverages', 'green tea, brewed'))).toEqual(
      cup
    );
    expect(
      vesselOf(
        row(
          'Sữa đậu nành (100g đậu/lít)',
          'Legumes and Legume Products',
          'homemade soy milk, unsweetened'
        )
      )
    ).toEqual(cup);
    expect(
      vesselOf(row('Nước cam', 'Fruits and Fruit Juices', 'orange juice'))
    ).toEqual(cup);
  });

  it('weighs powders and plain yogurt in grams', () => {
    expect(
      vesselOf(row('Sữa bột', 'Dairy and Egg Products', 'whole milk powder'))
    ).toBeNull();
    expect(
      vesselOf(
        row(
          'Sữa chua (từ sữa bò)',
          'Dairy and Egg Products',
          'plain whole-milk yogurt'
        )
      )
    ).toBeNull();
    expect(
      vesselOf(
        row(
          'Phô mai ricotta',
          'Dairy and Egg Products',
          'whole milk ricotta cheese'
        )
      )
    ).toBeNull();
    expect(
      vesselOf(
        row(
          'Sữa chua uống',
          'Dairy and Egg Products',
          'sweetened drinking yogurt'
        )
      )
    ).toEqual({ family: 'cup', dishClass: 'drink' });
  });

  it('serves soups and cooked grains in bowls, cooked vegetables on plates', () => {
    expect(
      vesselOf(
        row(
          'Nước hầm gà tự nấu',
          'Soups, Sauces, and Gravies',
          'homemade chicken stock'
        )
      )
    ).toEqual({
      family: 'bowl',
      dishClass: 'soup',
    });
    expect(
      vesselOf(
        row(
          'Cơm trắng',
          'Cereal Grains and Pasta',
          'long-grain white rice, cooked'
        )
      )
    ).toEqual({
      family: 'bowl',
      dishClass: 'solid',
    });
    expect(
      vesselOf(
        row(
          'Rau muống luộc',
          'Vegetables and Vegetable Products',
          'water spinach, boiled'
        )
      )
    ).toEqual({
      family: 'plate',
      dishClass: 'solid',
    });
  });

  it('weighs raw grains, raw produce and oils in grams', () => {
    expect(
      vesselOf(
        row('Gạo tẻ máy', 'Cereal Grains and Pasta', 'white rice, uncooked')
      )
    ).toBeNull();
    expect(
      vesselOf(
        row(
          'Rau muống',
          'Vegetables and Vegetable Products',
          'water spinach, raw'
        )
      )
    ).toBeNull();
    expect(
      vesselOf(row('Dầu đậu tương', 'Fats and Oils', 'soybean oil'))
    ).toBeNull();
  });
});
