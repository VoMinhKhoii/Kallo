import { describe, expect, it, vi } from 'vitest';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import { holdCaloriesToText } from '../calories';
import { holdNamesToEnglish, holdWeighStateToDescription } from '../described';
import {
  foodAfter,
  isTypedWeight,
  typedKcals,
  typedWeights,
} from '../typed-amounts';
import { holdWeightsToText } from '../weights';

vi.spyOn(console, 'warn').mockImplementation(() => {});

type Ing = MealDecompositionV2['mealItems'][number]['ingredients'][number];
const ing = (rawName: string, extra: Partial<Ing> = {}): Ing => ({
  rawName,
  canonicalName: rawName,
  ...extra,
});
const mass = (grams: number) => ({
  explicitMass: { grams, basis: 'unknown' as const },
});
const meal = (
  ...dishes: Array<{
    name: string;
    servedMassG?: number;
    statedKcal?: number;
    ingredients: Ing[];
  }>
): MealDecompositionV2 => ({
  isFood: true,
  mealSlot: null,
  mealItems: dishes.map((d) => ({ cookingMethod: 'cooked', ...d })),
});
const typedCalories = (text: string) =>
  typedKcals(text.normalize('NFC')).map((t) => t.kcal);
const grams = (text: string) => typedWeights(text)?.map((w) => w.grams);

describe('typedWeights', () => {
  it('reads every weight typed with a digit, in grams', () => {
    expect(grams('150g chicken, 1,5 kg ribs, 50ml cream, 2lạng thịt')).toEqual([
      150, 1500, 50, 200,
    ]);
    expect(grams('100gr cơm + 1/2 kg tôm + 1 cân thịt + 1.200g gà')).toEqual([
      100, 500, 1000, 1200,
    ]);
    expect(grams('2 lạng rưỡi thịt bò')).toEqual([250]);
    expect(grams('a 6 oz sirloin and a 1 lb bag')?.map(Math.round)).toEqual([
      170, 454,
    ]);
  });

  it('reads gm, cc and cl, and a decimal under one gram', () => {
    expect(grams('100gm rice, 200cc sữa, 33cl bia, 0.250g muối')).toEqual([
      100, 200, 330, 0.25,
    ]);
  });

  it('does not take a count, a calorie figure or a food word for a weight', () => {
    expect(grams('2 gói mì, 3 lát bánh mì, trà sữa 90kcal, 5 lon bia')).toEqual(
      []
    );
    expect(grams('2 eggs and a slice of toast')).toEqual([]);
    expect(grams('cân sống rồi nấu')).toEqual([]);
  });

  it('gives up on a text with a weight written in words', () => {
    expect(typedWeights('nửa ký thịt bò')).toBeNull();
    expect(typedWeights('half a pound of ground beef')).toBeNull();
    expect(typedWeights('nửa cân thịt, 100g cơm')).toBeNull();
  });
});

describe('isTypedWeight', () => {
  const typed = typedWeights('a 400g steak and 150g rice') ?? [];
  it('accepts the typed weight, a share of it, several of it, or a sum', () => {
    for (const g of [400, 150, 200, 133, 100, 550])
      expect(isTypedWeight(g, typed), `${g}`).toBe(true);
    expect(isTypedWeight(800, typed)).toBe(false);
    expect(isTypedWeight(800, typed, 'two 400g steaks')).toBe(true);
    expect(isTypedWeight(180, typed, '3 quả trứng 60g mỗi quả')).toBe(false);
    expect(
      isTypedWeight(
        180,
        typedWeights('3 quả trứng 60g mỗi quả') ?? [],
        '3 quả trứng 60g mỗi quả'
      )
    ).toBe(true);
  });
  it('accepts a percentage share only when the text has a percentage', () => {
    expect(isTypedWeight(240, typed)).toBe(false);
    expect(isTypedWeight(240, typed, 'ate 60% of a 400g steak')).toBe(true);
  });
  it('rejects a weight that comes from none of them', () => {
    for (const g of [280, 350, 90, 1000])
      expect(isTypedWeight(g, typed), `${g}`).toBe(false);
  });
});

describe('holdWeightsToText', () => {
  const KORMA =
    'Homemade chicken korma (150g chicken breast + onion + garlic + 2 tablespoons ground almonds + 50ml cream + 1 tablespoon butter) with 150g cooked rice';
  const korma = (servedMassG: number) =>
    meal(
      {
        name: 'Chicken korma',
        servedMassG,
        ingredients: [
          ing('Chicken breast', mass(150)),
          ing('Onion'),
          ing('Ground almonds', { count: 2, unitToken: 'tbsp' }),
          ing('Cream', { count: 50, unitToken: 'ml' }),
        ],
      },
      { name: 'Cooked rice', ingredients: [ing('Cooked rice', mass(150))] }
    );

  it('removes a dish weight the user never typed (#580, Haiku wrote 280)', () => {
    const d = korma(280);
    holdWeightsToText(d, KORMA);
    expect(d.mealItems[0].servedMassG).toBeUndefined();
    expect(d.mealItems[0].ingredients[0].explicitMass?.grams).toBe(150);
    expect(d.mealItems[1].ingredients[0].explicitMass?.grams).toBe(150);
  });

  it('removes a dish weight that is only some multiple of a typed one', () => {
    // 250 = 5 × the cream's 50 ml, but the text holds no 5.
    const d = korma(250);
    holdWeightsToText(d, KORMA);
    expect(d.mealItems[0].servedMassG).toBeUndefined();
  });

  it('removes a dish weight that repeats one of its weighed parts (#580)', () => {
    const d = korma(150);
    holdWeightsToText(d, KORMA);
    expect(d.mealItems[0].servedMassG).toBeUndefined();
  });

  it('removes every weight when the text has none', () => {
    const d = meal({
      name: 'Beef bulgogi',
      servedMassG: 300,
      ingredients: [ing('Beef', mass(180)), ing('Oil')],
    });
    holdWeightsToText(d, 'Beef bulgogi at a Korean restaurant');
    expect(d.mealItems[0].servedMassG).toBeUndefined();
    expect(d.mealItems[0].ingredients[0].explicitMass).toBeUndefined();
  });

  it('keeps a typed dish weight and a typed food weight', () => {
    const d = meal(
      {
        name: 'Chicken alfredo pasta',
        servedMassG: 350,
        ingredients: [ing('Fettuccine'), ing('Chicken'), ing('Alfredo sauce')],
      },
      { name: 'Sirloin', ingredients: [ing('Sirloin steak', mass(170))] }
    );
    holdWeightsToText(d, '350g chicken alfredo pasta and a 6oz sirloin');
    expect(d.mealItems[0].servedMassG).toBe(350);
    expect(d.mealItems[1].ingredients[0].explicitMass?.grams).toBe(170);
  });

  it('keeps a plate weight beside a weighed part', () => {
    const d = meal({
      name: 'Gà kho gừng với cơm',
      servedMassG: 450,
      ingredients: [ing('Thịt gà', mass(150)), ing('Cơm'), ing('Gừng')],
    });
    holdWeightsToText(d, 'gà kho gừng (150g gà) với cơm, cân cả đĩa 450g');
    expect(d.mealItems[0].servedMassG).toBe(450);
  });

  it("keeps the user's share of a weighed food", () => {
    const steak = meal({
      name: 'Bít tết',
      ingredients: [ing('Bít tết', mass(200))],
    });
    holdWeightsToText(steak, 'ăn nửa miếng bít tết 400g');
    expect(steak.mealItems[0].ingredients[0].explicitMass?.grams).toBe(200);

    const shrimp = meal({
      name: 'Tôm luộc',
      servedMassG: 250,
      ingredients: [ing('Tôm')],
    });
    holdWeightsToText(shrimp, 'ăn chung 1kg tôm luộc với 3 đứa bạn');
    expect(shrimp.mealItems[0].servedMassG).toBe(250);
  });

  it('leaves a text with a weight in words as Call 1 answered it', () => {
    const d = meal({
      name: 'Thịt bò',
      ingredients: [ing('Thịt bò', mass(500))],
    });
    holdWeightsToText(d, 'nửa ký thịt bò');
    expect(d.mealItems[0].ingredients[0].explicitMass?.grams).toBe(500);
  });

  it('gives a dish weight typed on one food back to that food', () => {
    // Haiku merged the plate into one 300 g dish; the steak shipped at 184 g.
    const d = meal({
      name: 'Ribeye steak with fries and peppercorn sauce',
      servedMassG: 300,
      ingredients: [
        ing('Ribeye steak'),
        ing('Oil'),
        ing('Fries'),
        ing('Peppercorn sauce'),
      ],
    });
    holdWeightsToText(d, 'A 300g ribeye steak with fries and peppercorn sauce');
    expect(d.mealItems[0].servedMassG).toBeUndefined();
    expect(d.mealItems[0].ingredients[0].explicitMass).toEqual({
      grams: 300,
      basis: 'unknown',
    });

    const vi = meal({
      name: 'Ức gà với rau xào',
      servedMassG: 200,
      ingredients: [ing('ức gà'), ing('rau cải'), ing('dầu ăn')],
    });
    holdWeightsToText(vi, 'ức gà 200g với rau xào');
    expect(vi.mealItems[0].servedMassG).toBeUndefined();
    expect(vi.mealItems[0].ingredients[0].explicitMass?.grams).toBe(200);
  });

  it('tells foods apart by their accents, and reads a text typed without them', () => {
    // "bơ" is butter and "bò" is beef: the 100 g is not the beef's.
    const d = meal({
      name: 'Bánh mì bơ bò',
      servedMassG: 100,
      ingredients: [ing('Bơ lạt'), ing('Bò'), ing('Bánh mì')],
    });
    holdWeightsToText(d, '100g bơ với bánh mì và bò');
    expect(d.mealItems[0].ingredients.map((i) => i.explicitMass)).toEqual([
      undefined,
      undefined,
      undefined,
    ]);
    // Typed without accents, the letters are all there is to go by.
    const plain = meal({
      name: 'Ức gà với rau xào',
      servedMassG: 200,
      ingredients: [ing('Ức gà'), ing('Rau cải'), ing('Dầu ăn')],
    });
    holdWeightsToText(plain, 'uc ga 200g voi rau xao');
    expect(plain.mealItems[0].ingredients[0].explicitMass?.grams).toBe(200);
  });

  it('keeps a dish weight typed on the dish itself', () => {
    const d = meal({
      name: 'Ribeye steak',
      servedMassG: 300,
      ingredients: [ing('Ribeye steak'), ing('Oil')],
    });
    holdWeightsToText(d, 'A 300g ribeye steak with fries and peppercorn sauce');
    expect(d.mealItems[0].servedMassG).toBe(300);

    const noodles = meal({
      name: 'mì xào bò',
      servedMassG: 300,
      ingredients: [ing('mì'), ing('thịt bò'), ing('dầu ăn')],
    });
    holdWeightsToText(noodles, '300g mì xào bò');
    expect(noodles.mealItems[0].servedMassG).toBe(300);
  });
});

describe('holdWeightsToText, a food weight on the dish beside weighed parts', () => {
  it('gives the weight back to the food it was typed on (#580, korma)', () => {
    const d = meal({
      name: 'Homemade chicken korma',
      servedMassG: 150,
      ingredients: [
        ing('Chicken breast'),
        ing('Onion'),
        ing('Cream', mass(50)),
        ing('Butter', { count: 1, unitToken: 'tablespoon' }),
      ],
    });
    holdWeightsToText(
      d,
      'Homemade chicken korma (150g chicken breast + onion + garlic + 2 tablespoons ground almonds + 50ml cream + 1 tablespoon butter) with 150g cooked rice'
    );
    expect(d.mealItems[0].servedMassG).toBeUndefined();
    expect(d.mealItems[0].ingredients[0].explicitMass?.grams).toBe(150);
    expect(d.mealItems[0].ingredients[2].explicitMass?.grams).toBe(50);
  });

  it('finds the food under a shorter name, and leaves a weighed dish its weight', () => {
    const korma = meal({
      name: 'Homemade chicken korma',
      servedMassG: 150,
      ingredients: [ing('Chicken'), ing('Onion'), ing('Cream')],
    });
    holdWeightsToText(
      korma,
      'chicken korma: 150g chicken breast, onion, cream'
    );
    expect(korma.mealItems[0].ingredients[0].explicitMass?.grams).toBe(150);

    const dishes = [
      ['300g mì xào thịt bò', 'Mì xào bò', ['mì', 'thịt bò', 'cải ngọt']],
      [
        '350g chicken alfredo pasta',
        'Chicken alfredo',
        ['fettuccine', 'chicken', 'alfredo sauce'],
      ],
      [
        '250g chicken salad',
        'Grilled chicken salad',
        ['chicken', 'lettuce', 'mayonnaise'],
      ],
      ['1 tô phở bò 600g', 'Phở bò tái', ['bánh phở', 'thịt bò', 'nước dùng']],
    ] as const;
    for (const [text, name, parts] of dishes) {
      const grams = Number(text.match(/\d{3}/)?.[0]);
      const d = meal({
        name,
        servedMassG: grams,
        ingredients: parts.map((p) => ing(p)),
      });
      holdWeightsToText(d, text);
      expect(d.mealItems[0].servedMassG, text).toBe(grams);
    }
  });
});

describe('holdNamesToEnglish', () => {
  it('shows the English name for a Vietnamese one the user did not type (#581)', () => {
    const d = meal({
      name: 'Seasoned spinach',
      ingredients: [
        ing('Spinach'),
        ing('dầu mè', { canonicalName: 'Sesame oil', nameVi: 'dầu mè' }),
        ing('dầu ăn', {
          canonicalName: 'Dầu ăn',
          queryEn: 'vegetable cooking oil',
        }),
      ],
    });
    holdNamesToEnglish(d, 'Beef bulgogi with banchan (kimchi, spinach)');
    expect(d.mealItems[0].ingredients.map((i) => i.rawName)).toEqual([
      'Spinach',
      'Sesame oil',
      'vegetable cooking oil',
    ]);
  });

  it('keeps a Vietnamese name the user typed, and other accented names', () => {
    const d = meal({
      name: 'Bánh mì',
      ingredients: [
        ing('bánh mì'),
        ing('Béarnaise sauce'),
        ing('Jalapeño'),
        ing('Phở'),
      ],
    });
    holdNamesToEnglish(d, 'a bánh mì with béarnaise, jalapeño and phở');
    expect(d.mealItems[0].ingredients.map((i) => i.rawName)).toEqual([
      'bánh mì',
      'Béarnaise sauce',
      'Jalapeño',
      'Phở',
    ]);
  });

  it('keeps a name built on the Vietnamese word the user typed', () => {
    const d = meal({
      name: 'Phở',
      ingredients: [
        ing('Phở bò', { canonicalName: 'Beef pho' }),
        ing('Dầu ăn', { canonicalName: 'Vegetable oil' }),
      ],
    });
    holdNamesToEnglish(d, 'ăn 1 bowl of phở with dau phu');
    expect(d.mealItems[0].ingredients.map((i) => i.rawName)).toEqual([
      'Phở bò',
      'Vegetable oil',
    ]);
  });

  it('keeps a Vietnamese name typed without its accents, by whole words', () => {
    const d = meal({
      name: 'Bun rieu',
      ingredients: [
        ing('Đậu phụ', { canonicalName: 'Tofu' }),
        ing('Dầu ăn', { canonicalName: 'Vegetable oil' }),
      ],
    });
    holdNamesToEnglish(d, 'an 1 bowl bun rieu cua, extra 1 mieng dau phu');
    expect(d.mealItems[0].ingredients.map((i) => i.rawName)).toEqual([
      'Đậu phụ',
      'Vegetable oil',
    ]);
  });
});

describe('holdCaloriesToText', () => {
  const kcals = (d: MealDecompositionV2) =>
    d.mealItems.map((m) => m.statedKcal);

  it('reads the calorie figures the user typed', () => {
    expect(
      typedCalories('160kcal sữa chua, trà sữa gói 90 calo, 285 cal latte')
    ).toEqual([160, 90, 285]);
    expect(typedCalories('1.200 kcal buffet')).toEqual([1200]);
    expect(typedCalories('150g cơm, 2 lon coca, 30 cái kẹo')).toEqual([]);
  });

  it('keeps typed calories, a share and a per-unit multiple', () => {
    const d = meal(
      { name: 'Sữa chua', statedKcal: 160, ingredients: [ing('sữa chua')] },
      { name: 'Bánh quy', statedKcal: 150, ingredients: [ing('bánh quy')] },
      { name: 'Sữa TH', statedKcal: 220, ingredients: [ing('sữa')] }
    );
    holdCaloriesToText(
      d,
      '160kcal sữa chua, ăn nửa gói bánh quy 300kcal, 2 hộp sữa TH 110kcal mỗi hộp'
    );
    expect(kcals(d)).toEqual([160, 150, 220]);
  });

  it('multiplies a per-unit figure by the count when Call 1 did not', () => {
    const d = meal({
      name: 'Sữa TH',
      statedKcal: 110,
      ingredients: [ing('sữa', { count: 2, unitToken: 'hộp' })],
    });
    holdCaloriesToText(d, '2 hộp sữa TH 110kcal mỗi hộp');
    expect(kcals(d)).toEqual([220]);
    // Not per unit: the figure is for the lot.
    const lot = meal({
      name: 'Sữa TH',
      statedKcal: 220,
      ingredients: [ing('sữa', { count: 2, unitToken: 'hộp' })],
    });
    holdCaloriesToText(lot, '2 hộp sữa TH 220kcal');
    expect(kcals(lot)).toEqual([220]);
  });

  it('removes calories the user did not type', () => {
    const d = meal(
      { name: 'Phở bò', statedKcal: 450, ingredients: [ing('bánh phở')] },
      { name: 'Canh', statedKcal: 13, ingredients: [ing('canh')] }
    );
    holdCaloriesToText(d, '1 tô phở bò và 11kcal canh');
    expect(kcals(d)).toEqual([undefined, 11]);
  });

  it('puts each figure on the dish named beside it (prod: a list shifted by one)', () => {
    const d = meal(
      { name: 'Cơm ST25', ingredients: [ing('cơm')] },
      {
        name: 'Cá hồi xông khói',
        statedKcal: 23,
        ingredients: [ing('cá hồi')],
      },
      { name: 'Rong biển sấy khô', statedKcal: 11, ingredients: [ing('rong')] },
      { name: 'Canh', ingredients: [ing('canh')] },
      {
        name: 'Protein bar',
        statedKcal: 260,
        ingredients: [ing('protein bar')],
      },
      { name: 'Gà chiên', statedKcal: 315, ingredients: [ing('gà')] }
    );
    holdCaloriesToText(
      d,
      '150g cơm st25, 260kcal cá hồi xông khói bỏ đi 13g da, 23kcal rong biển sấy khô, 11kcal canh, 170 g protein bar, 315kcal gà chiên'
    );
    expect(kcals(d)).toEqual([undefined, 260, 23, 11, undefined, 315]);
  });

  it('sets a figure Call 1 left out, unless a share is in play', () => {
    const d = meal({ name: 'Trà sữa gói', ingredients: [ing('trà sữa')] });
    holdCaloriesToText(d, 'trà sữa gói 90kcal');
    expect(kcals(d)).toEqual([90]);
    const half = meal({ name: 'Bánh quy', ingredients: [ing('bánh quy')] });
    holdCaloriesToText(half, 'ăn nửa gói bánh quy 300kcal');
    expect(kcals(half)).toEqual([undefined]);
  });

  it('sets the one figure on the one dish, whatever Call 1 named it', () => {
    const d = meal({
      name: 'Starbucks coffee drink',
      ingredients: [ing('Espresso'), ing('Milk'), ing('Syrup')],
    });
    holdCaloriesToText(d, '285kcal usual Starbuck coffee');
    expect(kcals(d)).toEqual([285]);
    // A part named like the figure's food, the others added by Call 1.
    const named = meal({
      name: 'Starbucks coffee',
      ingredients: [ing('Coffee'), ing('Milk'), ing('Syrup')],
    });
    holdCaloriesToText(named, '285kcal usual Starbuck coffee');
    expect(kcals(named)).toEqual([285]);
    const pho = meal({ name: 'Phở bò', ingredients: [ing('bánh phở')] });
    holdCaloriesToText(pho, '1 tô phở bò, hôm nay còn dư 400 kcal');
    expect(kcals(pho)).toEqual([undefined]);
  });

  it('puts the calories of one food of a merged dish on that food', () => {
    for (const stated of [300, undefined]) {
      const d = meal({
        name: 'Bánh mì trứng',
        ...(stated ? { statedKcal: stated } : {}),
        ingredients: [ing('Bánh mì'), ing('Trứng gà'), ing('Dầu ăn')],
      });
      holdCaloriesToText(d, '300kcal bánh mì kèm 2 trứng ốp la');
      expect(kcals(d)).toEqual([undefined]);
      expect(d.mealItems[0].ingredients.map((i) => i.statedKcal)).toEqual([
        300,
        undefined,
        undefined,
      ]);
    }
  });

  it('reads the word-first and long spellings, never a count after the word', () => {
    expect(typedCalories('pizza, calories: 300')).toEqual([300]);
    expect(typedCalories('latte kcal 285')).toEqual([285]);
    expect(typedCalories('300 kilocalories of rice')).toEqual([300]);
    expect(typedCalories('160 kcal 2 quả trứng')).toEqual([160]);
    expect(typedCalories('kcal 300g cơm')).toEqual([]);
  });

  it('leaves Call 1 alone when the figure is beside no dish it can name', () => {
    const d = meal(
      { name: 'Big Mac', statedKcal: 590, ingredients: [ing('bun')] },
      { name: 'Small fries', ingredients: [ing('fries')] }
    );
    holdCaloriesToText(
      d,
      "McDonald's Big Mac (the menu says 590 calories) and a small fries"
    );
    expect(kcals(d)).toEqual([590, undefined]);
  });

  it('takes no figure about the day for a food', () => {
    for (const text of [
      '1 tô phở bò, hôm nay còn dư 400 kcal',
      'a bowl of pho, 400 kcal left',
      'bowl of pho; my goal is 400 kcal',
    ]) {
      const d = meal({
        name: 'Phở bò',
        statedKcal: 400,
        ingredients: [ing('phở')],
      });
      holdCaloriesToText(d, text);
      expect(kcals(d)).toEqual([undefined]);
    }
    // "leftover" is a food word, and a figure after a comma is still the dish's.
    const kept = meal({
      name: 'Beef rendang',
      statedKcal: 650,
      ingredients: [ing('rendang')],
    });
    holdCaloriesToText(kept, 'leftover beef rendang, about 650 kcal');
    expect(kcals(kept)).toEqual([650]);
    // The day's figure is in another sentence; a decimal point is no sentence end.
    const yogurt = meal({
      name: 'Yogurt',
      statedKcal: 160,
      ingredients: [ing('yogurt')],
    });
    holdCaloriesToText(
      yogurt,
      'My goal is 2000 kcal. I ate 1.5 yogurt 160 kcal.'
    );
    expect(kcals(yogurt)).toEqual([160]);
  });
});

describe('foodAfter', () => {
  it('drops a leading article, never the first letter of the food', () => {
    const food = (text: string) => {
      const [w] = typedWeights(text) ?? [];
      return foodAfter(text, w);
    };
    expect(food('100g avocado with toast')).toBe('avocado');
    expect(food('30g almonds')).toBe('almonds');
    expect(food('200g of the chicken')).toBe('chicken');
    expect(food('100g an apple')).toBe('apple');
  });
});

describe('holdWeighStateToDescription', () => {
  const hints = (d: MealDecompositionV2) =>
    d.mealItems[0].ingredients.map((i) => i.stateHint);

  it('reads a weight on a food described as dry or raw as a raw weight', () => {
    const d = meal({
      name: 'Risotto',
      ingredients: [
        ing('Arborio rice', { ...mass(80), queryEn: 'dry arborio rice' }),
        ing('Gạo', mass(100)),
        ing('Chicken breast', { ...mass(150), queryEn: 'raw chicken breast' }),
        ing('Yến mạch', { ...mass(40), queryEn: 'dry rolled oats' }),
      ],
    });
    holdWeighStateToDescription(d);
    expect(hints(d)).toEqual(Array(4).fill('raw_weight'));
  });

  it('leaves cooked foods, stated bases, unweighed foods and "không" alone', () => {
    const d = meal({
      name: 'Plate',
      ingredients: [
        ing('Jasmine rice', { ...mass(150), queryEn: 'cooked jasmine rice' }),
        ing('Chicken', {
          ...mass(120),
          queryEn: 'pan-fried raw chicken breast',
        }),
        ing('Cơm', {
          ...mass(150),
          stateHint: 'cooked_weight',
          queryEn: 'dry rice',
        }),
        ing('Oats', { queryEn: 'dry rolled oats' }),
        ing('Greek yogurt không đường', {
          ...mass(100),
          queryEn: 'plain yogurt',
        }),
        ing('Bún gạo lứt', { ...mass(100), queryEn: 'brown rice vermicelli' }),
      ],
    });
    holdWeighStateToDescription(d);
    expect(hints(d)).toEqual([
      undefined,
      undefined,
      'cooked_weight',
      undefined,
      undefined,
      undefined,
    ]);
  });
});
