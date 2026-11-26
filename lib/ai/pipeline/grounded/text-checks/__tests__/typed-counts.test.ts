import { describe, expect, it } from 'vitest';
import { isTypedCount, isTypedPartCount } from '../typed-counts';

describe('isTypedCount', () => {
  it('reads counts written as digits, fractions, halves and words', () => {
    for (const [text, n] of [
      ['hai cái bánh xèo', 2],
      ['nửa dĩa cơm chiên', 0.5],
      ['half a plate of fried rice', 0.5],
      ['½ bowl of chili', 0.5],
      ['1/2 chén bò kho', 0.5],
      ['1 tô rưỡi bún bò', 1.5],
      ['tô rưỡi phở', 1.5],
      ['1 to ruoi bun bo', 1.5],
      ['2 tô rưỡi bún bò', 2.5],
      ['1 1/2 bowls of ramen', 1.5],
      ['2 ½ slices of pizza', 2.5],
      ['a quarter plate of fried rice', 0.25],
      ['three quarters of a bowl of pho', 0.75],
      ['three-quarters of a bowl of pho', 0.75],
      ['two thirds of a pizza', 2 / 3],
      ['a dozen dumplings', 12],
      ['zero burgers', 0],
      ['0 burgers', 0],
    ] as const) {
      expect(isTypedCount(n, text), text).toBe(true);
    }
  });

  it('does not read a count the text does not hold', () => {
    expect(isTypedCount(3, 'a burger and fries')).toBe(false);
    expect(isTypedCount(0, 'phở bò')).toBe(false);
  });
});

describe('isTypedPartCount', () => {
  it('needs the count beside its own unit', () => {
    const meal =
      'bánh canh 200g, 2 con tôm, 1 muỗng canh dầu điều, cơm 1 chén rưỡi, nửa chén chè';
    expect(isTypedPartCount(2, 'con', meal)).toBe(true);
    expect(isTypedPartCount(1, 'muỗng canh', meal)).toBe(true);
    expect(isTypedPartCount(1.5, 'chén', meal)).toBe(true);
    expect(isTypedPartCount(0.5, 'chén', meal)).toBe(true);
    // A count Call 1 made up ("mấy quả") or moved to another unit.
    expect(isTypedPartCount(3, 'quả', 'cà muối mấy quả, 3 bát cơm')).toBe(
      false
    );
    expect(isTypedPartCount(2, 'muỗng', meal)).toBe(false);
  });
});
