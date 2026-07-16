import type { MatchSource, MatchType } from '../types';
import {
  classifyConfidence,
  type DbIngredientState,
  type FuzzyMatchRow,
  type MatchInfo,
  normalizeState,
  STATE_MISMATCH_PENALTY,
} from './match-constants';

export function rerankCandidates(candidates: FuzzyMatchRow[]): FuzzyMatchRow[] {
  if (candidates.length <= 1) return candidates;
  return [...candidates].sort((a, b) => b.similarity - a.similarity);
}

/**
 * Build a lightweight MatchInfo from candidate rows.
 * Pure function — no DB calls. Nutrition is fetched separately in batch.
 *
 * When `expectedState` is supplied, each candidate's effective threshold is
 * `minSimilarity + STATE_MISMATCH_PENALTY` if its state differs from
 * `expectedState` (both known, i.e. not 'unknown'). We scan the reranked list
 * and accept the first candidate clearing its own threshold — so a marginal
 * cross-state top candidate doesn't shadow a same-state runner-up that would
 * otherwise be a valid match.
 */
export function buildMatchResult(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  minSimilarity: number,
  source?: MatchSource,
  matchType?: MatchType,
  expectedState?: DbIngredientState
): MatchInfo | null {
  if (rows.length === 0) return null;

  const reranked = rerankCandidates(rows);
  const accepted = reranked.find((candidate) => {
    const candidateState = normalizeState(candidate.state);
    const stateMismatch =
      expectedState !== undefined &&
      expectedState !== 'unknown' &&
      candidateState !== 'unknown' &&
      candidateState !== expectedState;
    const effectiveMin =
      minSimilarity + (stateMismatch ? STATE_MISMATCH_PENALTY : 0);
    return candidate.similarity >= effectiveMin;
  });
  if (!accepted) return null;
  const acceptedState = normalizeState(accepted.state);

  return {
    ingredientName,
    foodCompositionId: accepted.id,
    matchedName: accepted.name_primary,
    similarity: accepted.similarity,
    confidence: classifyConfidence(accepted.similarity),
    state: acceptedState,
    ...(source !== undefined ? { source } : {}),
    ...(matchType !== undefined ? { matchType } : {}),
  };
}

/**
 * Build up to `k` top MatchInfo candidates from a single source's raw rows.
 * Applies the same state-mismatch threshold logic as `buildMatchResult` but
 * returns ALL passing candidates (sorted by similarity desc), not just the
 * first one.
 *
 * V2 pipeline use: feed both FAO and USDA top-K candidates to Call 2 so the
 * LLM can pick the right one via CRAG-style judgment instead of relying on
 * the server's similarity tie-break.
 */
export function buildMatchTopK(
  ingredientName: string,
  rows: FuzzyMatchRow[],
  k: number,
  minSimilarity: number,
  source?: MatchSource,
  matchType?: MatchType,
  expectedState?: DbIngredientState
): MatchInfo[] {
  if (rows.length === 0 || k <= 0) return [];

  const reranked = rerankCandidates(rows);
  const accepted: MatchInfo[] = [];
  for (const candidate of reranked) {
    if (accepted.length >= k) break;
    const candidateState = normalizeState(candidate.state);
    const stateMismatch =
      expectedState !== undefined &&
      expectedState !== 'unknown' &&
      candidateState !== 'unknown' &&
      candidateState !== expectedState;
    const effectiveMin =
      minSimilarity + (stateMismatch ? STATE_MISMATCH_PENALTY : 0);
    if (candidate.similarity < effectiveMin) continue;
    accepted.push({
      ingredientName,
      foodCompositionId: candidate.id,
      matchedName: candidate.name_primary,
      similarity: candidate.similarity,
      confidence: classifyConfidence(candidate.similarity),
      state: candidateState,
      ...(source !== undefined ? { source } : {}),
      ...(matchType !== undefined ? { matchType } : {}),
    });
  }
  return accepted;
}

/**
 * Merge top-K results from multiple sources into one similarity-desc list,
 * capped at `k`. Stable order on ties (FAO before USDA when similarity
 * matches, mirroring the v1 tie-break preference for curated VN data).
 */
export function mergeTopKAcrossSources(
  perSource: Array<MatchInfo[]>,
  k: number
): MatchInfo[] {
  if (k <= 0) return [];
  const merged: MatchInfo[] = [];
  for (const list of perSource) {
    for (const m of list) merged.push(m);
  }
  merged.sort((a, b) => b.similarity - a.similarity);
  return merged.slice(0, k);
}

/** Standard RRF dampening constant (Cormack et al.) — rank 0 contributes
 *  1/61, rank 1 contributes 1/62, ... */
export const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of the vector and fuzzy candidate lists.
 *
 * Cosine similarity and trigram word-similarity live on incomparable scales,
 * so candidates are fused by RANK within each (already threshold-gated) arm:
 * score(id) = Σ 1/(RRF_K + rank). A candidate both arms agree on outranks a
 * candidate only one arm found — which is exactly the signal that separates
 * "semantically adjacent but wrong" vector hits from real matches. When an id
 * appears in both arms, the variant from the arm where it ranks better is
 * kept (tie → vector, whose similarity feeds confidence classification).
 *
 * Each arm's per-source acceptance thresholds (and the state-mismatch
 * penalty) have already been applied by buildMatchTopK, so fusion can only
 * reorder/extend the candidate pool with rows that individually cleared
 * their own quality bar.
 */
export function rrfFuseCandidates(
  vectorList: MatchInfo[],
  fuzzyList: MatchInfo[],
  k: number
): MatchInfo[] {
  if (k <= 0) return [];
  if (vectorList.length === 0) return fuzzyList.slice(0, k);
  if (fuzzyList.length === 0) return vectorList.slice(0, k);

  const fused = new Map<
    string,
    { score: number; bestRank: number; candidate: MatchInfo }
  >();
  const addArm = (list: MatchInfo[]) => {
    list.forEach((candidate, rank) => {
      const id = candidate.foodCompositionId;
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = fused.get(id);
      if (!existing) {
        fused.set(id, { score: contribution, bestRank: rank, candidate });
        return;
      }
      existing.score += contribution;
      // Keep the variant from the arm where this id ranks strictly better.
      // The vector arm is added first, so it wins rank ties.
      if (rank < existing.bestRank) {
        existing.bestRank = rank;
        existing.candidate = candidate;
      }
    });
  };
  addArm(vectorList);
  addArm(fuzzyList);

  return Array.from(fused.values())
    .sort(
      (a, b) =>
        b.score - a.score || b.candidate.similarity - a.candidate.similarity
    )
    .slice(0, k)
    .map((entry) => entry.candidate);
}

/**
 * Pick the best match between FAO and USDA candidates.
 *
 * Tie-break order: expected state match first, then similarity. Source
 * preference is intentionally not a tie-breaker.
 */
