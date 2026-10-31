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
 * The meals themselves, and how to write them, are in
 * `lib/seo/food-pages/meals.ts`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import type { UserContext } from '@/lib/ai/types/user-context';
import { FOOD_PAGE_MEALS } from '@/lib/seo/food-pages/meals';
import type {
  FoodPageCapture,
  FoodPageVariant,
} from '@/lib/seo/food-pages/pages';
import { isFoodSlug } from '@/lib/seo/food-pages/slugs';

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
if (!isFoodSlug(slug)) {
  throw new Error(`unknown food page "${slug}": add it to slugs.ts`);
}
const meals = FOOD_PAGE_MEALS[slug];
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
/**
 * Only results that converted cleanly are cached, each with the text it
 * answered: a reworded meal is captured again rather than reusing the answer
 * to its old wording.
 */
type Cached = Record<
  string,
  { text: string; capturedAt: string; result: PipelineResult }
>;

const cache: Cached = (() => {
  try {
    return JSON.parse(readFileSync(CACHE, 'utf8'));
  } catch {
    return {};
  }
})();
mkdirSync('.cache/food-pages', { recursive: true });

/** The page's numbers for one meal; throws on a row the page cannot name. */
function toVariant(
  key: string,
  text: string,
  raw: PipelineResult
): FoodPageVariant {
  const parsed = toParsedMeal(raw);
  return {
    key,
    text,
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
}

const variants: FoodPageVariant[] = [];
for (const meal of meals) {
  const hit = cache[meal.key];
  if (hit?.text === meal.text) {
    variants.push(toVariant(meal.key, meal.text, hit.result));
    continue;
  }
  const res = await analyzeMealV2(meal.text, USER, db, client);
  // An unresolved result is one the app itself refuses to show.
  if (!res.success || res.unresolved) {
    console.log(`✗ ${meal.key} — ${JSON.stringify(res).slice(0, 200)}`);
    continue;
  }
  try {
    variants.push(toVariant(meal.key, meal.text, res.data));
  } catch (error) {
    console.log(`✗ ${meal.key} — ${(error as Error).message}`);
    continue;
  }
  cache[meal.key] = {
    text: meal.text,
    capturedAt: new Date().toISOString(),
    result: res.data,
  };
  writeFileSync(CACHE, `${JSON.stringify(cache, null, 2)}\n`);
  console.log(`✓ ${meal.key}`);
}

if (variants.length < meals.length) {
  console.log(
    `${meals.length - variants.length} meal(s) failed; rerun to retry them.`
  );
  process.exit(1);
}

const page: FoodPageCapture = {
  // The page is dated by its newest capture.
  capturedAt: meals
    .map((meal) => cache[meal.key].capturedAt)
    .sort()
    .at(-1) as string,
  modelProfile: process.env.PIPELINE_MODEL_PROFILE ?? 'stable',
  variants,
};
writeFileSync(OUT, `${JSON.stringify(page, null, 2)}\n`);
console.log(`wrote ${OUT}`);
process.exit(0);
