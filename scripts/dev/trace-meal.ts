/**
 * Trace meals through the real pipeline and keep everything needed to debug
 * a wrong answer: what Call 1 split the meal into, every candidate food row
 * per ingredient, Call 2's verdicts and portions, and the final result.
 *
 *   set -a; source .env.local; set +a
 *   ANTHROPIC_API_KEY=$CLAUDE_API_KEY PIPELINE_MODEL_PROFILE=haiku \
 *     CARD_INDEX_URI=file://$PWD/.cache/card-index \
 *     bun --conditions=react-server scripts/dev/trace-meal.ts meals.json out/
 *
 * `meals.json` is `[{ "id": "hu-tieu-nam-vang", "text": "…", "locale": "vi" }]`
 * (locale `en` or `vi`; the user is a default one from the US or Vietnam).
 * Writes `out/<id>.json` per meal and `out/summary.md` with every ingredient's
 * grams, kcal and chosen row next to its top candidates.
 *
 * Card search reads the local index (`bun card-index:local` builds it), never
 * the shared database's. Runs are not deterministic: the same text can come
 * back different, so keep the trace of the run that showed the bug.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { buildAiRequestContext } from '@/lib/ai/adapters/user-context';
import type { UserContext } from '@/lib/ai/types/user-context';

interface MealInput {
  id: string;
  text: string;
  locale: 'en' | 'vi';
}

const [inputPath, outDir] = process.argv.slice(2);
if (!inputPath || !outDir) {
  throw new Error('usage: trace-meal.ts <meals.json> <out-dir>');
}
const meals: MealInput[] = JSON.parse(readFileSync(inputPath, 'utf8'));
mkdirSync(outDir, { recursive: true });

const [{ analyzeMealV2 }, gemini, { db }, { CLAUDE_FALLBACK_MODEL }] =
  await Promise.all([
    import('@/lib/ai/pipeline/grounded/orchestrator'),
    import('@/lib/ai/provider/provider'),
    import('@/lib/infra/db/client'),
    import('@/lib/ai/pipeline/config/model-profile'),
  ]);
const client = gemini.createPipelineLlm(gemini.resolveGeminiProvider(), {
  fallbackModel: CLAUDE_FALLBACK_MODEL,
});

type Diagnostics = Parameters<
  NonNullable<NonNullable<Parameters<typeof analyzeMealV2>[5]>['onDiagnostics']>
>[0];

function defaultUser(locale: 'en' | 'vi'): UserContext {
  const country = locale === 'vi' ? 'VN' : 'US';
  return {
    goal: 'maintaining',
    aggression: 0,
    countryOfOrigin: country,
    countryOfResidence: country,
    cookingHabits: {
      oilUsage: 'normal',
      defaultRicePortion: 'medium',
      defaultProteinPortion: 'medium',
      brothConsumption: 'some',
    },
  };
}

/** One markdown table per meal: what each ingredient became and why. */
function summarize(
  meal: MealInput,
  d: Diagnostics | null,
  kcal: number | null
) {
  const lines = [`## ${meal.id}`, '', `> ${meal.text}`, ''];
  if (!d) return [...lines, 'No diagnostics (the run failed).', ''].join('\n');
  lines.push(
    `Total: ${kcal ?? '?'} kcal`,
    '',
    '| Ingredient | Portion (g, how) | Chosen row | Top candidates (kcal/100 g) |',
    '|---|---|---|---|'
  );
  let flat = 0;
  d.decomposition.mealItems.forEach((item, mi) => {
    item.ingredients.forEach((ingredient, ii) => {
      const verdict = d.verdicts.find(
        (v) => v.mealItemIdx === mi && v.ingredientIdx === ii
      );
      const match = d.matchResults.find((m) => m.ingredientIndex === flat);
      const portion = d.portionResolutions[flat];
      const chosen =
        verdict?.verdict === 'accepted' && verdict.selectedCandidateIdx !== null
          ? match?.candidates[verdict.selectedCandidateIdx]
          : undefined;
      const top = (match?.candidates ?? [])
        .slice(0, 3)
        .map(
          (c) =>
            `${c.info.matchedName} (${c.info.foodCompositionId}, ${Math.round(c.nutrition?.caloriesKcal ?? 0)})`
        )
        .join('; ');
      lines.push(
        `| ${item.name} › ${ingredient.rawName} | ${portion?.grams ? `${portion.grams.mid} (${portion.provenance})` : (portion?.provenance ?? '?')} | ${chosen ? `${chosen.info.matchedName} (${chosen.info.foodCompositionId})` : (verdict?.verdict ?? 'missing')} | ${top} |`
      );
      flat++;
    });
  });
  return [...lines, ''].join('\n');
}

const summary: string[] = ['# Meal traces', ''];
for (const meal of meals) {
  const user = buildAiRequestContext(defaultUser(meal.locale), {
    mealText: meal.text,
    requestLocale: meal.locale,
  });
  let diagnostics: Diagnostics | null = null;
  const started = Date.now();
  const response = await analyzeMealV2(meal.text, user, db, client, undefined, {
    onDiagnostics: (d) => {
      diagnostics = d;
    },
  }).catch((error: Error) => ({
    success: false as const,
    error: error.message,
  }));
  const durationMs = Date.now() - started;
  const kcal =
    'data' in response && response.data
      ? Math.round(
          response.data.mealItems
            .flatMap((i) => i.ingredients)
            .reduce((s, i) => s + (i.displayedNutrition.caloriesKcal ?? 0), 0)
        )
      : null;
  writeFileSync(
    join(outDir, `${meal.id}.json`),
    `${JSON.stringify(
      {
        ...meal,
        modelProfile: process.env.PIPELINE_MODEL_PROFILE ?? 'default',
        tracedAt: new Date(started).toISOString(),
        durationMs,
        userContext: user,
        totalKcal: kcal,
        response,
        diagnostics,
      },
      null,
      2
    )}\n`
  );
  summary.push(summarize(meal, diagnostics, kcal));
  console.log(
    `${kcal === null ? '✗' : '✓'} ${meal.id} ${kcal ?? ''} kcal (${durationMs} ms)`
  );
}
writeFileSync(join(outDir, 'summary.md'), summary.join('\n'));
process.exit(0);
