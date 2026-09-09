import { resolveComposerPicks } from '@/lib/actions/meals/relog/resolve-picks';
import type { PipelineResult } from '@/lib/ai/types/result';
import { mergeRelogIntoPipelineResult } from '@/lib/domain/logging/relog/build-relog-pipeline-result';
import type { ComposerPickRef } from '@/lib/domain/logging/relog/relog';

/**
 * Combined-pick merge for `/api/analyze-meal`: fold the user's picks into the
 * AI pipeline result AFTER the pipeline has run on the free text alone.
 *
 * The picks are resolved deterministically and copied verbatim (as frozen items
 * with degenerate bounded triples) — they NEVER enter `analyzeMeal`, so a past
 * dish's goal-adjusted numbers and a scanned label's printed ones are
 * reproduced, not re-estimated. `resolveComposerPicks` owns both halves and the
 * lock the relog half needs.
 *
 * Returns the merged result AND the resolved names, so the caller can fall back
 * to them for the persisted `rawInput` when a client sent no `displayText`
 * (otherwise the combined meal's history text would be the free text alone,
 * dropping every pick from the label).
 */
export async function applyRelogRefs(
  aiResult: PipelineResult,
  refs: ComposerPickRef[],
  userId: string
): Promise<{ result: PipelineResult; dishNames: string[] }> {
  const picks = await resolveComposerPicks(userId, refs);
  // The picks' own confidence, which `mergeRelogIntoPipelineResult` then takes
  // the weakest of against the AI half — a meal is no more confident than its
  // least confident part, and the AI half can still pull a scan's 'high' down.
  const result = mergeRelogIntoPipelineResult(
    aiResult,
    picks.items,
    picks.confidence
  );
  return { result, dishNames: picks.names };
}
