import type {
  MatchInfo,
  PickBestSourceContext,
} from '@/lib/ai/matching/match-constants';
import type { DecomposedIngredient } from '@/lib/ai/types/decomposition';

export interface MatchStateInfo {
  expectedState: 'raw' | 'cooked';
  stateSource: 'explicit' | 'method_lookup' | 'unknown';
}

export const ingredientStateInfo = (
  ing: DecomposedIngredient
): MatchStateInfo => ({
  expectedState: ing.expectedState ?? 'cooked',
  stateSource: ing._stateSource ?? 'unknown',
});

/**
 * A state derived from nothing better than a default is not evidence, so it
 * must not drive the tie-breaker below — it degrades to 'unknown'.
 */
export function buildPickContext(
  stateInfo: MatchStateInfo
): PickBestSourceContext {
  return {
    expectedState:
      stateInfo.stateSource === 'unknown' ? 'unknown' : stateInfo.expectedState,
  };
}

/**
 * Pick the best match between FAO and USDA candidates.
 *
 * Tie-break order: expected state match first, then similarity. Source
 * preference is intentionally not a tie-breaker.
 */
export function pickBestSource(
  fao: MatchInfo | null,
  usda: MatchInfo | null,
  ctx: PickBestSourceContext
): MatchInfo | null {
  if (fao && !usda) return fao;
  if (!fao && usda) return usda;
  if (!fao && !usda) return null;

  if (ctx.expectedState !== 'unknown') {
    const faoStateMatches = fao!.state === ctx.expectedState;
    const usdaStateMatches = usda!.state === ctx.expectedState;
    if (faoStateMatches && !usdaStateMatches) return fao;
    if (!faoStateMatches && usdaStateMatches) return usda;
  }

  return fao!.similarity >= usda!.similarity ? fao : usda;
}
