/**
 * Live end-to-end check of the cooking-oil fat fix. Runs the three tofu
 * variants through the real pipeline and asserts fat rises monotonically.
 * Throwaway verification script — not part of the eval harness.
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
  {
    label: 'none  (nướng không dầu)',
    text: '1 tô bún đậu hũ nướng không dầu + rau sống',
  },
  {
    label: 'light (chiên ít dầu)   ',
    text: '1 tô bún đậu hũ chiên ít dầu + rau sống',
  },
  {
    label: 'deep  (chiên ngập dầu) ',
    text: '1 tô bún đậu hũ chiên ngập dầu + rau sống',
  },
];

const [{ analyzeMealV2 }, gemini, { db }, { toParsedMeal }] = await Promise.all(
  [
    import('@/lib/ai/pipeline/grounded-orchestrator'),
    import('@/lib/ai/gemini'),
    import('@/lib/db'),
    import('@/lib/ai/mappers'),
  ]
);
const client = gemini.createGeminiClient(gemini.resolveGeminiProvider());

/** Call 2 can wedge silently with no error and no timeout; bound each case. */
const CASE_TIMEOUT_MS = 180_000;

/**
 * Call 2 intermittently wedges before issuing its request — Call 1 returns,
 * matching finishes, then silence with no error and no retry. Pre-existing and
 * unrelated to this change, but it means a single attempt proves nothing.
 */
async function analyzeWithRetry(text: string, attempts = 3) {
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
      console.log(
        `   attempt ${attempt}/${attempts} failed: ${(error as Error).message}`
      );
      if (attempt === attempts) throw error;
    }
  }
  throw new Error('unreachable');
}

const fats: number[] = [];
for (const c of CASES) {
  const res = await analyzeWithRetry(c.text);
  if (!res.success) {
    console.log(`✗ ${c.label}  FAILED: ${JSON.stringify(res).slice(0, 200)}`);
    continue;
  }
  const p = toParsedMeal(res.data);
  const t = p.totalMacros;
  fats.push(t.fat);
  type Ing = {
    ingredientName?: string;
    boundedNutrition?: { fatG?: { low: number; mid: number; high: number } };
  };
  const tofu = (res.data.mealItems as Array<{ ingredients?: Ing[] }>)
    .flatMap((mi) => mi.ingredients ?? [])
    .find((i) => /đậu|dau/i.test(i.ingredientName ?? ''));
  const tf = tofu?.boundedNutrition?.fatG;
  console.log(
    `${c.label}  ${Math.round(t.calories).toString().padStart(5)} kcal   total fat ${t.fat.toFixed(1).padStart(5)}g` +
      (tf
        ? `   tofu fat ${tf.low.toFixed(1)}/${tf.mid.toFixed(1)}/${tf.high.toFixed(1)}`
        : '')
  );
}

const ok = fats.length === 3 && fats[0] <= fats[1] && fats[1] <= fats[2];
console.log(
  `\n${ok ? 'PASS' : 'FAIL'}  monotonic fat none <= light <= deep : ${fats.map((f) => f.toFixed(1)).join(' <= ')}`
);
process.exit(ok ? 0 : 1);
