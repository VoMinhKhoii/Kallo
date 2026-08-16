import { describe, expect, it } from 'vitest';
import { mealMessageSchema } from '@/lib/validation/meal';

function mealBody(message: string) {
  return {
    message,
    loggedDate: '2026-04-24',
    timezoneOffset: -420,
  };
}

describe('mealMessageSchema', () => {
  it('accepts valid Vietnamese input', () => {
    const result = mealMessageSchema.safeParse(mealBody('Cơm tấm sườn bì chả'));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Cơm tấm sườn bì chả');
    }
  });

  it('accepts short valid input', () => {
    const result = mealMessageSchema.safeParse(mealBody('Phở'));
    expect(result.success).toBe(true);
  });

  it('accepts a normal meal description', () => {
    const result = mealMessageSchema.safeParse(
      mealBody('chicken breast with rice')
    );
    expect(result.success).toBe(true);
  });

  it.each(['en', 'vi'] as const)('accepts optional locale %s', (locale) => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('chicken breast with rice'),
      locale,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.locale).toBe(locale);
    }
  });

  it('rejects unsupported locale values', () => {
    const result = mealMessageSchema.safeParse({
      message: 'chicken breast with rice',
      locale: 'fr',
    });
    expect(result.success).toBe(false);
  });

  it('trims whitespace', () => {
    const result = mealMessageSchema.safeParse(mealBody('  Bún bò Huế  '));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe('Bún bò Huế');
    }
  });

  it('normalizes to NFC', () => {
    // NFD form: 'ơ' as "o" + COMBINING HORN (U+031B)
    const nfd = 'Co\u031Bm';
    const result = mealMessageSchema.safeParse(mealBody(nfd));
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.message).toBe(nfd.normalize('NFC'));
    }
  });

  it('rejects empty string', () => {
    const result = mealMessageSchema.safeParse(mealBody(''));
    expect(result.success).toBe(false);
  });

  it('rejects whitespace-only string', () => {
    const result = mealMessageSchema.safeParse(mealBody('   '));
    expect(result.success).toBe(false);
  });

  it('rejects string exceeding 500 chars', () => {
    const result = mealMessageSchema.safeParse(mealBody('a'.repeat(501)));
    expect(result.success).toBe(false);
  });

  it('rejects string with no letters (numbers only)', () => {
    const result = mealMessageSchema.safeParse(mealBody('12345'));
    expect(result.success).toBe(false);
  });

  it('rejects string with only symbols', () => {
    const result = mealMessageSchema.safeParse(mealBody('!@#$%'));
    expect(result.success).toBe(false);
  });

  it('rejects repeated-character garbage', () => {
    const result = mealMessageSchema.safeParse({
      message: 'aaaaaaaaaaaaaaaaaaaaaaaa',
    });
    expect(result.success).toBe(false);
  });

  it('rejects URL-only input', () => {
    const result = mealMessageSchema.safeParse({
      message: 'https://example.com',
    });
    expect(result.success).toBe(false);
  });

  it.each([
    'https://',
    'http://',
    'www.',
  ])('rejects URL-like garbage: %s', (message) => {
    const result = mealMessageSchema.safeParse({ message });
    expect(result.success).toBe(false);
  });

  it('accepts string with mixed letters and numbers', () => {
    const result = mealMessageSchema.safeParse(mealBody('2 tô phở'));
    expect(result.success).toBe(true);
  });

  it('rejects impossible logged dates', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('Phở bò'),
      loggedDate: '2026-02-30',
    });
    expect(result.success).toBe(false);
  });

  it('rejects missing message field', () => {
    const result = mealMessageSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it('rejects non-object input', () => {
    const result = mealMessageSchema.safeParse('just a string');
    expect(result.success).toBe(false);
  });

  it('accepts an ISO inheritLoggedAt for a refine', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('Phở bò (thêm trứng)'),
      inheritLoggedAt: '2026-04-05T17:30:00.000Z',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.inheritLoggedAt).toBe('2026-04-05T17:30:00.000Z');
    }
  });

  it('rejects a non-ISO inheritLoggedAt', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('Phở bò'),
      inheritLoggedAt: 'yesterday',
    });
    expect(result.success).toBe(false);
  });

  it('accepts refs alongside free text (combined precise relog)', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('2 boiled eggs'),
      refs: [
        {
          kind: 'dish',
          sourceMealId: '11111111-1111-4111-8111-111111111111',
          mealItemOrder: 0,
        },
      ],
    });
    expect(result.success).toBe(true);
  });

  it('rejects refs when mode is cheat (would silently drop the picks)', () => {
    // The cheat branch returns before the relog merge, so accepting cheat+refs
    // would quietly discard the user's picks — reject instead.
    const result = mealMessageSchema.safeParse({
      ...mealBody('bữa xả'),
      mode: 'cheat',
      refs: [
        {
          kind: 'meal',
          sourceMealId: '22222222-2222-4222-8222-222222222222',
        },
      ],
    });
    expect(result.success).toBe(false);
  });
});
