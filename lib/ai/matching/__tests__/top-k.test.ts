import { describe, expect, it } from 'vitest';
import {
  buildMatchTopK,
  mergeTopKAcrossSources,
  rrfFuseCandidates,
} from '../candidate-ranking';
import type { FuzzyMatchRow } from '../match-constants';

function row(
  overrides: Partial<FuzzyMatchRow> & {
    id: string;
    similarity: number;
    state?: string;
  }
): FuzzyMatchRow {
  return {
    id: overrides.id,
    name_primary: overrides.name_primary ?? overrides.id,
    name_alt: overrides.name_alt ?? null,
    name_en: overrides.name_en ?? '',
    state: overrides.state ?? 'cooked',
    similarity: overrides.similarity,
  };
}

describe('buildMatchTopK', () => {
  it('returns up to K candidates sorted by similarity desc', () => {
    const out = buildMatchTopK(
      'đùi gà',
      [
        row({ id: 'a', similarity: 0.7 }),
        row({ id: 'b', similarity: 0.9 }),
        row({ id: 'c', similarity: 0.8 }),
      ],
      3,
      0.65
    );
    expect(out.map((c) => c.foodCompositionId)).toEqual(['b', 'c', 'a']);
  });

  it('caps at K even when more candidates pass the threshold', () => {
    const out = buildMatchTopK(
      'rice',
      [
        row({ id: 'a', similarity: 0.95 }),
        row({ id: 'b', similarity: 0.9 }),
        row({ id: 'c', similarity: 0.85 }),
        row({ id: 'd', similarity: 0.8 }),
      ],
      2,
      0.7
    );
    expect(out).toHaveLength(2);
    expect(out.map((c) => c.foodCompositionId)).toEqual(['a', 'b']);
  });

  it('returns empty when no candidate clears the (penalty-adjusted) threshold', () => {
    const out = buildMatchTopK(
      'thing',
      [row({ id: 'low', similarity: 0.5 })],
      3,
      0.7
    );
    expect(out).toEqual([]);
  });

  it('applies STATE_MISMATCH_PENALTY: cooked-state ingredient drops a marginal raw candidate', () => {
    // expectedState=cooked, raw candidate at 0.72 — needs to clear 0.7 + 0.05 = 0.75
    const out = buildMatchTopK(
      'bún tươi',
      [row({ id: 'raw-marginal', similarity: 0.72, state: 'raw' })],
      3,
      0.7,
      'fao',
      'vector',
      'cooked' // expected state
    );
    expect(out).toEqual([]);
  });

  it("keeps a state-matched candidate that wouldn't clear the cross-state threshold", () => {
    const out = buildMatchTopK(
      'bún tươi',
      [
        row({ id: 'raw-marginal', similarity: 0.72, state: 'raw' }),
        row({ id: 'cooked-fine', similarity: 0.71, state: 'cooked' }),
      ],
      3,
      0.7,
      'fao',
      'vector',
      'cooked'
    );
    expect(out).toHaveLength(1);
    expect(out[0].foodCompositionId).toBe('cooked-fine');
  });

  it('returns confidence tier classification', () => {
    const out = buildMatchTopK(
      'x',
      [
        row({ id: 'high', similarity: 0.92 }),
        row({ id: 'med', similarity: 0.78 }),
        row({ id: 'low', similarity: 0.71 }),
      ],
      3,
      0.7
    );
    expect(out[0].confidence).toBe('high');
    expect(out[1].confidence).toBe('medium');
    expect(out[2].confidence).toBe('medium');
  });

  it('returns empty for K=0', () => {
    expect(
      buildMatchTopK('x', [row({ id: 'a', similarity: 0.9 })], 0, 0.7)
    ).toEqual([]);
  });
});

describe('mergeTopKAcrossSources', () => {
  const A = (sim: number, id: string) => ({
    ingredientName: 'x',
    foodCompositionId: id,
    matchedName: id,
    similarity: sim,
    confidence: 'high' as const,
    state: 'cooked' as const,
  });

  it('merges and sorts by similarity desc, capped at K', () => {
    const fao = [A(0.92, 'fao-a'), A(0.85, 'fao-b')];
    const usda = [A(0.88, 'usda-a'), A(0.7, 'usda-b')];
    const out = mergeTopKAcrossSources([fao, usda], 3);
    expect(out.map((c) => c.foodCompositionId)).toEqual([
      'fao-a',
      'usda-a',
      'fao-b',
    ]);
  });

  it('returns empty for K=0', () => {
    expect(mergeTopKAcrossSources([[A(0.9, 'x')], [A(0.8, 'y')]], 0)).toEqual(
      []
    );
  });

  it('handles empty source lists', () => {
    expect(mergeTopKAcrossSources([[], []], 5)).toEqual([]);
  });
});

describe('rrfFuseCandidates', () => {
  const C = (id: string, sim: number, matchType?: 'vector' | 'fuzzy') => ({
    ingredientName: 'x',
    foodCompositionId: id,
    matchedName: id,
    similarity: sim,
    confidence: 'high' as const,
    state: 'cooked' as const,
    ...(matchType ? { matchType } : {}),
  });

  it('returns the other arm unchanged when one arm is empty', () => {
    const vector = [C('a', 0.9), C('b', 0.85)];
    expect(rrfFuseCandidates(vector, [], 3)).toEqual(vector);
    expect(rrfFuseCandidates([], vector, 3)).toEqual(vector);
  });

  it('ranks a candidate found by both arms above single-arm candidates', () => {
    // Vector arm: wrong-ish semantic neighbor first, real match second.
    const vector = [
      C('semantic-neighbor', 0.84, 'vector'),
      C('real', 0.82, 'vector'),
    ];
    // Fuzzy arm: exact lexical hit on the real match.
    const fuzzy = [C('real', 0.95, 'fuzzy')];

    const fused = rrfFuseCandidates(vector, fuzzy, 3);
    // 'real': 1/61 (vector rank 1) + 1/60 (fuzzy rank 0) beats
    // 'semantic-neighbor': 1/60 alone.
    expect(fused[0].foodCompositionId).toBe('real');
    expect(fused[1].foodCompositionId).toBe('semantic-neighbor');
  });

  it('keeps the variant from the arm where the id ranks better', () => {
    const vector = [C('a', 0.8, 'vector'), C('b', 0.78, 'vector')];
    const fuzzy = [C('b', 0.99, 'fuzzy')];

    const fused = rrfFuseCandidates(vector, fuzzy, 3);
    const b = fused.find((c) => c.foodCompositionId === 'b');
    // 'b' ranks 0 in fuzzy vs 1 in vector → fuzzy variant kept.
    expect(b?.matchType).toBe('fuzzy');
    expect(b?.similarity).toBe(0.99);
    // 'a' only appears in vector.
    const a = fused.find((c) => c.foodCompositionId === 'a');
    expect(a?.matchType).toBe('vector');
  });

  it('prefers the vector variant on a rank tie', () => {
    const vector = [C('same', 0.8, 'vector')];
    const fuzzy = [C('same', 0.9, 'fuzzy')];
    const fused = rrfFuseCandidates(vector, fuzzy, 3);
    expect(fused).toHaveLength(1);
    expect(fused[0].matchType).toBe('vector');
  });

  it('caps the fused pool at K', () => {
    const vector = [C('a', 0.9), C('b', 0.85), C('c', 0.8)];
    const fuzzy = [C('d', 0.95), C('e', 0.9)];
    expect(rrfFuseCandidates(vector, fuzzy, 2)).toHaveLength(2);
    expect(rrfFuseCandidates(vector, fuzzy, 0)).toEqual([]);
  });

  it('breaks equal RRF scores by similarity', () => {
    // a: vector rank 0 only (1/60). d: fuzzy rank 0 only (1/60). Same score.
    const vector = [C('a', 0.75)];
    const fuzzy = [C('d', 0.92)];
    const fused = rrfFuseCandidates(vector, fuzzy, 2);
    expect(fused[0].foodCompositionId).toBe('d');
  });
});
