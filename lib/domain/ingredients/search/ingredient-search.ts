// The public entry for deterministic ingredient search: the one function
// `GET /api/v1/ingredients/search` calls. Everything else in this folder is
// folder-private — the retrieval arms, the fusion, and the row parsers.

import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { lexicalSearch } from './lexical-search';
import { loadRecentIngredients } from './recent-ingredients';
import { rrfFuse } from './rrf-fusion';
import { semanticSupplement } from './semantic-search';
import { backfillWithSubstringMatches } from './substring-backfill';

export interface IngredientSearchParams {
  /** Whose recents to show when `q` is empty. */
  userId: string;
  /** Already trimmed by the request contract; empty means "recent foods". */
  q: string;
  limit: number;
  /**
   * Whether a cache miss may embed `q` with a live AI-provider call — true
   * only for a user who consented to third-party AI processing. Without it
   * the semantic arm answers from cached embeddings alone, so the search is
   * trigram-led but never refused.
   */
  allowLiveEmbedding: boolean;
}

/**
 * Ranked ingredient candidates for the manual-logging picker.
 *
 * An empty query is the pre-typing state and answers with the user's recent
 * foods. Otherwise both retrieval arms run in parallel and are rank-fused. A
 * high lexical score is NOT trustworthy on its own — word_similarity
 * saturates, tying many rows that merely share a token with the query — so we
 * never let it suppress the embedding arm. The embedding arm degrades to []
 * on failure (and is skipped for 1-char queries), so the worst case is plain
 * lexical ranking, topped up by the substring backfill.
 */
export async function searchIngredients({
  userId,
  q,
  limit,
  allowLiveEmbedding,
}: IngredientSearchParams): Promise<IngredientSearchResult[]> {
  if (!q) return loadRecentIngredients(userId, limit);

  const [lexical, semantic] = await Promise.all([
    lexicalSearch(q, limit),
    semanticSupplement(q, limit, allowLiveEmbedding),
  ]);
  const ranked =
    semantic.length > 0 ? rrfFuse(lexical, semantic, limit) : lexical;
  if (ranked.length >= limit) return ranked;
  return backfillWithSubstringMatches(ranked, q, limit);
}
