/**
 * Terminal SSE outcome for a v2 analysis whose completeness gate returned
 * `unresolved`. There is no portion ask-back — a shaky estimate ships and the
 * user corrects it with the visual portion picker.
 *
 * Two causes reach here, and they want different words. A failed Call-2 chunk
 * is transient, so "try again" is the right advice. A no-macro-data carve-out
 * is not: the analysis completed and simply could not characterize a food, so
 * retrying the identical text will usually land in the same place — the user
 * needs to say it differently. Both are marked retryable because Call 2 is
 * non-deterministic and a re-run genuinely can succeed.
 */

import { logUnmatchedIngredients } from '@/lib/ai/matching/unmatched-log';
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineUnresolved } from '@/lib/ai/types/result';
import type { db as appDb } from '@/lib/infra/db/client';

export async function emitPartialFailure(args: {
  emit: (event: StreamEvent) => void;
  requestId: string;
  db: typeof appDb;
  startTime: number;
  promptVersionsUsed: Record<string, string> | null;
  unresolved?: PipelineUnresolved;
}): Promise<void> {
  const isCarveOut = args.unresolved?.reason === 'no_macro_data';
  // Distinct telemetry codes: a chunk failure is an infra signal, a carve-out
  // is a coverage signal (usually a missing food-composition row). Collapsing
  // them would hide which one is trending.
  logPipelineEnd(
    args.requestId,
    'error',
    Date.now() - args.startTime,
    args.db,
    isCarveOut ? 'no_macro_data' : 'chunk_failure',
    args.promptVersionsUsed
  );

  if (isCarveOut) {
    // Coverage log. The success path records `unmatchedIngredients`
    // (route.ts), but a gated analysis returns before that block AND the
    // bridge's carve-out never pushes to `unmatched[]` — so the failures that
    // matter MOST, a food we could not characterize at all, were the only ones
    // leaving no queryable trace. Carve-outs ONLY: a chunk failure is an infra
    // signal, not evidence that a food is missing from the composition table,
    // and logging it here would pollute the coverage signal with outages.
    // Fire-and-forget, matching the success path's pattern.
    const carvedOutNames = args.unresolved?.carvedOutNames ?? [];
    if (carvedOutNames.length > 0) {
      logUnmatchedIngredients(
        carvedOutNames.map((ingredientName) => ({
          ingredientName,
          mealContext: 'no_macro_data carve-out',
        })),
        null,
        args.db
      ).catch((err) =>
        console.error('Failed to log carved-out ingredients:', err)
      );
    }
    const name = args.unresolved?.ingredientName;
    args.emit({
      type: 'error',
      code: 'partial_analysis_failure',
      message: name
        ? `Could not work out the nutrition for "${name}". Please try describing that part differently.`
        : 'Could not work out the nutrition for part of this meal. Please try describing it differently.',
      retryable: true,
    });
    return;
  }

  args.emit({
    type: 'error',
    code: 'partial_analysis_failure',
    message:
      'Part of your meal could not be analyzed just now. Please try again.',
    retryable: true,
  });
}
