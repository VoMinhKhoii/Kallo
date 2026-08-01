import { describe, expect, it } from 'vitest';
import {
  escapeLikeToken,
  parseSlashToken,
  type RelogStagedEntry,
  stripSlashToken,
  sumStagedMacros,
  weakestConfidence,
} from '@/lib/logging/relog/relog';

// Convenience: parse with the caret at end-of-text, the common case.
const atEnd = (value: string) => parseSlashToken(value, value.length);

describe('parseSlashToken', () => {
  describe('opens', () => {
    it('on a bare slash at the start of the text', () => {
      expect(atEnd('/')).toEqual({ start: 0, end: 1, query: '' });
    });

    it('on a slash-prefixed token at the start', () => {
      expect(atEnd('/pho')).toEqual({ start: 0, end: 4, query: 'pho' });
    });

    it('on a slash after whitespace', () => {
      expect(atEnd('xem /pho')).toEqual({ start: 4, end: 8, query: 'pho' });
    });

    it('keeps diacritics in the query verbatim', () => {
      // Diacritics are load-bearing (bò=beef, bơ=butter) — never folded here.
      expect(atEnd('/phở bò')?.query).toBe('phở bò');
    });

    it('allows spaces, since Vietnamese dish names contain them', () => {
      expect(atEnd('/cà phê sữa đá')?.query).toBe('cà phê sữa đá');
    });

    it('uses the caret, not the end of the text', () => {
      // Caret sits after "pho" in "/phobo".
      expect(parseSlashToken('/phobo', 4)).toEqual({
        start: 0,
        end: 4,
        query: 'pho',
      });
    });

    it('tracks the most recent slash when several are present', () => {
      expect(atEnd('/pho /ca')).toEqual({ start: 5, end: 8, query: 'ca' });
    });

    it('ignores an earlier non-triggering slash', () => {
      expect(atEnd('a/b /c')).toEqual({ start: 4, end: 6, query: 'c' });
    });
  });

  describe('stays closed', () => {
    it('when there is no slash', () => {
      expect(atEnd('phở bò')).toBeNull();
    });

    it('on a fraction — the mid-word case that matters most', () => {
      expect(atEnd('1/2 quả táo')).toBeNull();
      expect(atEnd('1/2')).toBeNull();
    });

    it('on a URL', () => {
      expect(atEnd('xem http://abc')).toBeNull();
    });

    it('on an and/or style slash', () => {
      expect(atEnd('bún/phở')).toBeNull();
    });

    it('when the slash is followed by whitespace', () => {
      expect(atEnd('ăn sáng / trưa')).toBeNull();
      expect(atEnd('/ ')).toBeNull();
    });

    it('when the caret sits left of the slash', () => {
      expect(parseSlashToken('/pho', 0)).toBeNull();
    });

    it('past the word bound', () => {
      expect(atEnd('/mot hai ba bon')?.query).toBe('mot hai ba bon');
      expect(atEnd('/mot hai ba bon nam')).toBeNull();
    });

    it('past the length bound', () => {
      expect(atEnd(`/${'a'.repeat(40)}`)?.query).toBe('a'.repeat(40));
      expect(atEnd(`/${'a'.repeat(41)}`)).toBeNull();
    });

    it('once the token spans a newline', () => {
      expect(atEnd('/pho\nbo')).toBeNull();
    });
  });

  it('clamps an out-of-range caret instead of throwing', () => {
    expect(parseSlashToken('/pho', 999)).toEqual({
      start: 0,
      end: 4,
      query: 'pho',
    });
    expect(parseSlashToken('/pho', -5)).toBeNull();
  });
});

describe('stripSlashToken', () => {
  it('removes the token and reports the caret position', () => {
    const value = 'xem /pho';
    const token = parseSlashToken(value, value.length);
    expect(token).not.toBeNull();
    expect(stripSlashToken(value, token as never)).toEqual({
      value: 'xem ',
      caret: 4,
    });
  });

  it('preserves text to the right of the caret', () => {
    const value = '/pho bo';
    const token = parseSlashToken(value, 4);
    expect(stripSlashToken(value, token as never)).toEqual({
      value: ' bo',
      caret: 0,
    });
  });
});

describe('escapeLikeToken', () => {
  it('escapes the LIKE wildcards so a lone % cannot match everything', () => {
    expect(escapeLikeToken('%')).toBe('\\%');
    expect(escapeLikeToken('_')).toBe('\\_');
    expect(escapeLikeToken('100%_gà')).toBe('100\\%\\_gà');
  });

  it('escapes the escape character itself, before the wildcards', () => {
    expect(escapeLikeToken('a\\b')).toBe('a\\\\b');
    expect(escapeLikeToken('\\%')).toBe('\\\\\\%');
  });

  it('leaves ordinary text untouched', () => {
    expect(escapeLikeToken('phở bò')).toBe('phở bò');
  });
});

describe('weakestConfidence', () => {
  it('returns the weakest of the supplied values', () => {
    expect(weakestConfidence(['high', 'low'])).toBe('low');
    expect(weakestConfidence(['high', 'medium'])).toBe('medium');
    expect(weakestConfidence(['medium', 'low', 'high'])).toBe('low');
  });

  it('returns the single value when only one contributes', () => {
    expect(weakestConfidence(['high'])).toBe('high');
  });

  it('ignores nulls rather than treating them as weakest', () => {
    expect(weakestConfidence([null, 'high'])).toBe('high');
  });

  it('stays null when nothing is known', () => {
    expect(weakestConfidence([])).toBeNull();
    expect(weakestConfidence([null, null])).toBeNull();
  });

  it('ignores unrecognized values', () => {
    expect(weakestConfidence(['bogus', 'medium'])).toBe('medium');
    expect(weakestConfidence(['bogus'])).toBeNull();
  });
});

describe('sumStagedMacros', () => {
  const entry = (
    caloriesKcal: number | null,
    proteinG: number | null
  ): RelogStagedEntry => ({
    stageId: crypto.randomUUID(),
    ref: { kind: 'meal', sourceMealId: crypto.randomUUID() },
    label: 'x',
    partCount: 1,
    summary: {
      totalGrams: null,
      caloriesKcal,
      proteinG,
      carbohydrateG: null,
      fatG: null,
    },
  });

  it('sums the non-null values', () => {
    const totals = sumStagedMacros([entry(100, 5), entry(250, 12)]);
    expect(totals.caloriesKcal).toBe(350);
    expect(totals.proteinG).toBe(17);
  });

  it('keeps a nutrient null when no entry carries it — unknown is not zero', () => {
    const totals = sumStagedMacros([entry(100, null), entry(250, null)]);
    expect(totals.caloriesKcal).toBe(350);
    expect(totals.proteinG).toBeNull();
    expect(totals.fatG).toBeNull();
  });

  it('sums the entries that do carry a nutrient, ignoring those that do not', () => {
    expect(sumStagedMacros([entry(100, null), entry(250, 12)]).proteinG).toBe(
      12
    );
  });

  it('returns all-null for an empty list', () => {
    expect(sumStagedMacros([])).toEqual({
      caloriesKcal: null,
      proteinG: null,
      carbohydrateG: null,
      fatG: null,
    });
  });
});
