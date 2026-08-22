import { describe, expect, it } from 'vitest';
import type { IngredientSearchResult } from '@/lib/domain/logging/manual-logging';
import { rrfFuse } from '../rrf-fusion';

function result(
  id: string,
  namePrimary: string,
  overrides: Partial<IngredientSearchResult> = {}
): IngredientSearchResult {
  return {
    id,
    namePrimary,
    nameEn: null,
    nameAlt: null,
    state: 'cooked',
    similarity: 0.5,
    per100g: {
      caloriesKcal: 130,
      proteinG: 2.7,
      carbohydrateG: 28,
      fatG: null,
    },
    ...overrides,
  };
}

function semanticResult(id: string, namePrimary: string) {
  return result(id, namePrimary, { semantic: true });
}

describe('rrfFuse', () => {
  it('promotes a semantic hit above wrong-but-lexically-similar offal (ức gà)', () => {
    // "ức gà" (breast) shares only the dominant "gà" token with "Mề gà" /
    // "Tim gà" (offal), which therefore outrank it lexically. The embedding
    // arm puts the breast first, and rank fusion promotes it:
    // breast  = lexical rank 2 (1/62) + semantic rank 0 (2/60)
    // gizzard = lexical rank 0 (1/60) alone.
    const fused = rrfFuse(
      [
        result('fao-gizzard', 'Mề gà'),
        result('fao-heart', 'Tim gà'),
        result('usda-breast', 'Ức gà'),
      ],
      [semanticResult('usda-breast', 'Ức gà')],
      10
    );

    expect(fused.map((r) => r.id)).toEqual([
      'usda-breast',
      'fao-gizzard',
      'fao-heart',
    ]);
  });

  it('lets meaning win over a saturated lexical token collision (cơm)', () => {
    // word_similarity saturates: "Cá cơm" (anchovy) ties at ~1.0 with rice
    // because both contain the "cơm" token. Only the embedding knows "cơm"
    // means rice, and the weighted semantic vote carries it:
    // rice    = lexical rank 1 (1/61) + semantic rank 0 (2/60)
    // anchovy = lexical rank 0 (1/60) alone.
    const fused = rrfFuse(
      [
        result('anchovy', 'Cá cơm', { similarity: 1.001 }),
        result('rice', 'Cơm trắng', { similarity: 1.0004 }),
      ],
      [semanticResult('rice', 'Cơm trắng')],
      10
    );

    expect(fused.map((r) => r.id)).toEqual(['rice', 'anchovy']);
  });

  it('keeps the unflagged lexical variant for a row both arms returned', () => {
    const fused = rrfFuse(
      [result('rice', 'Cơm trắng')],
      [semanticResult('rice', 'Cơm trắng')],
      10
    );

    expect(fused).toHaveLength(1);
    // Found by both arms, so it is an exact hit — not an "≈ related" badge.
    expect(fused[0].semantic).toBeUndefined();
  });

  it('keeps the semantic flag on rows only the embedding arm found', () => {
    const fused = rrfFuse(
      [result('rice', 'Cơm trắng')],
      [semanticResult('breast', 'Ức gà')],
      10
    );

    expect(fused.map((r) => [r.id, r.semantic])).toEqual([
      // 2/60 beats 1/60, so the semantic-only row leads.
      ['breast', true],
      ['rice', undefined],
    ]);
  });

  it('truncates to the requested limit', () => {
    const fused = rrfFuse(
      [result('lex-0', 'a'), result('lex-1', 'b'), result('lex-2', 'c')],
      [semanticResult('sem-0', 'd')],
      2
    );

    expect(fused.map((r) => r.id)).toEqual(['sem-0', 'lex-0']);
  });

  it('preserves each arm’s order when the other arm is empty', () => {
    const lexical = [result('a', 'a'), result('b', 'b')];
    const semantic = [semanticResult('c', 'c'), semanticResult('d', 'd')];

    expect(rrfFuse(lexical, [], 10).map((r) => r.id)).toEqual(['a', 'b']);
    expect(rrfFuse([], semantic, 10).map((r) => r.id)).toEqual(['c', 'd']);
    expect(rrfFuse([], [], 10)).toEqual([]);
  });
});
