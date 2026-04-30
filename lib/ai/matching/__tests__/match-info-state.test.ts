import { describe, expect, it } from 'vitest';
import { buildMatchResult, type FuzzyMatchRow } from '../source-matching';

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
