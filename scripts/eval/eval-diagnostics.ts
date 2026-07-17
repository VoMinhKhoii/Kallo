import type { V2PipelineDiagnostics } from '@/lib/ai/pipeline/grounded-orchestrator';
import type { PipelineResult } from '@/lib/ai/types';
import type { EvalIngredientResult, SilentZeroViolation } from './eval-types';

export function buildIngredientResults(
  diagnostics: V2PipelineDiagnostics
): EvalIngredientResult[] {
  const rows: EvalIngredientResult[] = [];
  let flatIndex = 0;

  diagnostics.decomposition.mealItems.forEach((mealItem, mealItemIdx) => {
    mealItem.ingredients.forEach((ingredient, ingredientIdx) => {
      const verdict = diagnostics.verdicts.find(
        (item) =>
          item.mealItemIdx === mealItemIdx &&
          item.ingredientIdx === ingredientIdx
      );
      const match = diagnostics.matchResults.find(
        (item) => item.ingredientIndex === flatIndex
      );
      const selected =
        verdict?.verdict === 'accepted' && verdict.selectedCandidateIdx !== null
          ? match?.candidates[verdict.selectedCandidateIdx]
          : undefined;
      rows.push({
        mealItemName: mealItem.name,
        ingredientName: ingredient.rawName,
        outcome: verdict?.verdict ?? 'missing',
        provenance: selected?.info.matchType ?? 'unmatched',
        similarity: selected?.info.similarity ?? null,
        matchedDbName: selected?.info.matchedName ?? null,
        foodCompositionId: selected?.info.foodCompositionId ?? null,
      });
      flatIndex++;
    });
  });

  return rows;
}

export function findSilentZeros(
  result: PipelineResult,
  zeroCalExempt: boolean
): SilentZeroViolation[] {
  if (zeroCalExempt) return [];
  return result.mealItems.flatMap((mealItem) =>
    mealItem.ingredients.flatMap((ingredient) => {
      const kcalMid = ingredient.boundedNutrition.caloriesKcal?.mid ?? null;
      const reasons: SilentZeroViolation['reasons'] = [];
      if (ingredient.estimatedGrams <= 1) reasons.push('grams_lte_1');
      if (kcalMid === 0) reasons.push('kcal_zero');
      return reasons.length > 0
        ? [
            {
              mealItemName: mealItem.name,
              ingredientName: ingredient.ingredientName,
              grams: ingredient.estimatedGrams,
              kcalMid,
              reasons,
            },
          ]
        : [];
    })
  );
}
