import { describe, expect, it } from 'vitest';
import {
  buildMatchTopK,
  type FuzzyMatchRow,
  mergeTopKAcrossSources,
} from '../source-matching';

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
