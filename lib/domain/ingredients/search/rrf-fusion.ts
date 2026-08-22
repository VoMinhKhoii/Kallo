import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';

// Reciprocal Rank Fusion dampening constant (Cormack et al.).
const RRF_K = 60;
// The semantic arm is weighted heavier than the lexical arm in the fusion.
// Trigram word_similarity SATURATES — many rows tie at ~1.0 because they share
// a token with the query — and it has no way to tell a polysemous token apart:
// "cơm" alone is rice, but "cá cơm" is anchovy and "rau giền cơm" is amaranth;
// "ức gà" is chicken breast, "ức gà tây" is turkey. Embeddings disambiguate
// these by meaning, so they get the louder vote; cross-arm agreement does the
// rest (a row both arms return outranks a lexical-only token collision).
const SEMANTIC_RRF_WEIGHT = 2;

type FusedEntry = {
  score: number;
  inLexical: boolean;
  inSemantic: boolean;
  result: IngredientSearchResult;
};

// Tie-break: cross-arm agreement first, then semantic presence (the more
// trustworthy signal here) — never the raw, cross-metric `similarity`.
function agreement(e: Pick<FusedEntry, 'inLexical' | 'inSemantic'>): number {
  if (e.inLexical && e.inSemantic) return 2;
  return e.inSemantic ? 1 : 0;
}

/**
 * Fuse the lexical and semantic arms by weighted Reciprocal Rank Fusion: a
 * result is scored by Σ weight/(RRF_K + rank) across the arms it appears in.
 * Cosine and trigram scores are not on comparable scales, so we fuse by RANK,
 * not raw score — and the semantic arm carries SEMANTIC_RRF_WEIGHT because
 * trigram ranking saturates and can't disambiguate polysemous tokens. A row
 * both arms return wins on agreement; a row only the embedding arm found keeps
 * its `semantic: true` flag (the "≈ related" badge); a row only the lexical arm
 * found keeps its exact variant.
 */
export function rrfFuse(
  lexical: IngredientSearchResult[],
  semantic: IngredientSearchResult[],
  limit: number
): IngredientSearchResult[] {
  const fused = new Map<string, FusedEntry>();
  lexical.forEach((result, rank) => {
    fused.set(result.id, {
      score: 1 / (RRF_K + rank),
      inLexical: true,
      inSemantic: false,
      result,
    });
  });
  semantic.forEach((result, rank) => {
    const contribution = SEMANTIC_RRF_WEIGHT / (RRF_K + rank);
    const existing = fused.get(result.id);
    if (existing) {
      existing.score += contribution;
      existing.inSemantic = true; // keep the lexical (exact, unflagged) variant
    } else {
      fused.set(result.id, {
        score: contribution,
        inLexical: false,
        inSemantic: true,
        result,
      });
    }
  });
  return Array.from(fused.values())
    .sort((a, b) => b.score - a.score || agreement(b) - agreement(a))
    .slice(0, limit)
    .map((entry) => entry.result);
}
