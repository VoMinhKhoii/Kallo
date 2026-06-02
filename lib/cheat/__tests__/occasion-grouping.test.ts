import { describe, expect, it } from 'vitest';
import {
  areSameOccasion,
  groupOccasions,
  tokenizeOccasion,
} from '../occasion-grouping';

describe('tokenizeOccasion', () => {
  it('lowercases, splits on punctuation, and keeps Vietnamese diacritics', () => {
    expect(tokenizeOccasion('Korean BBQ buffet')).toEqual([
      'korean',
      'bbq',
      'buffet',
    ]);
    expect(tokenizeOccasion('Lẩu Thái, hết mình!')).toEqual([
      'lẩu',
      'thái',
      'hết',
      'mình',
    ]);
  });
});

describe('areSameOccasion', () => {
  it('groups a subset of words (the prefix/superset case)', () => {
    expect(areSameOccasion('korean bbq', 'Korean BBQ buffet')).toBe(true);
    expect(areSameOccasion('donuts', 'box of donuts')).toBe(true);
  });

  it('groups reordered wording', () => {
    expect(areSameOccasion('korean bbq', 'bbq korean')).toBe(true);
  });

  it('keeps genuinely different occasions apart', () => {
    expect(areSameOccasion('korean bbq', 'japanese bbq')).toBe(false);
    expect(areSameOccasion('pizza party', 'korean bbq')).toBe(false);
  });

  it('falls back to exact match when there are no word tokens', () => {
    expect(areSameOccasion('!!!', '!!!')).toBe(true);
    expect(areSameOccasion('!!!', '???')).toBe(false);
  });
});

describe('groupOccasions', () => {
  it('keeps the newest wording per group and caps at the limit', () => {
    // Newest-first input.
    const rows = [
      { rawInput: 'Korean BBQ buffet', id: 'a' },
      { rawInput: 'korean bbq', id: 'b' },
      { rawInput: 'Japanese buffet', id: 'c' },
      { rawInput: 'box of donuts', id: 'd' },
      { rawInput: 'donuts', id: 'e' },
    ];
    const grouped = groupOccasions(rows, 5);
    // a+b collapse (newest 'a' kept), d+e collapse (newest 'd' kept).
    expect(grouped.map((r) => r.id)).toEqual(['a', 'c', 'd']);
  });

  it('respects the limit', () => {
    const rows = [
      { rawInput: 'pho', id: '1' },
      { rawInput: 'bun bo', id: '2' },
      { rawInput: 'com tam', id: '3' },
    ];
    expect(groupOccasions(rows, 2).map((r) => r.id)).toEqual(['1', '2']);
  });
});
