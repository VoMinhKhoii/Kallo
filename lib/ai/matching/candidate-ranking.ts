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

const VI_WORD_EDGE = '[\\p{L}\\p{M}\\p{N}]';
const BARE_CHICKEN = new RegExp(
  `(?<!${VI_WORD_EDGE})gà(?!${VI_WORD_EDGE})`,
  'iu'
);
const QUALIFIED_NON_CHICKEN_SPECIES = [
  new RegExp(
    `(?<!${VI_WORD_EDGE})gà\\s+(?:tây|lôi|rừng)(?!${VI_WORD_EDGE})`,
    'iu'
  ),
  /\b(?:turkey|pheasant|grouse|jungle\s+fowl)\b/iu,
];
const SKIN_INTENT = [
  new RegExp(`(?<!${VI_WORD_EDGE})da(?!${VI_WORD_EDGE})`, 'iu'),
  /\bskin\b/iu,
];
const FAT_INTENT = [
  new RegExp(`(?<!${VI_WORD_EDGE})mỡ(?!${VI_WORD_EDGE})`, 'iu'),
  /\b(?:fat|lard|tallow)\b/iu,
];
const SKIN_ONLY_ROW = [
  /(?:^|[,;(]\s*)skin(?:\s*(?:\(|,|;|$))/iu,
  /\bskin\s+only\b/iu,
  /(?:^|[,;(]\s*)da(?:\s+(?:gà|vịt))?(?:\s*(?:\(|,|;|$))/iu,
  /(?:chỉ|chỉ\s+lấy)\s+(?:phần\s+)?da/iu,
];
const FAT_ONLY_ROW = [
  /\b(?:separable\s+fat|fat\s+only)\b/iu,
  /(?:^|[,;(]\s*)mỡ(?:\s+(?:lợn|bò|gà|vịt))?(?:\s*(?:\(|,|;|$))/iu,
  /(?:chỉ|chỉ\s+lấy)\s+(?:phần\s+)?mỡ/iu,
  /\b(?:lard|tallow)\b/iu,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function candidateIdentityText(candidate: FuzzyMatchRow): string {
  return [
    candidate.name_primary,
    candidate.name_en,
    ...(candidate.name_alt ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Hard identity eligibility rules for candidate classes that cannot represent
 * the queried food. These are deliberately narrow categorical exclusions, not
 * score adjustments: an unmatched ingredient is safer than anchoring a whole
 * cut to a different species or to isolated skin/fat.
 */
export function isCandidateEligibleForIngredient(
  ingredientName: string,
  candidate: FuzzyMatchRow
): boolean {
  const candidateText = candidateIdentityText(candidate);
  const isBareChickenQuery =
    BARE_CHICKEN.test(ingredientName) &&
    !matchesAny(ingredientName, QUALIFIED_NON_CHICKEN_SPECIES);
  if (
    isBareChickenQuery &&
    matchesAny(candidateText, QUALIFIED_NON_CHICKEN_SPECIES)
  ) {
    return false;
  }

  if (
    !matchesAny(ingredientName, SKIN_INTENT) &&
    matchesAny(candidateText, SKIN_ONLY_ROW)
  ) {
    return false;
  }
  if (
    !matchesAny(ingredientName, FAT_INTENT) &&
    matchesAny(candidateText, FAT_ONLY_ROW)
  ) {
    return false;
  }
  return true;
}

/**
 * The live `đùi gà` pool contains eight saturated lexical ties. Fetch enough
 * rows for the categorical species filter above to see past those ties; the
 * public top-K remains unchanged. Explicit species queries keep the normal
 * limit because no negative species filter applies to them.
 */
export function sourceLimitForIngredient(
  ingredientName: string,
  configuredLimit: number
): number {
  const needsSpeciesGuard =
    BARE_CHICKEN.test(ingredientName) &&
    !matchesAny(ingredientName, QUALIFIED_NON_CHICKEN_SPECIES);
  return needsSpeciesGuard ? Math.max(configuredLimit, 8) : configuredLimit;
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

/** Standard RRF dampening constant (Cormack et al.) — rank 0 contributes
 *  1/61, rank 1 contributes 1/62, ... */
export const RRF_K = 60;

/**
 * Reciprocal Rank Fusion of the vector and fuzzy candidate lists.
 *
 * Cosine similarity and trigram word-similarity live on incomparable scales,
 * so candidates are fused by RANK within each (already threshold-gated) arm:
 * score(id) = Σ 1/(RRF_K + rank + 1). Agreement contributes through both
 * arms and breaks equal-score ties, helping separate "semantically adjacent
 * but wrong" vector hits from real matches. When an id appears in both arms,
 * the variant from the arm where it ranks better is kept (tie → vector, whose
 * similarity feeds confidence classification).
 * Final ordering never compares those similarities: the previous similarity
 * tie-break violated the scale separation above. Equal RRF scores now prefer
 * arm agreement, then vector rank. The bake-off accepts a known `rau`
 * regression (`Poi` over `Rau bí`) because aggregate disaster rate improves;
 * do not special-case it here.
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
    {
      score: number;
      arms: number;
      vectorRank: number;
      bestRank: number;
      candidate: MatchInfo;
    }
  >();
  const addArm = (list: MatchInfo[], isVector: boolean) => {
    list.forEach((candidate, rank) => {
      const id = candidate.foodCompositionId;
      const contribution = 1 / (RRF_K + rank + 1);
      const existing = fused.get(id);
      if (!existing) {
        fused.set(id, {
          score: contribution,
          arms: 1,
          vectorRank: isVector ? rank : Number.POSITIVE_INFINITY,
          bestRank: rank,
          candidate,
        });
        return;
      }
      existing.score += contribution;
      existing.arms++;
      if (isVector) existing.vectorRank = rank;
      // Keep the variant from the arm where this id ranks strictly better.
      // The vector arm is added first, so it wins rank ties.
      if (rank < existing.bestRank) {
        existing.bestRank = rank;
        existing.candidate = candidate;
      }
    });
  };
  addArm(vectorList, true);
  addArm(fuzzyList, false);

  return Array.from(fused.values())
    .sort(
      (a, b) =>
        b.score - a.score ||
        b.arms - a.arms ||
        a.vectorRank - b.vectorRank ||
        a.candidate.foodCompositionId.localeCompare(
          b.candidate.foodCompositionId
        )
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
