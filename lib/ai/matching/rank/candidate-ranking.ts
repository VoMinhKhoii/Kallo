import {
  classifyConfidence,
  type DbIngredientState,
  type FuzzyMatchRow,
  type MatchInfo,
  normalizeState,
  STATE_MISMATCH_PENALTY,
} from '@/lib/ai/matching/match-constants';
import { isCandidateEligibleForIngredient } from '@/lib/ai/matching/rank/candidate-eligibility';
import type { MatchSource, MatchType } from '@/lib/ai/types/matching';

/**
 * Sort DB candidates by similarity descending.
 * The DB already returns results in order, but this ensures consistent
 * ordering when combining candidates from multiple sources.
 */
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

  const reranked = rerankCandidates(rows).filter((candidate) =>
    isCandidateEligibleForIngredient(ingredientName, candidate)
  );
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
    ...(accepted.name_en ? { matchedNameEn: accepted.name_en } : {}),
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
    if (!isCandidateEligibleForIngredient(ingredientName, candidate)) continue;
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
      ...(candidate.name_en ? { matchedNameEn: candidate.name_en } : {}),
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

/**
 * Hard state filter for an EXPLICIT user-stated weighing basis ("cân sống" /
 * "raw weight" → 'raw'; "đã nấu xong cân" → 'cooked').
 *
 * When the user SAID which state they weighed in, a candidate in the opposite
 * state forces a lossy conversion Call 2 might fumble — so drop it, but only
 * when a usable candidate survives:
 *   - 'unknown'-state candidates are kept (an unlabeled row is not evidence
 *     of a mismatch);
 *   - if filtering would empty the pool, keep the original pool — a
 *     convertible wrong-state candidate still beats zero candidates.
 *
 * Deliberately NOT applied to states merely DERIVED from the cooking method —
 * that inference is heuristic, and the soft STATE_MISMATCH_PENALTY already
 * handles it. This filter fires only on the user's own words.
 */
export function filterByExplicitState(
  candidates: MatchInfo[],
  explicitState: 'raw' | 'cooked' | null
): MatchInfo[] {
  if (!explicitState || candidates.length === 0) return candidates;
  const opposite = explicitState === 'raw' ? 'cooked' : 'raw';
  const kept = candidates.filter((c) => c.state !== opposite);
  return kept.length > 0 ? kept : candidates;
}
