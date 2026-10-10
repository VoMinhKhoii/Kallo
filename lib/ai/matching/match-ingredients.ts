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
import { matchCardCandidates } from '@/lib/ai/matching/cards/retrieval';
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
  legacy: { k: number; concurrency: number }
): Promise<IngredientV2MatchResult[]> {
  return (
    (await matchCardCandidates(ingredients, db, gemini)) ??
    matchTopKPerIngredient(ingredients, dishCookingMethods, db, gemini, legacy)
  );
}

/**
 * Warms the embeddings the matcher that will run is going to ask for, as
 * Call 1 streams. Readiness is re-read per chunk: on a cold instance the card
 * catalog finishes loading mid-stream (its load starts here), and the strings
 * left to stream then warm the card matcher.
 */
export function createMatchingPrewarm(
  db: AppDb,
  gemini: GeminiClient,
  signal: AbortSignal
): (accumulated: string) => void {
  void getCardCatalog(db);
  const cards = createCardEmbeddingPrewarm(gemini, signal);
  const legacy = createV2SpeculativeMatcher(db, gemini, signal);
  return (accumulated) =>
    isCardCatalogReady() ? cards(accumulated) : legacy(accumulated);
}
