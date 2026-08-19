import { describe, expect, it } from 'vitest';
import type { FuzzyMatchRow } from '@/lib/ai/matching/match-constants';
import { buildMatchResult } from '../candidate-ranking';

describe('MatchInfo carries DB state', () => {
  it('preserves the state field from the matched row', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-1',
        name_primary: 'Cá quả',
        name_alt: null,
        name_en: 'Snakehead fish',
        state: 'raw',
        similarity: 0.9,
      },
    ];
    const info = buildMatchResult('cá lóc', rows, 0.7);
    expect(info).not.toBeNull();
    expect(info?.state).toBe('raw');
  });

  it('handles cooked rows', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-2',
        name_primary: 'Cá kho',
        name_alt: null,
        name_en: 'Braised fish',
        state: 'cooked',
        similarity: 0.92,
      },
    ];
    expect(buildMatchResult('cá kho', rows, 0.7)?.state).toBe('cooked');
  });

  it("falls back to 'unknown' when row state is empty/unexpected", () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-3',
        name_primary: 'Legacy row',
        name_alt: null,
        name_en: 'legacy',
        state: '',
        similarity: 0.85,
      },
    ];
    expect(buildMatchResult('legacy', rows, 0.7)?.state).toBe('unknown');
  });
});

describe('buildMatchResult — state-mismatch penalty', () => {
  it('rejects a barely-above-threshold cross-state match (Bún tươi cooked vs Noodles dry)', () => {
    // The 2026-05-12 regression: USDA "Noodles, japanese, somen, dry" at 0.709
    // similarity for cooked "Bún tươi". Cross-state mismatch + barely above the
    // 0.7 USDA threshold → must be rejected once expectedState is supplied.
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-somen',
        name_primary: 'Noodles, japanese, somen, dry',
        name_alt: null,
        name_en: 'somen, dry',
        state: 'raw',
        similarity: 0.709,
      },
    ];
    const without = buildMatchResult('Bún tươi', rows, 0.7);
    const withState = buildMatchResult(
      'Bún tươi',
      rows,
      0.7,
      undefined,
      undefined,
      'cooked'
    );
    expect(without).not.toBeNull(); // old behaviour: accepts at 0.709
    expect(withState).toBeNull(); // new behaviour: 0.709 < 0.7 + 0.05 penalty
  });

  it('keeps the match when state is aligned, even at threshold', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-cress',
        name_primary: 'Cress, garden, raw',
        name_alt: null,
        name_en: 'cress',
        state: 'raw',
        similarity: 0.71,
      },
    ];
    const withState = buildMatchResult(
      'rau sống',
      rows,
      0.7,
      undefined,
      undefined,
      'raw'
    );
    expect(withState).not.toBeNull();
    expect(withState?.similarity).toBe(0.71);
  });

  it('does not penalize when expectedState is unknown', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-x',
        name_primary: 'Mystery',
        name_alt: null,
        name_en: 'mystery',
        state: 'raw',
        similarity: 0.71,
      },
    ];
    const withState = buildMatchResult(
      'mystery ingredient',
      rows,
      0.7,
      undefined,
      undefined,
      'unknown'
    );
    expect(withState).not.toBeNull();
  });

  it('does not penalize when the row state is unknown (legacy data)', () => {
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-legacy',
        name_primary: 'Legacy with no state',
        name_alt: null,
        name_en: 'legacy',
        state: '',
        similarity: 0.71,
      },
    ];
    const withState = buildMatchResult(
      'legacy item',
      rows,
      0.7,
      undefined,
      undefined,
      'cooked'
    );
    expect(withState).not.toBeNull();
  });

  it('still accepts a strong cross-state match well above threshold', () => {
    // e.g., a high-similarity USDA "raw" match for a cooked Vietnamese ingredient
    // should still pass — penalty is only 0.05, threshold is 0.7, so 0.85 + clears.
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-strong',
        name_primary: 'Strong match',
        name_alt: null,
        name_en: 'strong',
        state: 'raw',
        similarity: 0.85,
      },
    ];
    const withState = buildMatchResult(
      'cooked item',
      rows,
      0.7,
      undefined,
      undefined,
      'cooked'
    );
    expect(withState).not.toBeNull();
    expect(withState?.similarity).toBe(0.85);
  });

  it('falls back to a same-state runner-up when the top candidate fails the penalty', () => {
    // Top candidate is cross-state and barely above the bare threshold (so it
    // fails 0.7 + 0.05). A lower-ranked same-state candidate passes the bare
    // threshold and should win — the previous top-only check would have
    // returned null here.
    const rows: FuzzyMatchRow[] = [
      {
        id: 'fc-top-cross',
        name_primary: 'Cross-state top',
        name_alt: null,
        name_en: 'cross-state',
        state: 'raw',
        similarity: 0.71,
      },
      {
        id: 'fc-runner-up-same',
        name_primary: 'Same-state runner-up',
        name_alt: null,
        name_en: 'same-state',
        state: 'cooked',
        similarity: 0.7,
      },
    ];
    const result = buildMatchResult(
      'cooked ingredient',
      rows,
      0.7,
      undefined,
      undefined,
      'cooked'
    );
    expect(result).not.toBeNull();
    expect(result?.foodCompositionId).toBe('fc-runner-up-same');
    expect(result?.state).toBe('cooked');
  });
});
