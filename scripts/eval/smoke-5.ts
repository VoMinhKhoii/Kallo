/**
 * 5-meal smoke run on the current branch (ai-studio provider).
 *
 * Reports per-item grams, macros, vessel and cooking method so three things
 * are visible at once: the cooking-oil fat fix, whether Call 1 still
 * broadcasts one cooking method across every ingredient, and how the recently
 * merged matching work handles a previously zero-candidate dish.
 */
import type { UserContext } from '@/lib/ai/types';

const NEUTRAL: UserContext = {
  goal: 'maintaining',
  aggression: 0,
  countryOfOrigin: 'VN',
  countryOfResidence: 'VN',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

const CASES = [
  { id: 'mi-goi', why: 'zero-candidate dish (PR #255 target)', text: '1 tô mì gói trứng' },
  { id: 'tofu-deep', why: 'cooking-oil fat fix', text: '1 tô bún đậu hũ chiên ngập dầu + rau sống' },
  { id: 'rau-xao', why: 'stir-fried veg (91% oil-loss case)', text: '1 dĩa rau muống xào tỏi + 1 chén cơm trắng' },
  { id: 'com-tam', why: 'multi-vessel resolution', text: '1 dĩa cơm tấm sườn + 1 tô canh khổ qua + 1 ly trà đá' },
  { id: 'en-burger', why: 'english control', text: 'a plate of deep-fried potatoes with a beef burger' },
];

const [{ analyzeMealV2 }, gemini, { db }, { toParsedMeal }] = await Promise.all([
  import('@/lib/ai/pipeline/grounded-orchestrator'),
  import('@/lib/ai/gemini'),
  import('@/lib/db'),
  import('@/lib/ai/mappers'),
]);
const provider = gemini.resolveGeminiProvider();
const client = gemini.createGeminiClient(provider);
console.log(`provider: ${provider.provider}\n`);

const CASE_TIMEOUT_MS = 180_000;

async function run(text: string, attempts = 3) {
  for (let attempt = 1; attempt <= attempts; attempt++) {
    let handle: ReturnType<typeof setTimeout> | undefined;
    try {
      return await Promise.race([
        analyzeMealV2(text, NEUTRAL, db, client),
        new Promise<never>((_, reject) => {
          handle = setTimeout(
            () => reject(new Error(`timeout after ${CASE_TIMEOUT_MS}ms`)),
            CASE_TIMEOUT_MS
          );
        }),
      ]).finally(() => clearTimeout(handle));
    } catch (error) {
      console.log(`   retry ${attempt}/${attempts}: ${(error as Error).message}`);
      if (attempt === attempts) throw error;
    }
  }
  throw new Error('unreachable');
}

type Ing = {
  ingredientName?: string;
  estimatedGrams?: number;
  cookingMethod?: string | null;
  boundedNutrition?: { fatG?: { low: number; mid: number; high: number } };
};

let ok = 0;
let failed = 0;
const timings: number[] = [];

for (const c of CASES) {
  const started = Date.now();
  let res: Awaited<ReturnType<typeof analyzeMealV2>>;
  try {
    res = await run(c.text);
  } catch (error) {
    failed++;
    console.log(`✗ ${c.id}  ${(error as Error).message}\n`);
    continue;
  }
  const ms = Date.now() - started;
  timings.push(ms);
  if (!res.success) {
    failed++;
    console.log(`✗ ${c.id}  ${JSON.stringify(res).slice(0, 160)}\n`);
    continue;
  }
  ok++;
  const p = toParsedMeal(res.data);
  const t = p.totalMacros;
  console.log(
    `✓ ${c.id}  (${c.why})  ${Math.round(ms / 1000)}s\n  "${c.text}"\n  ${Math.round(t.calories)} kcal  P${Math.round(t.protein)} C${Math.round(t.carbs)} F${Math.round(t.fat)}`
  );
  for (const item of p.items) {
    const v = item.vessel as
      | { family: string; tier: number; dishClass?: string; kind?: string }
      | undefined;
    console.log(
      `    item: ${String(item.name).padEnd(34)}${Math.round(item.quantity)}g  ${
        v
          ? `${v.family} t${v.tier}${v.dishClass ? `/${v.dishClass}` : ''}${v.kind ? `/${v.kind}` : ''}`
          : '— no vessel'
      }`
    );
  }
  const methods = new Set<string>();
  for (const mi of res.data.mealItems as Array<{ ingredients?: Ing[] }>) {
    for (const ing of mi.ingredients ?? []) {
      methods.add(ing.cookingMethod ?? 'null');
      console.log(
        `      ${String(ing.ingredientName).padEnd(24)}${String(Math.round(ing.estimatedGrams ?? 0)).padStart(5)}g  method=${String(ing.cookingMethod ?? 'null').padEnd(12)}fat=${
          ing.boundedNutrition?.fatG
            ? `${ing.boundedNutrition.fatG.low.toFixed(1)}/${ing.boundedNutrition.fatG.mid.toFixed(1)}/${ing.boundedNutrition.fatG.high.toFixed(1)}`
            : '?'
        }`
      );
    }
  }
  console.log(
    `    distinct cooking methods across ingredients: ${methods.size} ${methods.size === 1 ? '(UNIFORM — bug 1 still present)' : '(varied)'}\n`
  );
}

const sorted = [...timings].sort((a, b) => a - b);
console.log(
  `\n${ok}/${CASES.length} ok, ${failed} failed` +
    (sorted.length
      ? `  ·  median ${Math.round(sorted[Math.floor(sorted.length / 2)] / 1000)}s, max ${Math.round(sorted[sorted.length - 1] / 1000)}s`
      : '')
);
process.exit(failed > 0 ? 1 : 0);
