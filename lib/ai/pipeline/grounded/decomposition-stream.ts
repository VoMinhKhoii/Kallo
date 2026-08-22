import { createCompactIdSequence } from '@/lib/ai/pipeline/contracts/compact-id';
import type { MealDecompositionWithIds } from '@/lib/ai/pipeline/contracts/decomposition-ids';
import { extractMealItemNameOccurrences } from '@/lib/ai/streaming/parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { MealDecomposition } from '@/lib/ai/types/decomposition';
import { capitalizeFirst } from '@/lib/core/text/capitalize';

interface DecompositionStreamControllerInput {
  emit: (event: StreamEvent) => void;
  prewarm: (accumulated: string) => void;
}

export function createDecompositionStreamController({
  emit,
  prewarm,
}: DecompositionStreamControllerInput) {
  const emittedCounts = new Map<string, number>();
  const mealItemIds = new Map<string, string>();
  const idSequence = createCompactIdSequence();
  let mealItemIndex = 0;
  // Phase A.7 instrumentation: per-chunk extraction cost. Reported on flush.
  let extractAccumMs = 0;
  let chunkCount = 0;

  const resetAttempt = () => {
    emittedCounts.clear();
    // NOTE: mealItemIds is deliberately preserved across attempts. v1's
    // gemini-SDK-internal retry path (e.g., on transient 5xx) calls this
    // between stream attempts of the SAME logical decomposition; clients
    // expect the same logical meal item to keep the same mealItemId so
    // partially-streamed event sequences from attempt 1 still reconcile
    // with the final result. v2's language-guard retry — which IS a fresh
    // semantic attempt — recreates the entire controller instead (see
    // recreateDecompStream() in grounded-orchestrator.ts) so stale IDs
    // can't leak there either.
    mealItemIndex = 0;
    extractAccumMs = 0;
    chunkCount = 0;
  };

  const handleChunk = (accumulated: string) => {
    prewarm(accumulated);

    const t0 = performance.now();
    const newOccurrences = extractMealItemNameOccurrences(
      accumulated,
      emittedCounts
    );
    extractAccumMs += performance.now() - t0;
    chunkCount += 1;
    for (const { name, occurrence } of newOccurrences) {
      const displayName = capitalizeFirst(name);
      const key = `${displayName}::${occurrence}`;
      const mealItemId = mealItemIds.get(key) ?? idSequence.nextMealItemId();
      mealItemIds.set(key, mealItemId);
      emit({
        type: 'item_name',
        name: displayName,
        index: mealItemIndex++,
        mealItemId,
      });
    }
  };

  const getStreamTimings = () => ({
    extractAccumMs,
    chunkCount,
  });

  /**
   * Snapshot of the streamed `${displayName}::${occurrence}` → mealItemId
   * map. Used by v2's Call 2 streaming to look up the mealItemId for each
   * completed meal item (so `item_macros` events use the same id as the
   * `item_name` events that streamed during Call 1).
   */
  const getStreamedMealItemIds = (): Map<string, string> =>
    new Map(mealItemIds);

  const applyParsedIds = (decomposition: MealDecomposition) => {
    const parseCounts = new Map<string, number>();
    for (const mealItem of decomposition.mealItems) {
      const displayName = capitalizeFirst(mealItem.name);
      const occurrence = (parseCounts.get(displayName) ?? 0) + 1;
      parseCounts.set(displayName, occurrence);
      const streamedId = mealItemIds.get(`${displayName}::${occurrence}`);
      if (streamedId) {
        mealItem.mealItemId = streamedId;
      }
    }
  };

  const emitUnstreamed = (decomposition: MealDecompositionWithIds) => {
    const streamedIds = new Set(mealItemIds.values());
    for (const mealItem of decomposition.mealItems) {
      if (!streamedIds.has(mealItem.mealItemId)) {
        emit({
          type: 'item_name',
          name: mealItem.name,
          index: mealItemIndex++,
          mealItemId: mealItem.mealItemId,
        });
      }
    }
  };

  return {
    resetAttempt,
    handleChunk,
    applyParsedIds,
    emitUnstreamed,
    getStreamTimings,
    getStreamedMealItemIds,
  };
}
