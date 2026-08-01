import { resolveRelogSources } from '@/lib/actions/meals/relog/resolve-sources';
import type { PipelineResult } from '@/lib/ai/types';
import { db } from '@/lib/db';
import {
  buildFrozenMealItem,
  mergeRelogIntoPipelineResult,
} from '@/lib/logging/relog/build-relog-pipeline-result';
import { type RelogRef, weakestConfidence } from '@/lib/logging/relog/relog';

/**
 * Combined-relog merge for `/api/analyze-meal`: fold the user's picks into the
 * AI pipeline result AFTER the pipeline has run on the free text alone.
 *
 * The picks are resolved deterministically and copied verbatim (as frozen items
 * with degenerate bounded triples) — they NEVER enter `analyzeMeal`, so a past
 * dish's goal-adjusted numbers are reproduced, not re-estimated.
 *
 * The resolve runs in a short transaction with `FOR UPDATE` on the source meals
 * (like the direct writer + pure-relog staging): without the lock a concurrent
 * split-share could halve a source's rows and set `portion_factor < 1` between
 * the eligibility check and the row read, snapshotting halved rows under the
 * full dish name.
 *
 * Returns the merged result AND the resolved dish names, so the caller can fold
 * them into the persisted `rawInput` (otherwise the combined meal's history text
 * would be the free text alone, dropping the relogged dishes).
 */
export async function applyRelogRefs(
  aiResult: PipelineResult,
  refs: RelogRef[],
  userId: string
): Promise<{ result: PipelineResult; dishNames: string[] }> {
  const { dishes, sourceConfidences } = await db.transaction((tx) =>
    resolveRelogSources(tx, userId, refs, { lock: true })
  );
  const relogItems = dishes.map((dish) => buildFrozenMealItem(dish));
  const relogConfidence = weakestConfidence(sourceConfidences);
  const result = mergeRelogIntoPipelineResult(
    aiResult,
    relogItems,
    // `mergeRelogIntoPipelineResult` maps null/unknown → 'low' internally, so a
    // null here can never silently upgrade the combined meal's confidence.
    relogConfidence === 'medium' || relogConfidence === 'high'
      ? relogConfidence
      : 'low'
  );
  return { result, dishNames: dishes.map((d) => d.name) };
}
