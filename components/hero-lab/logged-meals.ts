/**
 * The four meals the hero puts on display, chosen to cover both people who
 * come to Kallo.
 *
 * Two are eyeballed and written the way you'd say them out loud — a street
 * breakfast, last night's leftovers. Those are the ones nothing else handles
 * well, and the reason the app exists. The other two are weighed to the gram
 * by someone who already tracks; they're here to show that precision goes
 * straight through rather than being fought.
 *
 * Numbers are illustrative fixture data for the lab, but they are internally
 * consistent: every total below is the exact sum of its item rows, because a
 * landing page that shows arithmetic which doesn't add up is worse than one
 * that shows none.
 */
export interface HeroMealItem {
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface HeroMeal {
  id: string;
  /** Exactly what was typed into the composer. */
  rawInput: string;
  /** How the portion was arrived at — the two audiences, side by side. */
  entry: 'Eyeballed' | 'Weighed';
  timeLabel: string;
  /** The derived rows. Totals are computed from these, never hardcoded. */
  items: HeroMealItem[];
  /** Painterly artwork for this meal, one per ground. */
  art: { cream: string; dark: string };
}

export const HERO_MEALS: readonly HeroMeal[] = [
  {
    id: 'pho',
    rawInput: '1 tô phở bò tái + quẩy',
    entry: 'Eyeballed',
    timeLabel: '07:40',
    items: [
      {
        name: 'Phở bò tái (1 tô)',
        calories: 420,
        protein: 30,
        carbs: 50,
        fat: 10,
      },
      { name: 'Quẩy (1)', calories: 110, protein: 4, carbs: 12, fat: 3 },
    ],
    art: {
      cream: '/hero-lab/meal-pho-cream.webp',
      dark: '/hero-lab/meal-pho-dark.webp',
    },
  },
  {
    id: 'bol',
    rawInput: 'leftover spaghetti bolognese, small bowl + side salad',
    entry: 'Eyeballed',
    timeLabel: '21:15',
    items: [
      {
        name: 'Spaghetti bolognese',
        calories: 380,
        protein: 21,
        carbs: 40,
        fat: 15,
      },
      {
        name: 'Side salad + dressing',
        calories: 90,
        protein: 3,
        carbs: 8,
        fat: 4,
      },
    ],
    art: {
      cream: '/hero-lab/meal-bol-cream.webp',
      dark: '/hero-lab/meal-bol-dark.webp',
    },
  },
  {
    id: 'chicken',
    rawInput:
      '150g grilled chicken breast, 180g jasmine rice, 1 tbsp olive oil',
    entry: 'Weighed',
    timeLabel: '13:05',
    items: [
      {
        name: 'Chicken breast (150g)',
        calories: 245,
        protein: 46,
        carbs: 0,
        fat: 5,
      },
      {
        name: 'Jasmine rice (180g)',
        calories: 235,
        protein: 4,
        carbs: 52,
        fat: 1,
      },
      {
        name: 'Olive oil (1 tbsp)',
        calories: 120,
        protein: 0,
        carbs: 0,
        fat: 14,
      },
    ],
    art: {
      cream: '/hero-lab/meal-chicken-cream.webp',
      dark: '/hero-lab/meal-chicken-dark.webp',
    },
  },
  {
    id: 'shake',
    rawInput: '40g whey isolate + 250ml skim milk + 1 banana',
    entry: 'Weighed',
    timeLabel: '08:20',
    items: [
      {
        name: 'Whey isolate (40g)',
        calories: 152,
        protein: 32,
        carbs: 3,
        fat: 1,
      },
      {
        name: 'Skim milk (250ml)',
        calories: 88,
        protein: 9,
        carbs: 12,
        fat: 0,
      },
      { name: 'Banana (1)', calories: 105, protein: 1, carbs: 27, fat: 0 },
    ],
    art: {
      cream: '/hero-lab/meal-shake-cream.webp',
      dark: '/hero-lab/meal-shake-dark.webp',
    },
  },
];

/** Meal totals, summed from the rows so the card can never disagree with itself. */
export function mealTotals(meal: HeroMeal) {
  return meal.items.reduce(
    (sum, item) => ({
      calories: sum.calories + item.calories,
      protein: sum.protein + item.protein,
      carbs: sum.carbs + item.carbs,
      fat: sum.fat + item.fat,
    }),
    { calories: 0, protein: 0, carbs: 0, fat: 0 }
  );
}
