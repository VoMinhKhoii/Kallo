import { describe, expect, it } from 'vitest';
import { buildBm25Index } from '../bm25-index';
import { conceptKey } from '../concept-key';
import { buildLexicalIndex } from '../lexical-index';

const row = (nameEn: string, state = 'raw') => ({
  sourceCode: 'USDA_SR',
  state,
  nameEn,
  namePrimary: 'x',
});

describe('conceptKey', () => {
  it('folds grade and salt siblings into one concept', () => {
    expect(conceptKey(row('Beef, brisket, flat half, choice, raw'))).toBe(
      conceptKey(row('Beef, brisket, flat half, select, raw'))
    );
    expect(conceptKey(row('Peanuts, dry-roasted, with salt'))).toBe(
      conceptKey(row('Peanuts, dry-roasted, without salt'))
    );
  });

  it('keeps cuts, states and sources apart', () => {
    expect(conceptKey(row('Beef, brisket, flat half, raw'))).not.toBe(
      conceptKey(row('Beef, brisket, point half, raw'))
    );
    expect(conceptKey(row('Rice, white', 'raw'))).not.toBe(
      conceptKey(row('Rice, white', 'cooked'))
    );
    expect(conceptKey(row('Rice, white'))).not.toBe(
      conceptKey({ ...row('Rice, white'), sourceCode: 'FAO_VN_2007' })
    );
  });
});

describe('buildLexicalIndex', () => {
  const index = buildLexicalIndex(
    new Map([
      ['bo', new Set(['thịt bò', 'beef'])],
      ['bo-butter', new Set(['bơ', 'butter'])],
      ['ga', new Set(['ức gà', 'chicken breast'])],
    ])
  );

  it('matches names with diacritics as written', () => {
    expect(index.search('thịt bò')[0]).toBe('bo');
    expect(index.search('bơ')[0]).toBe('bo-butter');
  });

  it('matches an ASCII-only query against unaccented names', () => {
    expect(index.search('uc ga')[0]).toBe('ga');
  });

  it('finds a row by an English alias and caps results', () => {
    expect(index.search('chicken')).toEqual(['ga']);
    expect(index.search('b', 1)).toHaveLength(1);
  });
});

describe('buildBm25Index', () => {
  it('ranks the row sharing the rarest specific words first', () => {
    const index = buildBm25Index([
      {
        id: 'flat',
        text: 'Beef, brisket, flat half, separable lean only, raw',
      },
      {
        id: 'point',
        text: 'Beef, brisket, point half, separable lean and fat, raw',
      },
      { id: 'chuck', text: 'Beef, chuck, arm pot roast, raw' },
    ]);
    expect(index.search('Beef, brisket, flat half, raw')[0]).toBe('flat');
    expect(index.search('nothing matches here')).toEqual([]);
  });
});
