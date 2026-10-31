/**
 * Food page capture: run each detailed meal on a food page through the real
 * pipeline once, and write the numbers the page shows to
 * `lib/seo/food-pages/<slug>.json`. Run with the production model profile:
 *
 *   ANTHROPIC_API_KEY=$CLAUDE_API_KEY PIPELINE_MODEL_PROFILE=haiku \
 *     bun --conditions=react-server scripts/seo/capture-food-page.ts chicken-burrito
 *
 * Resumable: each raw pipeline result is cached in
 * `.cache/food-pages/<slug>.capture.json` as it lands, so a failed meal costs
 * one rerun, not the page. Delete the cache to capture afresh.
 *
 * Meals are written the way people log them: parts, amounts and what was left
 * out ("no rice, a bit of cheese"). A bare "1 chicken burrito" shows nothing
 * Kallo does that a lookup table does not.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { UserContext } from '@/lib/ai/types/user-context';
import type {
  FoodPageCapture,
  FoodPageVariant,
} from '@/lib/seo/food-pages/pages';

const MEALS: Record<string, { key: string; text: string }[]> = {
  'chicken-burrito': [
    {
      key: 'shop',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + cheese + sour cream + guacamole)',
    },
    {
      key: 'shop-lighter',
      text: 'Chicken burrito from a burrito shop (large flour tortilla + grilled chicken + white rice + black beans + salsa, no cheese, no sour cream)',
    },
    {
      key: 'bowl-no-rice',
      text: 'Chicken burrito bowl (1 tortilla + 1 scoop of grilled chicken + salad and pineapple + a bit of cheese, no rice)',
    },
    {
      key: 'homemade',
      text: 'Homemade chicken burrito (1 small flour tortilla + 100g grilled chicken breast + lettuce + salsa + a bit of cheese)',
    },
  ],
};

/**
 * The food table a composition row came from, by its id prefix. A public page
 * never shows an ingredient Kallo could not match, so no row stops the run.
 */
function sourceOf(foodCompositionId: string | null, name: string): string {
  if (!foodCompositionId) {
    throw new Error(`"${name}" matched no food row: reword the meal`);
  }
  if (foodCompositionId.startsWith('usda_')) return 'USDA FoodData Central';
  if (foodCompositionId.startsWith('fao_')) return 'FAO/INFOODS';
  throw new Error(
    `no source name for "${foodCompositionId}": add its prefix to sourceOf`
  );
}

const slug = process.argv[2] ?? '';
const meals = MEALS[slug];
if (!meals) throw new Error(`unknown food page "${slug}"`);
const CACHE = `.cache/food-pages/${slug}.capture.json`;
const OUT = `lib/seo/food-pages/${slug}.json`;

// A global default user: no country-specific portion habits.
const USER: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'US',
  countryOfResidence: 'US',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const [
  { analyzeMealV2 },
  gemini,
  { db },
  { toParsedMeal },
  { CLAUDE_FALLBACK_MODEL },
] = await Promise.all([
  import('@/lib/ai/pipeline/grounded/orchestrator'),
  import('@/lib/ai/provider/provider'),
  import('@/lib/infra/db/client'),
  import('@/lib/ai/adapters/parsed-meal'),
  import('@/lib/ai/pipeline/config/model-profile'),
]);
const client = gemini.createPipelineLlm(gemini.resolveGeminiProvider(), {
  fallbackModel: CLAUDE_FALLBACK_MODEL,
});

type PipelineResult = Parameters<typeof toParsedMeal>[0];
type Cached = { capturedAt: string; byKey: Record<string, PipelineResult> };

const cache: Cached = (() => {
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  } catch {
    return { capturedAt: new Date().toISOString(), byKey: {} };
  }
})();
mkdirSync('.cache/food-pages', { recursive: true });

for (const meal of meals.filter((m) => !cache.byKey[m.key])) {
  const res = await analyzeMealV2(meal.text, USER, db, client);
  if (!res.success) {
    console.log(`✗ ${meal.key} — ${JSON.stringify(res).slice(0, 200)}`);
    continue;
  }
  cache.byKey[meal.key] = res.data;
  writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
  console.log(`✓ ${meal.key}`);
}

const missing = meals.filter((m) => !cache.byKey[m.key]);
if (missing.length > 0) {
  console.log(`${missing.length} meal(s) failed; rerun to retry them.`);
  process.exit(1);
}

const variants: FoodPageVariant[] = meals.map(({ key, text }) => {
  const raw = cache.byKey[key];
  const parsed = toParsedMeal(raw);
  const total = raw.boundedNutrition;
  const mid = (bound: { mid: number } | null) => Math.round(bound?.mid ?? 0);
  return {
    key,
    text,
    kcal: {
      low: Math.round(total.caloriesKcal?.low ?? 0),
      mid: mid(total.caloriesKcal),
      high: Math.round(total.caloriesKcal?.high ?? 0),
    },
    protein: mid(total.proteinG),
    carbs: mid(total.carbohydrateG),
    fat: mid(total.fatG),
    ingredients: raw.mealItems.flatMap((item) =>
      item.ingredients.map((ingredient) => ({
        name: ingredient.ingredientName,
        grams: Math.round(ingredient.estimatedGrams),
        kcal: Math.round(ingredient.displayedNutrition.caloriesKcal ?? 0),
        source: sourceOf(
          ingredient.foodCompositionId,
          ingredient.ingredientName
        ),
      }))
    ),
    dishes: parsed.items.map((item) => ({
      name: item.name,
      calories: item.macros.calories,
      protein: item.macros.protein,
      carbs: item.macros.carbs,
      fat: item.macros.fat,
    })),
  };
});

const page: FoodPageCapture = {
  capturedAt: cache.capturedAt,
  modelProfile: process.env.PIPELINE_MODEL_PROFILE ?? 'stable',
  variants,
};
writeFileSync(OUT, `${JSON.stringify(page, null, 2)}\n`);
console.log(`wrote ${OUT}`);
process.exit(0);
