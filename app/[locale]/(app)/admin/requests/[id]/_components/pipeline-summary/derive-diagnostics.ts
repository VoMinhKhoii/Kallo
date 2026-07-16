import { assemblySchema, decompositionSchema, matchingSchema } from './schemas';
import { findStage, normalizeStageStatus } from './stage-primitives';
import type { LlmCall, MatchDiagnosticRow, StageLog } from './types';

/** Everything the summary view renders, derived once from the raw trace. */
export function derivePipelineDiagnostics(
  stageLogs: StageLog[],
  llmCalls: LlmCall[]
) {
  const stagesByName = Object.fromEntries(
    stageLogs.map((s) => [s.stage, s])
  ) as Record<string, StageLog | undefined>;

  const decomp = decompositionSchema.safeParse(
    findStage(stageLogs, 'decomposition')?.outputJson
  );
  const matching = matchingSchema.safeParse(
    findStage(stageLogs, 'matching')?.outputJson
  );
  const assembly = assemblySchema.safeParse(
    findStage(stageLogs, 'assembly')?.outputJson
  );

  const mealItems = decomp.success ? decomp.data.mealItems : [];
  const languageMetadata = decomp.success
    ? (decomp.data.languageMetadata ?? null)
    : null;

  const matched = matching.success ? matching.data.matched : [];
  const unmatched = matching.success ? matching.data.unmatched : [];

  const totalIngredients = mealItems.reduce(
    (n, m) => n + m.ingredients.length,
    0
  );
  const matchedCount = matched.length;
  const matchRate =
    totalIngredients > 0 ? matchedCount / totalIngredients : null;

  const rowsByMeal = new Map<string, MatchDiagnosticRow[]>();
  for (const item of mealItems) rowsByMeal.set(item.name, []);

  const matchedByName = new Map(
    matched.map((m) => [m.ingredientName.toLowerCase(), m])
  );
  const representedIngredientNames = new Set<string>();
  for (const item of mealItems) {
    const list = rowsByMeal.get(item.name) ?? [];
    for (const ing of item.ingredients) {
      const ingredientKey = ing.name.toLowerCase();
      representedIngredientNames.add(ingredientKey);
      const m = matchedByName.get(ingredientKey);
      list.push({
        ingredientName: ing.name,
        grams: ing.estimatedGrams ?? null,
        matchedName: m?.matchedName ?? null,
        similarity: m?.similarity ?? null,
        confidence: m?.confidence ?? 'unmatched',
        matchType: m?.matchType ?? null,
        source: m?.source ?? null,
        latencyMs: m?.latencyMs ?? null,
        viaAlias: m?.viaAlias ?? false,
      });
    }
    rowsByMeal.set(item.name, list);
  }
  const unmatchedOutputRows = unmatched.filter(
    (u) => !representedIngredientNames.has(u.ingredientName.toLowerCase())
  );

  // Token + LLM totals
  const totalTokens = llmCalls.reduce(
    (n, c) => n + (c.inputTokens ?? 0) + (c.outputTokens ?? 0),
    0
  );

  // Aggregate match-strategy counts for the stage header.
  const matchStrategyCounts = matched.reduce(
    (acc, m) => {
      if (m.matchType === 'vector') acc.vector++;
      else if (m.matchType === 'fuzzy') acc.fuzzy++;
      if (m.viaAlias) acc.alias++;
      return acc;
    },
    { vector: 0, fuzzy: 0, alias: 0 }
  );

  const erroredStage = stageLogs.find((s) => s.status === 'error');
  const nutritionAssemblyStatus = normalizeStageStatus(
    stagesByName.assembly?.status ?? stagesByName.nutrition?.status
  );

  return {
    stagesByName,
    decomp,
    matching,
    assembly,
    mealItems,
    languageMetadata,
    matched,
    unmatched,
    totalIngredients,
    matchedCount,
    matchRate,
    rowsByMeal,
    unmatchedOutputRows,
    totalTokens,
    matchStrategyCounts,
    erroredStage,
    nutritionAssemblyStatus,
  };
}

export type PipelineDiagnostics = ReturnType<typeof derivePipelineDiagnostics>;
