/**
 * Landing-page capture, v2 — run against the FIXED pipeline.
 *
 * Every pair is "what a person actually types" followed by "the same thing
 * with the few words they'd really add". No variant states the default out
 * loud, because nobody does.
 *
 * Resumable: each case is persisted as it lands, so a wedged Call 2 costs one
 * case rather than the run.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import type { UserContext } from '@/lib/ai/types/user-context';

const OUT = 'scripts/eval/landing-v2.json';
const CASE_TIMEOUT_MS = 180_000;

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

type Sample = {
  category: string;
  locale: 'vi' | 'en';
  variant: string;
  text: string;
};

const SAMPLES: Sample[] = [
  // 1 — trimming fat
  {
    category: 'fat',
    locale: 'vi',
    variant: 'default',
    text: '1 chén cơm trắng + 1 đùi gà nướng + tô canh cải xanh',
  },
  {
    category: 'fat',
    locale: 'vi',
    variant: 'trimmed',
    text: '1 chén cơm trắng + 1 đùi gà nướng bỏ da + tô canh cải xanh',
  },
  {
    category: 'fat',
    locale: 'en',
    variant: 'default',
    text: 'a bowl of rice with a grilled chicken thigh and a side of greens',
  },
  {
    category: 'fat',
    locale: 'en',
    variant: 'trimmed',
    text: 'a bowl of rice with a grilled chicken thigh, skin removed, and a side of greens',
  },

  // 2 — cooking oil, three levels, default first
  {
    category: 'oil',
    locale: 'vi',
    variant: 'default',
    text: '1 tô bún đậu hũ chiên + rau sống',
  },
  {
    category: 'oil',
    locale: 'vi',
    variant: 'light',
    text: '1 tô bún đậu hũ chiên ít dầu + rau sống',
  },
  {
    category: 'oil',
    locale: 'vi',
    variant: 'none',
    text: '1 tô bún đậu hũ nướng không dầu + rau sống',
  },
  {
    category: 'oil',
    locale: 'en',
    variant: 'default',
    text: 'a plate of fries with a beef burger',
  },
  {
    category: 'oil',
    locale: 'en',
    variant: 'light',
    text: 'a plate of pan-fried potatoes with a beef burger',
  },
  {
    category: 'oil',
    locale: 'en',
    variant: 'none',
    text: 'a plate of air-fried potatoes with a beef burger',
  },

  // 3 — raw vs cooked weight
  {
    category: 'rawcooked',
    locale: 'vi',
    variant: 'default',
    text: '300g ức gà nấu chậm + 150g khoai lang + salad dầu giấm',
  },
  {
    category: 'rawcooked',
    locale: 'vi',
    variant: 'raw',
    text: '300g ức gà cân sống nấu chậm + 150g khoai lang + salad dầu giấm',
  },
  {
    category: 'rawcooked',
    locale: 'en',
    variant: 'default',
    text: '300g slow-cooked chicken breast, 150g sweet potato, green salad',
  },
  {
    category: 'rawcooked',
    locale: 'en',
    variant: 'raw',
    text: '300g raw-weight chicken breast, slow-cooked, 150g sweet potato, green salad',
  },

  // 4 — rice by count
  {
    category: 'rice',
    locale: 'vi',
    variant: 'one',
    text: '1 chén cơm + thịt kho trứng',
  },
  {
    category: 'rice',
    locale: 'vi',
    variant: 'two',
    text: '2 chén cơm + thịt kho trứng',
  },
  {
    category: 'rice',
    locale: 'en',
    variant: 'one',
    text: 'one cup of rice with braised pork and egg',
  },
  {
    category: 'rice',
    locale: 'en',
    variant: 'two',
    text: 'two cups of rice with braised pork and egg',
  },

  // 5 — braising sugar
  {
    category: 'kho',
    locale: 'vi',
    variant: 'default',
    text: 'cá lóc kho tộ + 1 chén cơm',
  },
  {
    category: 'kho',
    locale: 'vi',
    variant: 'less',
    text: 'cá lóc kho tộ ít đường + 1 chén cơm',
  },
  {
    category: 'kho',
    locale: 'en',
    variant: 'default',
    text: 'braised pork belly with rice',
  },
  {
    category: 'kho',
    locale: 'en',
    variant: 'less',
    text: 'braised pork belly, light on the sugar, with rice',
  },

  // 6 — portion vessels
  {
    category: 'portion',
    locale: 'vi',
    variant: 'containers',
    text: '1 dĩa cơm tấm sườn + 1 tô canh khổ qua + 1 ly trà đá',
  },
  {
    category: 'portion',
    locale: 'vi',
    variant: 'fish',
    text: '1 phi lê cá hồi áp chảo + salad rau',
  },
  {
    category: 'portion',
    locale: 'vi',
    variant: 'beef',
    text: '1 miếng bò bít tết + khoai tây chiên',
  },
  {
    category: 'portion',
    locale: 'vi',
    variant: 'poultry',
    text: '2 miếng gà rán + 1 chén cơm',
  },
  {
    category: 'portion',
    locale: 'en',
    variant: 'containers',
    text: 'a plate of roast chicken with potatoes, a bowl of tomato soup and a glass of orange juice',
  },
  {
    category: 'portion',
    locale: 'en',
    variant: 'fish',
    text: '1 salmon fillet, pan-seared, with a green salad',
  },
  {
    category: 'portion',
    locale: 'en',
    variant: 'beef',
    text: '1 grilled steak with fries',
  },
  {
    category: 'portion',
    locale: 'en',
    variant: 'poultry',
    text: '2 pieces of fried chicken with a side of coleslaw',
  },
];

const keyOf = (s: Sample) => `${s.category}.${s.locale}.${s.variant}`;

const [{ analyzeMealV2 }, gemini, { db }, { toParsedMeal }] = await Promise.all(
  [
    import('@/lib/ai/pipeline/grounded/orchestrator'),
    import('@/lib/ai/provider/provider'),
    import('@/lib/infra/db/client'),
    import('@/lib/ai/adapters/parsed-meal'),
  ]
);
const provider = gemini.resolveGeminiProvider();
const client = gemini.createGeminiClient(provider);

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
      console.log(
        `   retry ${attempt}/${attempts}: ${(error as Error).message}`
      );
      if (attempt === attempts) throw error;
    }
  }
  throw new Error('unreachable');
}

const byKey: Record<string, any> = (() => {
  try {
    return JSON.parse(readFileSync(OUT, 'utf8')).byKey ?? {};
  } catch {
    return {};
  }
})();

const persist = () =>
  writeFileSync(
    OUT,
    `${JSON.stringify(
      {
        capturedAt: new Date().toISOString(),
        provider: provider.provider,
        modelProfile: process.env.PIPELINE_MODEL_PROFILE ?? 'stable',
        byKey,
      },
      null,
      2
    )}\n`
  );

const todo = SAMPLES.filter((s) => !byKey[keyOf(s)]);
console.log(
  `provider: ${provider.provider}  ·  ${Object.keys(byKey).length} already captured, ${todo.length} to go\n`
);

let ok = 0;
let failed = 0;
for (const [i, s] of todo.entries()) {
  const started = Date.now();
  try {
    const res = await run(s.text);
    const ms = Date.now() - started;
    if (!res.success) {
      failed++;
      console.log(`✗ ${keyOf(s)} — ${JSON.stringify(res).slice(0, 160)}`);
      continue;
    }
    const parsed = toParsedMeal(res.data);
    byKey[keyOf(s)] = { ...s, ms, parsed, raw: res.data };
    persist();
    ok++;
    const t = parsed.totalMacros;
    console.log(
      `✓ ${String(i + 1).padStart(2)}/${todo.length} ${keyOf(s).padEnd(24)}${Math.round(ms / 1000)}s  ${Math.round(t.calories)} kcal  P${Math.round(t.protein)} C${Math.round(t.carbs)} F${Math.round(t.fat)}`
    );
  } catch (error) {
    failed++;
    console.log(`✗ ${keyOf(s)} — ${(error as Error).message}`);
  }
}

persist();

console.log(`\n${'='.repeat(96)}\n`);
for (const category of [...new Set(SAMPLES.map((s) => s.category))]) {
  for (const locale of ['vi', 'en'] as const) {
    const rows = SAMPLES.filter(
      (s) => s.category === category && s.locale === locale
    )
      .map((s) => byKey[keyOf(s)])
      .filter(Boolean);
    if (rows.length === 0) continue;
    console.log(`${category.toUpperCase()} · ${locale}`);
    for (const r of rows) {
      const t = r.parsed.totalMacros;
      const vessels = r.parsed.items
        .map((it: any) =>
          it.vessel
            ? `${it.vessel.family} t${it.vessel.tier}${it.vessel.kind ? `/${it.vessel.kind}` : ''}`
            : '—'
        )
        .join(', ');
      console.log(
        `  ${String(r.variant).padEnd(12)}${String(Math.round(t.calories)).padStart(5)} kcal  P${String(Math.round(t.protein)).padStart(3)} C${String(Math.round(t.carbs)).padStart(3)} F${String(Math.round(t.fat)).padStart(3)}  | ${vessels}`
      );
    }
    console.log('');
  }
}
console.log(`${ok} ok, ${failed} failed  ·  wrote ${OUT}`);
process.exit(0);
