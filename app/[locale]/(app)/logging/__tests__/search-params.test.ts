import { describe, expect, it } from 'vitest';
import { parseLoggingSearchParams } from '../search-params';

describe('parseLoggingSearchParams', () => {
  it('accepts valid meal and date params', () => {
    expect(
      parseLoggingSearchParams({ meal: 'phở bò', date: '2026-05-03' })
    ).toEqual({ meal: 'phở bò', date: '2026-05-03' });
  });

  it('drops invalid date params while preserving valid meal params', () => {
    expect(
      parseLoggingSearchParams({ meal: 'bún', date: '03-05-2026' })
    ).toEqual({
      meal: 'bún',
      date: undefined,
    });
  });

  it('drops impossible calendar dates', () => {
    expect(
      parseLoggingSearchParams({ meal: 'bún', date: '2026-02-30' })
    ).toEqual({
      meal: 'bún',
      date: undefined,
    });
  });

  it('drops empty meal params', () => {
    expect(parseLoggingSearchParams({ meal: '', date: '2026-05-03' })).toEqual({
      meal: undefined,
      date: '2026-05-03',
    });
  });

  it('drops overlong meal params', () => {
    expect(
      parseLoggingSearchParams({
        meal: 'x'.repeat(301),
        date: '2026-05-03',
      })
    ).toEqual({
      meal: undefined,
      date: '2026-05-03',
    });
  });
});
