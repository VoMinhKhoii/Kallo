/**
 * The ingredient matcher the pipeline calls, and the embedding prewarm that
 * goes with it. Card retrieval (`cards/`) serves once the card index is ready
 * in this database; until then (a fresh database before its backfill) the
 * legacy row matcher (`retrieve/`) does. The choice lives here so the
 * pipeline stages stay one call each.
 */
import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import {
  getCardCatalog,
  isCardCatalogReady,
} from '@/lib/ai/matching/cards/catalog';
import { createCardEmbeddingPrewarm } from '@/lib/ai/matching/cards/prewarm';
import {
  MATCH_EXPIRED,
  matchCardCandidates,
} from '@/lib/ai/matching/cards/retrieval';
import { cardIndexStatus } from '@/lib/ai/matching/cards/search-index/search-index';
import { matchTopKPerIngredient } from '@/lib/ai/matching/retrieve/top-k-cascade';
import { createV2SpeculativeMatcher } from '@/lib/ai/matching/speculative';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import type { AppDb } from '@/lib/infra/db/client';

export async function matchIngredients(
  ingredients: DecomposedIngredientV2[],
  dishCookingMethods: Array<string | null>,
  db: AppDb,
  gemini: GeminiClient,
  legacy: { k: number; concurrency: number },
  opts: { deadlineAt?: number } = {}
): Promise<IngredientV2MatchResult[]> {
  const cards = await matchCardCandidates(ingredients, db, gemini, opts);
  if (cards !== null && cards !== MATCH_EXPIRED) return cards;
  // Out of time: leave the ingredients unmatched (Call 2 estimates them)
  // rather than start the slower legacy matcher past the stage deadline,
  // which would fail the whole meal.
  if (
    cards === MATCH_EXPIRED ||
    (opts.deadlineAt !== undefined && opts.deadlineAt <= Date.now())
  ) {
    return ingredients.map((_, i) => ({ ingredientIndex: i, candidates: [] }));
  }
  return matchTopKPerIngredient(
    ingredients,
    dishCookingMethods,
    db,
    gemini,
    legacy
  );
}

/**
 * Warms the embeddings the matcher that will run is going to ask for, as
 * Call 1 streams. Readiness is re-read per chunk: on a cold instance the card
 * catalog finishes loading mid-stream (its load starts here), and the strings
 * left to stream then warm the card matcher. While the search artifact loads
 * or serves, card matching is what will run, so its prewarm runs and the
 * database catalog is not loaded at all.
 */
export function createMatchingPrewarm(
  db: AppDb,
  gemini: GeminiClient,
  signal: AbortSignal
): (accumulated: string) => void {
  const viaIndex = () => {
    const status = cardIndexStatus();
    return status === 'loading' || status === 'ready';
  };
  if (!viaIndex()) void getCardCatalog(db);
  const cards = createCardEmbeddingPrewarm(gemini, signal);
  const legacy = createV2SpeculativeMatcher(db, gemini, signal);
  return (accumulated) =>
    viaIndex() || isCardCatalogReady()
      ? cards(accumulated)
      : legacy(accumulated);
}
