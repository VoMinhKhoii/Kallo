import { describe, expect, it } from 'vitest';
import { linkWords } from '../linked-words';

describe('linkWords', () => {
  it('links the first place each link’s words appear, in text order', () => {
    expect(
      linkWords('canh chua, rau muống xào tỏi, canh chua', [
        { words: 'rau muống xào tỏi', to: '/b' },
        { words: 'canh chua', to: '/a' },
      ])
    ).toEqual([
      { text: 'canh chua', to: '/a' },
      { text: ', ' },
      { text: 'rau muống xào tỏi', to: '/b' },
      { text: ', canh chua' },
    ]);
  });

  it('returns the text as one plain run when no link matches', () => {
    expect(linkWords('Orange chicken', [])).toEqual([
      { text: 'Orange chicken' },
    ]);
    expect(
      linkWords('Orange chicken', [{ words: 'fried rice', to: '/x' }])
    ).toEqual([{ text: 'Orange chicken' }]);
  });

  it('matches case exactly and skips a link that overlaps an earlier one', () => {
    expect(
      linkWords('Fried chicken, crispy fried chicken breast', [
        { words: 'fried chicken', to: '/a' },
        { words: 'chicken breast', to: '/b' },
      ])
    ).toEqual([
      { text: 'Fried chicken, crispy ' },
      { text: 'fried chicken', to: '/a' },
      { text: ' breast' },
    ]);
  });

  it('keeps every character of the text', () => {
    const text = 'Orange chicken with fried rice';
    const parts = linkWords(text, [{ words: 'fried rice', to: '/x' }]);
    expect(parts.map((part) => part.text).join('')).toBe(text);
  });

  it('links whole words only, skipping a match inside a longer word', () => {
    expect(
      linkWords('8 air-fried chicken wings, then fried chicken', [
        { words: 'fried chicken', to: '/a' },
      ])
    ).toEqual([
      { text: '8 air-fried chicken wings, then ' },
      { text: 'fried chicken', to: '/a' },
    ]);
    expect(
      linkWords('1 miếng chả, 1 tô miến gà', [{ words: 'miến', to: '/m' }])
    ).toEqual([
      { text: '1 miếng chả, 1 tô ' },
      { text: 'miến', to: '/m' },
      { text: ' gà' },
    ]);
    expect(linkWords('Two gyros', [{ words: 'gyro', to: '/g' }])).toEqual([
      { text: 'Two gyros' },
    ]);
  });

  it('ignores empty words and treats regex characters literally', () => {
    expect(linkWords('a (b) c', [{ words: '', to: '/x' }])).toEqual([
      { text: 'a (b) c' },
    ]);
    expect(linkWords('a (b) c', [{ words: '(b)', to: '/x' }])).toEqual([
      { text: 'a ' },
      { text: '(b)', to: '/x' },
      { text: ' c' },
    ]);
  });
});
