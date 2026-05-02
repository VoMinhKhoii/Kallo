import { extractMealItemNameOccurrences } from '@/lib/ai/streaming/parsers';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { MealDecomposition } from '@/lib/ai/types';
import { capitalizeFirst } from '@/lib/utils';
import { generateMealItemId, type MealDecompositionWithIds } from './ids';

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
  let mealItemIndex = 0;

  const resetAttempt = () => {
    emittedCounts.clear();
    mealItemIndex = 0;
  };

  const handleChunk = (accumulated: string) => {
    prewarm(accumulated);

    const newOccurrences = extractMealItemNameOccurrences(
      accumulated,
      emittedCounts
    );
    for (const { name, occurrence } of newOccurrences) {
      const displayName = capitalizeFirst(name);
      const key = `${displayName}::${occurrence}`;
      const mealItemId = mealItemIds.get(key) ?? generateMealItemId();
      mealItemIds.set(key, mealItemId);
      emit({
        type: 'item_name',
        name: displayName,
        index: mealItemIndex++,
        mealItemId,
      });
    }
  };

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
  };
}
