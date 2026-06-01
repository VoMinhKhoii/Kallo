import { describe, expect, it } from 'vitest';
import { isValidHandle, validateHandle } from './handles';

describe('validateHandle', () => {
  it('accepts a well-formed handle and lowercases it', () => {
    const result = validateHandle('Khoi_99');
    expect(result).toEqual({ valid: true, handle: 'khoi_99' });
  });

  it('trims surrounding whitespace before validating', () => {
    expect(validateHandle('  khoi  ')).toEqual({
      valid: true,
      handle: 'khoi',
    });
  });

  it('rejects handles shorter than 3 chars', () => {
    expect(validateHandle('ab')).toEqual({ valid: false, error: 'too_short' });
  });

  it('rejects handles longer than 20 chars', () => {
    expect(validateHandle('a'.repeat(21))).toEqual({
      valid: false,
      error: 'too_long',
    });
  });

  it('rejects disallowed characters', () => {
    expect(validateHandle('hi there')).toEqual({
      valid: false,
      error: 'invalid_chars',
    });
    expect(validateHandle('hi-there')).toEqual({
      valid: false,
      error: 'invalid_chars',
    });
    expect(validateHandle('café99')).toEqual({
      valid: false,
      error: 'invalid_chars',
    });
  });

  it('rejects reserved handles (case-insensitive)', () => {
    expect(validateHandle('admin')).toEqual({
      valid: false,
      error: 'reserved',
    });
    expect(validateHandle('NHAM')).toEqual({
      valid: false,
      error: 'reserved',
    });
    expect(validateHandle('Support')).toEqual({
      valid: false,
      error: 'reserved',
    });
  });

  it('isValidHandle is a convenience predicate', () => {
    expect(isValidHandle('valid_one')).toBe(true);
    expect(isValidHandle('admin')).toBe(false);
    expect(isValidHandle('x')).toBe(false);
  });
});
