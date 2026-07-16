import { describe, expect, it } from 'vitest';
import type { MatchInfo } from '../match-constants';
import { pickBestSource } from '../source-matching';

const candidate = (
  matchedName: string,
  similarity: number,
  state: MatchInfo['state']
): MatchInfo => ({
  ingredientName: 'ingredient',
  foodCompositionId: matchedName,
  matchedName,
  similarity,
  confidence: similarity >= 0.85 ? 'high' : 'medium',
  state,
});

describe('pickBestSource state tie-breaker', () => {
  it('prefers state match over higher similarity', () => {
    const fao = candidate('fao', 0.92, 'raw');
    const usda = candidate('usda', 0.78, 'cooked');

    expect(
      pickBestSource(fao, usda, { expectedState: 'cooked' })?.matchedName
    ).toBe('usda');
  });

  it('falls back to similarity when both candidates have the same state', () => {
    const fao = candidate('fao', 0.92, 'cooked');
    const usda = candidate('usda', 0.78, 'cooked');

    expect(
      pickBestSource(fao, usda, { expectedState: 'cooked' })?.matchedName
    ).toBe('fao');
  });

  it('falls back to similarity when expectedState is unknown', () => {
    const fao = candidate('fao', 0.92, 'raw');
    const usda = candidate('usda', 0.78, 'cooked');

    expect(
      pickBestSource(fao, usda, { expectedState: 'unknown' })?.matchedName
    ).toBe('fao');
  });

  it('does not prefer FAO over USDA as a source-preference tie-breaker', () => {
    const fao = candidate('fao', 0.7, 'cooked');
    const usda = candidate('usda', 0.85, 'cooked');

    expect(
      pickBestSource(fao, usda, { expectedState: 'cooked' })?.matchedName
    ).toBe('usda');
  });

  it('preserves null candidate behavior', () => {
    const usda = candidate('usda', 0.8, 'cooked');
    const fao = candidate('fao', 0.8, 'cooked');

    expect(
      pickBestSource(null, usda, { expectedState: 'cooked' })?.matchedName
    ).toBe('usda');
    expect(
      pickBestSource(fao, null, { expectedState: 'cooked' })?.matchedName
    ).toBe('fao');
    expect(pickBestSource(null, null, { expectedState: 'cooked' })).toBeNull();
  });
});
