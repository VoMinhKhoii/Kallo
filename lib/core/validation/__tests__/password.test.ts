import { describe, expect, it } from 'vitest';
import {
  existingPasswordSchema,
  newPasswordSchema,
  PASSWORD_MAX_BYTES,
  PASSWORD_MIN_LENGTH,
  passwordRequirements,
} from '@/lib/core/validation/password';

/** The issue codes a value fails with, in order. */
function issues(value: string, schema = newPasswordSchema): string[] {
  const result = schema.safeParse(value);
  return result.success ? [] : result.error.issues.map((i) => i.message);
}

describe('newPasswordSchema', () => {
  // Mirrors the production Supabase dashboard: minimum 8, letters_digits.
  it('matches the dashboard minimum', () => {
    expect(PASSWORD_MIN_LENGTH).toBe(8);
    expect(PASSWORD_MAX_BYTES).toBe(72);
  });

  it('rejects 7 characters even with a letter and a digit', () => {
    expect(issues('abcdef1')).toEqual(['too_short']);
  });

  it('rejects a password of only letters', () => {
    expect(issues('abcdefgh')).toEqual(['needs_digit']);
  });

  it('rejects a password of only digits', () => {
    expect(issues('12345678')).toEqual(['needs_letter']);
  });

  it('accepts the shortest valid password', () => {
    expect(issues('abcdefg1')).toEqual([]);
  });

  it('accepts a long passphrase with a digit', () => {
    expect(issues('correct horse battery staple 42')).toEqual([]);
  });

  it('accepts exactly 72 bytes and rejects 73', () => {
    const at = `${'a'.repeat(71)}1`;
    expect(issues(at)).toEqual([]);
    expect(issues(`${at}b`)).toEqual(['too_long']);
  });

  // bcrypt reads bytes, so the cap is bytes: 36 two-byte letters plus a digit
  // is 37 characters but 73 bytes, and would be silently truncated.
  it('counts the 72 cap in UTF-8 bytes, not characters', () => {
    const accented = `${'ă'.repeat(36)}1`;
    expect(accented.length).toBe(37);
    expect(issues(accented)).toContain('too_long');
  });

  // GoTrue's letters_digits rule matches ASCII letters only; an accented
  // letter alone does not satisfy it there, so it must not here either.
  it('needs an ASCII letter, like the server', () => {
    expect(issues('ăââêêôô12')).toEqual(['needs_letter']);
  });
});

describe('existingPasswordSchema (sign-in)', () => {
  // Accounts created under the old 6-character policy must still sign in.
  it('accepts an old 6-character password with no digit', () => {
    expect(issues('hunter', existingPasswordSchema)).toEqual([]);
  });

  it('accepts any non-empty value up to the byte cap', () => {
    expect(issues('1', existingPasswordSchema)).toEqual([]);
    expect(issues('a'.repeat(72), existingPasswordSchema)).toEqual([]);
  });

  it('rejects an empty value and anything over 72 bytes', () => {
    expect(issues('', existingPasswordSchema)).toEqual(['required']);
    expect(issues('a'.repeat(73), existingPasswordSchema)).toEqual([
      'too_long',
    ]);
  });
});

describe('passwordRequirements', () => {
  it('reports each rule independently for the live hints', () => {
    expect(passwordRequirements('')).toEqual({
      length: false,
      letter: false,
      digit: false,
    });
    expect(passwordRequirements('abc1')).toEqual({
      length: false,
      letter: true,
      digit: true,
    });
    expect(passwordRequirements('abcdefg1')).toEqual({
      length: true,
      letter: true,
      digit: true,
    });
  });
});
