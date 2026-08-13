import { describe, expect, it } from 'vitest';
import { collisionsFor, fold, foldedLookupFor } from './fold';

describe('folded lookup', () => {
  it('folds Vietnamese diacritics without changing whitespace by default', () => {
    expect(fold(' Bún  Bò ')).toBe('bun  bo');
    expect(fold(' Bún  Bò ', { collapseWhitespace: true })).toBe('bun bo');
  });

  it('keeps equivalent aliases and drops conflicting folded keys', () => {
    const entries = [
      ['bánh mì', 'bread'],
      ['banh mi', 'bread'],
      ['bún', 'vermicelli'],
      ['bun', 'bread-roll'],
    ] as const;

    expect(collisionsFor(entries, (value) => value)).toEqual(['bun']);
    expect(foldedLookupFor(entries, (value) => value)).toEqual(
      new Map([['banh mi', 'bread']])
    );
  });
});
