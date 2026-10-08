/**
 * Card retrieval — the ingredient matcher. Same contract as the legacy
 * `matchTopKPerIngredient`, but searches curated food cards instead of raw
 * table rows:
 *
 *   vector arms   rawName, canonicalName, queryEn, nameVi → `match_food_cards`
 *                 (every string that names a card, max-sim per row; one round
 *                 trip per call)
 *   lexical arm   rawName → in-memory trigram index over card names
 *   dialect arm   tableName → BM25 over the rows' English names
 *
 * Arms are fused with reciprocal-rank fusion, collapsed to one row per concept
 * (grade/salt siblings), and cut to `k` (default 8). All sources compete
 * equally — there is no source preference.
 *
 * Returns `null` when the card index is not ready (see `card-catalog.ts`); the
 * caller falls back to the legacy matcher.
 */
import {
  classifyConfidence,
  type FuzzyMatchRow,
  MATCHING_SOURCE_BUCKETS,
  type MatchInfo,
  normalizeState,
} from '@/lib/ai/matching/match-constants';
import { isCandidateEligibleForIngredient } from '@/lib/ai/matching/rank/candidate-eligibility';
import { filterByExplicitState } from '@/lib/ai/matching/rank/candidate-ranking';
import type { IngredientV2MatchResult } from '@/lib/ai/matching/retrieve/top-k-cascade';
import { explicitWeighState } from '@/lib/ai/matching/retrieve/top-k-context';
import { attachCandidateNutrition } from '@/lib/ai/matching/retrieve/top-k-nutrition';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GeminiClient } from '@/lib/ai/provider/provider';
import { withDeadline } from '@/lib/core/async/with-deadline';
import type { AppDb } from '@/lib/infra/db/client';
import {
  type CardCatalog,
  type CatalogRow,
  getCardCatalog,
} from './card-catalog';
import { cardLabel } from './card-label';
import { searchCardVectors, type VectorHit } from './vector-arm';

export const CARD_K = 8;
const ARM_DEPTH = 30;
const RRF_K = 60;
/**
 * The vector arm's own budget, well inside the matching stage deadline, so a
 * stalled embedding or vector query still leaves time for the lexical arms.
 */
const VECTOR_ARM_TIMEOUT_MS = 4_000;

/** The four strings each ingredient is searched by, in vector-arm order. */
export function cardQueryStrings(ing: DecomposedIngredientV2): string[] {
  return [
    ing.rawName,
    ing.canonicalName,
    ing.queryEn ?? ing.canonicalName,
    ing.nameVi ?? ing.rawName,
  ];
}

function eligibilityRow(row: CatalogRow): FuzzyMatchRow {
  return {
    id: row.id,
    name_primary: row.namePrimary,
    name_alt: null,
    name_en: row.nameEn,
    state: row.state,
    similarity: 0,
  };
}

function rrf(lists: string[][]): string[] {
  const score = new Map<string, number>();
  for (const list of lists) {
    for (let i = 0; i < list.length; i++) {
      score.set(list[i], (score.get(list[i]) ?? 0) + 1 / (RRF_K + i + 1));
    }
  }
  return [...score].sort((a, b) => b[1] - a[1]).map(([id]) => id);
}

function topByConcept(
  ids: string[],
  catalog: CardCatalog,
  ingredientNames: string,
  k: number
): CatalogRow[] {
  const seen = new Set<string>();
  const out: CatalogRow[] = [];
  for (const id of ids) {
    const row = catalog.rows.get(id);
    if (!row || seen.has(row.concept)) continue;
    // The legacy matcher's categorical guards (no other bird for a bare
    // chicken query, no skin- or fat-only row unless the user asked for it).
    if (!isCandidateEligibleForIngredient(ingredientNames, eligibilityRow(row)))
      continue;
    seen.add(row.concept);
    out.push(row);
    if (out.length >= k) break;
  }
  return out;
}

export async function matchCardCandidates(
  ingredients: DecomposedIngredientV2[],
  db: AppDb,
  gemini: GeminiClient,
  options: { k?: number } = {}
): Promise<IngredientV2MatchResult[] | null> {
  const catalog = await getCardCatalog(db);
  if (!catalog) return null;
  if (ingredients.length === 0) return [];
  const k = options.k ?? CARD_K;

  const queries = ingredients.flatMap(cardQueryStrings);
  // Prewarmed while Call 1 streamed (memoized per string), so mostly cache
  // hits. An embedding or vector-query failure degrades to the lexical and
  // dialect arms — matching never blanks out because one arm is down.
  let vectorHits = new Map<number, VectorHit[]>();
  try {
    vectorHits = await withDeadline(
      gemini
        .generateEmbeddingBatch(queries)
        .then((embeddings) => searchCardVectors(embeddings, db)),
      VECTOR_ARM_TIMEOUT_MS
    );
  } catch (err) {
    console.error(
      '[card-matching] vector arm failed; using lexical arms only:',
      err
    );
  }

  const results: IngredientV2MatchResult[] = ingredients.map((ing, i) => {
    const arms = [0, 1, 2, 3].map((j) =>
      (vectorHits.get(4 * i + j) ?? []).slice(0, ARM_DEPTH).map((h) => h.id)
    );
    arms.push(catalog.lexical.search(ing.rawName, ARM_DEPTH));
    if (ing.tableName)
      arms.push(catalog.bm25En.search(ing.tableName, ARM_DEPTH));
    const best = new Map<string, number>();
    for (let j = 0; j < 4; j++)
      for (const h of vectorHits.get(4 * i + j) ?? [])
        best.set(h.id, Math.max(best.get(h.id) ?? 0, h.similarity));

    const candidates: MatchInfo[] = topByConcept(
      rrf(arms),
      catalog,
      `${ing.rawName} ${ing.canonicalName}`,
      k
    ).map((row) => {
      const similarity = best.get(row.id) ?? 0;
      return {
        ingredientName: ing.canonicalName,
        foodCompositionId: row.id,
        matchedName: row.namePrimary,
        ...(row.nameEn ? { matchedNameEn: row.nameEn } : {}),
        similarity,
        confidence: classifyConfidence(similarity),
        state: normalizeState(row.state),
        source: MATCHING_SOURCE_BUCKETS[row.sourceCode] ?? 'fao',
        matchType: 'vector',
        ...(row.card ? { cardLabel: cardLabel(row) } : {}),
      };
    });
    return {
      ingredientIndex: i,
      candidates: filterByExplicitState(
        candidates,
        explicitWeighState(ing)
      ).map((info) => ({
        info,
        nutrition: null,
        inediblePct: null,
      })),
    };
  });
  await attachCandidateNutrition(results, db);
  return results;
}
