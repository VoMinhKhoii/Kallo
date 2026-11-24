import { describe, expect, it } from 'vitest';
import { linkWords } from '../linked-words';

describe('linkWords', () => {
  it('links the first place each link’s words appear, in text order', () => {
    expect(
      linkWords('canh chua, rau muống xào tỏi, canh chua', [
        { words: 'rau muống xào tỏi', href: '/b' },
        { words: 'canh chua', href: '/a' },
      ])
    ).toEqual([
      { text: 'canh chua', href: '/a' },
      { text: ', ' },
      { text: 'rau muống xào tỏi', href: '/b' },
      { text: ', canh chua' },
    ]);
  });

  it('returns the text as one plain run when no link matches', () => {
    expect(linkWords('Orange chicken', [])).toEqual([
      { text: 'Orange chicken' },
    ]);
    expect(
      linkWords('Orange chicken', [{ words: 'fried rice', href: '/x' }])
    ).toEqual([{ text: 'Orange chicken' }]);
  });

  it('matches case exactly and skips a link that overlaps an earlier one', () => {
    expect(
      linkWords('Fried chicken, crispy fried chicken breast', [
        { words: 'fried chicken', href: '/a' },
        { words: 'chicken breast', href: '/b' },
      ])
    ).toEqual([
      { text: 'Fried chicken, crispy ' },
      { text: 'fried chicken', href: '/a' },
      { text: ' breast' },
    ]);
  });

  it('keeps every character of the text', () => {
    const text = 'Orange chicken with fried rice';
    const parts = linkWords(text, [{ words: 'fried rice', href: '/x' }]);
    expect(parts.map((part) => part.text).join('')).toBe(text);
  });

  it('links whole words only, skipping a match inside a longer word', () => {
    expect(
      linkWords('8 air-fried chicken wings, then fried chicken', [
        { words: 'fried chicken', href: '/a' },
      ])
    ).toEqual([
      { text: '8 air-fried chicken wings, then ' },
      { text: 'fried chicken', href: '/a' },
    ]);
    expect(
      linkWords('1 miếng chả, 1 tô miến gà', [{ words: 'miến', href: '/m' }])
    ).toEqual([
      { text: '1 miếng chả, 1 tô ' },
      { text: 'miến', href: '/m' },
      { text: ' gà' },
    ]);
    expect(linkWords('Two gyros', [{ words: 'gyro', href: '/g' }])).toEqual([
      { text: 'Two gyros' },
    ]);
  });

  it('ignores empty words and treats regex characters literally', () => {
    expect(linkWords('a (b) c', [{ words: '', href: '/x' }])).toEqual([
      { text: 'a (b) c' },
    ]);
    expect(linkWords('a (b) c', [{ words: '(b)', href: '/x' }])).toEqual([
      { text: 'a ' },
      { text: '(b)', href: '/x' },
      { text: ' c' },
    ]);
  });
});
