import { z } from 'zod';
import type { MatchCandidateRow, MatchDiagnosticRow } from './types';

/**
 * The v2 `matching` stage log.
 *
 * v1 wrote `{ matched, unmatched }` — one winning row per ingredient, already
 * adjudicated. v2 writes a bare ARRAY of per-ingredient top-K candidate pools
 * (`IngredientV2MatchResult[]` from `lib/ai/matching/top-k-cascade.ts`) and
 * defers the pick to Call 2's CRAG verdict, which lands in the `assembly`
 * stage. Because the summary only ever knew the v1 shape, every v2 trace
 * failed `safeParse` and the whole matching panel rendered as a parse
 * fallback reading "0 matched · 0 unmatched" — regardless of what retrieval
 * actually returned.
 *
 * `ingredientIndex` is FLAT across meal items, in decomposition order (see
 * `prepare-grounding.ts`, which flattens `mealItems.flatMap(mi =>
 * mi.ingredients)` before calling the cascade). Joining by that index rather
 * than by name is what lets a zero-candidate ingredient show up at all: with
 * no candidates there is no `ingredientName` anywhere in the payload.
 */
const matchInfoSchema = z.object({
  ingredientName: z.string(),
  foodCompositionId: z.string(),
  matchedName: z.string(),
  similarity: z.number(),
  confidence: z.enum(['high', 'medium', 'low']),
  state: z.enum(['raw', 'cooked', 'unknown']).optional(),
  matchType: z.enum(['vector', 'fuzzy']).optional(),
  source: z.enum(['fao', 'usda']).optional(),
  latencyMs: z.number().optional(),
  viaAlias: z.boolean().optional(),
});

export const v2MatchingSchema = z.array(
  z.object({
    ingredientIndex: z.number().int(),
    candidates: z.array(z.object({ info: matchInfoSchema })).default([]),
  })
);

export type V2MatchingStage = z.infer<typeof v2MatchingSchema>;

interface DecomposedMealItem {
  name: string;
  ingredients: { name: string; estimatedGrams?: number | null }[];
}

export interface V2MatchingDiagnostics {
  rowsByMeal: Map<string, MatchDiagnosticRow[]>;
  /** Ingredients retrieval found at least one candidate for. */
  matchedCount: number;
  matchStrategyCounts: { vector: number; fuzzy: number; alias: number };
}

function toCandidateRow(
  info: z.infer<typeof matchInfoSchema>
): MatchCandidateRow {
  return {
    foodCompositionId: info.foodCompositionId,
    matchedName: info.matchedName,
    similarity: info.similarity,
    confidence: info.confidence,
    matchType: info.matchType ?? null,
    source: info.source ?? null,
    state: info.state ?? null,
  };
}

/**
 * Build the per-meal match rows from a v2 trace.
 *
 * The row's headline is the top-ranked candidate (RRF already ordered the
 * pool), with the rest carried on `candidates` so the panel can show what
 * retrieval actually considered — the question that sends anyone to this page
 * in the first place. An empty pool yields `confidence: 'unmatched'`, which
 * reads as an explicit zero rather than as a parse failure.
 *
 * Note this is RETRIEVAL, not the final verdict: Call 2 can still reject a
 * candidate the cascade surfaced here.
 */
export function deriveV2MatchingDiagnostics(
  mealItems: DecomposedMealItem[],
  stage: V2MatchingStage
): V2MatchingDiagnostics {
  const byIndex = new Map(stage.map((r) => [r.ingredientIndex, r]));
  const rowsByMeal = new Map<string, MatchDiagnosticRow[]>();
  const matchStrategyCounts = { vector: 0, fuzzy: 0, alias: 0 };
  let matchedCount = 0;
  let flatIndex = 0;

  for (const item of mealItems) {
    const rows: MatchDiagnosticRow[] = [];
    for (const ing of item.ingredients) {
      // No record for this flat index is NOT "retrieval returned nothing" —
      // the stage never logged the ingredient at all. `candidates` stays
      // undefined so the panel does not claim a zero-candidate pool it never
      // observed (see `MatchDiagnosticRow.candidates`).
      const result = byIndex.get(flatIndex);
      const candidates = result?.candidates.map((c) => toCandidateRow(c.info));
      const top = candidates?.[0] ?? null;
      const viaAlias = result?.candidates[0]?.info.viaAlias ?? false;
      if (top) {
        matchedCount++;
        if (top.matchType === 'vector') matchStrategyCounts.vector++;
        else if (top.matchType === 'fuzzy') matchStrategyCounts.fuzzy++;
        if (viaAlias) matchStrategyCounts.alias++;
      }
      rows.push({
        ingredientName: ing.name,
        grams: ing.estimatedGrams ?? null,
        matchedName: top?.matchedName ?? null,
        similarity: top?.similarity ?? null,
        confidence: top?.confidence ?? 'unmatched',
        matchType: top?.matchType ?? null,
        source: top?.source ?? null,
        latencyMs: null,
        viaAlias,
        candidates,
      });
      flatIndex++;
    }
    rowsByMeal.set(item.name, rows);
  }

  return { rowsByMeal, matchedCount, matchStrategyCounts };
}
