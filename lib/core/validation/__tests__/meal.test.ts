import { describe, expect, it } from 'vitest';
import {
  displayTextSchema,
  mealMessageSchema,
} from '@/lib/core/validation/meal';

function mealBody(message: string) {
  return {
    message,
    loggedDate: '2026-04-24',
    timezoneOffset: -420,
  };
}

/** One pick, so `displayText` is legal at all (it only rides with picks). */
const DISH_REF = {
  kind: 'dish' as const,
  sourceMealId: '11111111-1111-4111-8111-111111111111',
  mealItemOrder: 0,
};

/** A long but perfectly ordinary composer sentence. */
const NINE_HUNDRED_CHARS = 'Cơm tấm sườn bì chả và một ly trà đá. '
  .repeat(25)
  .slice(0, 900);

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

  // -------------------------------------------------------------------------
  // `displayText` — the label that BECOMES `meals.raw_input`.
  // -------------------------------------------------------------------------

  it('normalizes a displayText to NFC, the way the message is', () => {
    // Telex/VNI types decomposed; the stored names are composed. Persisting the
    // label un-normalized would store a byte sequence nothing else matches.
    const nfd = 'Co\u031Bm tấm';
    const result = mealMessageSchema.safeParse({
      ...mealBody('2 boiled eggs'),
      refs: [DISH_REF],
      displayText: nfd,
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.displayText).toBe(nfd.normalize('NFC'));
    }
  });

  it.each([
    ['URL-only', 'https://example.com'],
    ['no letters', '12345'],
    ['repeated-character garbage', 'aaaaaaaaaaaaaaaaaaaaaaaa'],
  ])('rejects a %s displayText', (_label, displayText) => {
    // `message` has always refused these. The label reaches the database too,
    // so it cannot be the way they get in.
    const result = mealMessageSchema.safeParse({
      ...mealBody('2 boiled eggs'),
      refs: [DISH_REF],
      displayText,
    });
    expect(result.success).toBe(false);
  });

  it('accepts a 900-char legal sentence — the cap is 2000, not 500', () => {
    // The composer sentence is `message` with up to 20 pick labels cut back IN,
    // so capping it at 500 would reject a legal composer. The server truncates
    // it to 500 at persist time instead.
    expect(NINE_HUNDRED_CHARS).toHaveLength(900);
    const result = mealMessageSchema.safeParse({
      ...mealBody('2 boiled eggs'),
      refs: [DISH_REF],
      displayText: NINE_HUNDRED_CHARS,
    });
    expect(result.success).toBe(true);
  });

  it('rejects a displayText past 2000 chars', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('2 boiled eggs'),
      refs: [DISH_REF],
      displayText: 'Cơm tấm sườn bì chả và trà đá. '.repeat(70),
    });
    expect(result.success).toBe(false);
  });

  it('rejects a displayText with no picks to explain it', () => {
    // With no picks, `message` IS the sentence — a second, unvalidated copy of
    // it is either a mistake or a way to persist a label the description schema
    // never saw.
    const result = mealMessageSchema.safeParse({
      ...mealBody('Cơm tấm sườn bì chả'),
      displayText: 'Cơm tấm sườn bì chả',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['displayText']);
    }
  });

  it('rejects a displayText alongside an empty refs array', () => {
    const result = mealMessageSchema.safeParse({
      ...mealBody('Cơm tấm sườn bì chả'),
      refs: [],
      displayText: 'Cơm tấm sườn bì chả',
    });
    expect(result.success).toBe(false);
  });
});

describe('displayTextSchema', () => {
  // The shared inner schema, so the meals contract's `stageRelogAnalysis` body
  // gets exactly the hygiene the analyze-meal body does.
  it('trims and normalizes to NFC', () => {
    const result = displayTextSchema.safeParse('  Co\u031Bm tấm  ');
    expect(result.success).toBe(true);
    if (result.success) expect(result.data).toBe('Cơm tấm');
  });

  it.each([
    'https://example.com',
    'www.abc',
    '12345',
    '!@#$%',
    'aaaaaaaa',
    '',
  ])('rejects %j', (value) => {
    expect(displayTextSchema.safeParse(value).success).toBe(false);
  });

  it('accepts a 900-char legal sentence', () => {
    expect(displayTextSchema.safeParse(NINE_HUNDRED_CHARS).success).toBe(true);
  });
});
