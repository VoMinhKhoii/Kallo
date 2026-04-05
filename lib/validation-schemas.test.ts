import { describe, expect, it } from 'vitest';
import { mealMessageSchema } from '@/lib/validation';

describe('mealMessageSchema', () => {
  it('accepts valid Vietnamese input', () => {
    const result = mealMessageSchema.safeParse({
      message: 'Cơm tấm sườn bì chả',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Cơm tấm sườn bì chả');
    }
  });

  it('accepts short valid input', () => {
    const result = mealMessageSchema.safeParse({ message: 'Phở' });
    expect(result.success).toBe(true);
  });

  it('trims whitespace', () => {
    const result = mealMessageSchema.safeParse({ message: '  Bún bò Huế  ' });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Bún bò Huế');
    }
  });

  it('normalizes to NFC', () => {
    // NFD form: 'ơ' as "o" + COMBINING HORN (U+031B)
    const nfd = 'Co\u031Bm';
    const result = mealMessageSchema.safeParse({ message: nfd });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe(nfd.normalize('NFC'));
    }
  });

  it('rejects empty string', () => {
    const result = mealMessageSchema.safeParse({ message: '' });
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    const result = mealMessageSchema.safeParse({ message: '   ' });
    expect(result.success).toBe(false);
  });

  it('rejects string exceeding 500 chars', () => {
    const result = mealMessageSchema.safeParse({ message: 'a'.repeat(501) });
    expect(result.success).toBe(false);
  });

  it('rejects string with no letters (numbers only)', () => {
    const result = mealMessageSchema.safeParse({ message: '12345' });
    expect(result.success).toBe(false);
  });

  it('rejects string with only symbols', () => {
    const result = mealMessageSchema.safeParse({ message: '!@#$%' });
    expect(result.success).toBe(false);
  });

  it('accepts string with mixed letters and numbers', () => {
    const result = mealMessageSchema.safeParse({ message: '2 tô phở' });
    expect(result.success).toBe(true);
  });

  it('rejects missing message field', () => {
    const result = mealMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = mealMessageSchema.safeParse('just a string');
    expect(result.success).toBe(false);
  });
});
