import type { z } from 'zod';
import {
  deriveV2MatchingDiagnostics,
  v2MatchingSchema,
} from './matching/v2-matching';
import { assemblySchema, decompositionSchema, matchingSchema } from './schemas';
import { findStage, normalizeStageStatus } from './stage-primitives';
import type { LlmCall, MatchDiagnosticRow, StageLog } from './types';

type V1Matched = z.infer<typeof matchingSchema>['matched'];
type DecompMealItems = z.infer<typeof decompositionSchema>['mealItems'];

/**
 * v1 rows: the stage logged ONE adjudicated winner per ingredient, joined back
 * to the decomposition by lowercased name. No candidate pool was recorded, so
 * `candidates` stays undefined — distinct from v2's empty array.
 */
function buildV1Rows(
  mealItems: DecompMealItems,
  matched: V1Matched
): Map<string, MatchDiagnosticRow[]> {
  const matchedByName = new Map(
    matched.map((m) => [m.ingredientName.toLowerCase(), m])
  );
  const rowsByMeal = new Map<string, MatchDiagnosticRow[]>();
  for (const item of mealItems) {
    rowsByMeal.set(
      item.name,
      item.ingredients.map((ing) => {
        const m = matchedByName.get(ing.name.toLowerCase());
        return {
          ingredientName: ing.name,
          grams: ing.estimatedGrams ?? null,
          matchedName: m?.matchedName ?? null,
          similarity: m?.similarity ?? null,
          confidence: m?.confidence ?? 'unmatched',
          matchType: m?.matchType ?? null,
          source: m?.source ?? null,
          latencyMs: m?.latencyMs ?? null,
          viaAlias: m?.viaAlias ?? false,
        };
      })
    );
  }
  return rowsByMeal;
}

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
  const matchingOutput = findStage(stageLogs, 'matching')?.outputJson;
  const matchingV1 = matchingSchema.safeParse(matchingOutput);
  // v2 writes a bare array of per-ingredient candidate pools, not the v1
  // `{ matched, unmatched }` object. Try it whenever v1 does not fit, so the
  // panel reports real retrieval instead of falling back to "0 matched".
  const matchingV2 = matchingV1.success
    ? null
    : v2MatchingSchema.safeParse(matchingOutput);
  const matching = {
    success: matchingV1.success || matchingV2?.success === true,
  };
  const assembly = assemblySchema.safeParse(
    findStage(stageLogs, 'assembly')?.outputJson
  );

  const mealItems = decomp.success ? decomp.data.mealItems : [];
  const languageMetadata = decomp.success
    ? (decomp.data.languageMetadata ?? null)
    : null;

  const matched = matchingV1.success ? matchingV1.data.matched : [];
  const unmatched = matchingV1.success ? matchingV1.data.unmatched : [];

  const totalIngredients = mealItems.reduce(
    (n, m) => n + m.ingredients.length,
    0
  );

  // v2 traces carry per-ingredient candidate pools joined by flat index; v1
  // traces carry one adjudicated winner joined by name. Both collapse to the
  // same MatchDiagnosticRow so the renderer stays version-agnostic.
  const v2 =
    matchingV2?.success === true
      ? deriveV2MatchingDiagnostics(mealItems, matchingV2.data)
      : null;

  const rowsByMeal = v2?.rowsByMeal ?? buildV1Rows(mealItems, matched);
  const matchedCount = v2 ? v2.matchedCount : matched.length;
  const matchRate =
    totalIngredients > 0 ? matchedCount / totalIngredients : null;

  const representedIngredientNames = new Set(
    mealItems.flatMap((item) =>
      item.ingredients.map((ing) => ing.name.toLowerCase())
    )
  );
  const unmatchedOutputRows = unmatched.filter(
    (u) => !representedIngredientNames.has(u.ingredientName.toLowerCase())
  );

  // Token + LLM totals
  const totalTokens = llmCalls.reduce(
    (n, c) => n + (c.inputTokens ?? 0) + (c.outputTokens ?? 0),
    0
  );

  // Aggregate match-strategy counts for the stage header.
  const matchStrategyCounts =
    v2?.matchStrategyCounts ??
    matched.reduce(
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
    /**
     * Which stage shape this trace was written in. v2's `matchedCount` counts
     * ingredients retrieval found candidates FOR — Call 2's CRAG verdict can
     * still reject them — so the header must not call that "matched".
     */
    matchingPipeline: v2 ? ('v2' as const) : ('v1' as const),
    rowsByMeal,
    unmatchedOutputRows,
    totalTokens,
    matchStrategyCounts,
    erroredStage,
    nutritionAssemblyStatus,
  };
}

export type PipelineDiagnostics = ReturnType<typeof derivePipelineDiagnostics>;
