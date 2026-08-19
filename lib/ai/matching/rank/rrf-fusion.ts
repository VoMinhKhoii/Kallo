import type { MatchInfo } from '@/lib/ai/matching/match-constants';

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
