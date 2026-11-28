import { describe, expect, it } from 'vitest';
import { cell, link, table } from '@/lib/seo/markdown/blocks';

describe('link', () => {
  it('leaves plain text alone and escapes what could close the link', () => {
    expect(link('Phở bò', 'https://kallo.fit/vi')).toBe(
      '[Phở bò](https://kallo.fit/vi)'
    );
    expect(link('a [b] \\c', 'https://x')).toBe('[a \\[b\\] \\\\c](https://x)');
  });
});

describe('cell', () => {
  it('escapes pipes and backslashes, backslashes first', () => {
    expect(cell('a | b')).toBe('a \\| b');
    // Escaping the pipe alone would leave `\\|`: an escaped backslash, then a
    // live column break.
    expect(cell('a\\|b')).toBe('a\\\\\\|b');
    expect(cell('ends in \\')).toBe('ends in \\\\');
  });

  it('folds a line break into one space', () => {
    expect(cell('one\n  two')).toBe('one two');
  });
});

describe('table', () => {
  it('right-aligns the numeric columns', () => {
    expect(table(['Meal', 'Calories'], [['Pho', '450 kcal']], [1])).toEqual([
      '| Meal | Calories |',
      '| --- | ---: |',
      '| Pho | 450 kcal |',
    ]);
  });
});
