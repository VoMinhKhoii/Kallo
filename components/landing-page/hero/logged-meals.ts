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
 * Only ids, numbers and artwork live here. Every visible string — the typed
 * sentence, the dish names, the entry chip — is a message key, because this is
 * the real landing page and it has to speak Vietnamese too. Labels resolve
 * under `landing.hero.meals.<id>` and `landing.hero.entry`.
 *
 * Numbers are illustrative, but internally consistent: every total is the exact
 * sum of its item rows, because a landing page showing arithmetic that doesn't
 * add up is worse than one showing none.
 */
export interface HeroMealItem {
  /** Message key under `landing.hero.meals.<mealId>.items`. */
  id: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface HeroMeal {
  /** Message key under `landing.hero.meals`. */
  id: string;
  /** How the portion was arrived at — the two audiences, side by side. */
  entry: 'eyeballed' | 'weighed';
  timeLabel: string;
  /** The derived rows. Totals are computed from these, never hardcoded. */
  items: HeroMealItem[];
  /**
   * The painterly still life this meal wears when its card is active.
   *
   * Cream ground means the dark-painted plate is the one that reads — light
   * paint on cream subtracts rather than glows, and at low opacity only the
   * darkest mass survives. The four `-cream` plates in the same folder are the
   * espresso set from the lab; they are kept deliberately, not stranded, so a
   * dark ground can be picked back up without regenerating anything.
   */
  art: string;
}

export const HERO_MEALS: readonly HeroMeal[] = [
  {
    id: 'pho',
    entry: 'eyeballed',
    timeLabel: '07:40',
    items: [
      { id: 'pho', calories: 420, protein: 30, carbs: 50, fat: 10 },
      { id: 'quay', calories: 110, protein: 4, carbs: 12, fat: 3 },
    ],
    art: '/landing/meals/meal-pho-dark.webp',
  },
  {
    id: 'bol',
    entry: 'eyeballed',
    timeLabel: '21:15',
    items: [
      { id: 'pasta', calories: 380, protein: 21, carbs: 40, fat: 15 },
      { id: 'salad', calories: 90, protein: 3, carbs: 8, fat: 4 },
    ],
    art: '/landing/meals/meal-bol-dark.webp',
  },
  {
    id: 'chicken',
    entry: 'weighed',
    timeLabel: '13:05',
    items: [
      { id: 'chicken', calories: 245, protein: 46, carbs: 0, fat: 5 },
      { id: 'rice', calories: 235, protein: 4, carbs: 52, fat: 1 },
      { id: 'oil', calories: 120, protein: 0, carbs: 0, fat: 14 },
    ],
    art: '/landing/meals/meal-chicken-dark.webp',
  },
  {
    id: 'shake',
    entry: 'weighed',
    timeLabel: '08:20',
    items: [
      { id: 'whey', calories: 152, protein: 32, carbs: 3, fat: 1 },
      { id: 'milk', calories: 88, protein: 9, carbs: 12, fat: 0 },
      { id: 'banana', calories: 105, protein: 1, carbs: 27, fat: 0 },
    ],
    art: '/landing/meals/meal-shake-dark.webp',
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
