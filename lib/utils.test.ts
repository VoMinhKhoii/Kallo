import { describe, expect, it } from 'vitest';
import { cn, parseDecimalInput } from '@/lib/utils';

describe('cn utility', () => {
  it('merges class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional classes', () => {
    expect(cn('base', false && 'hidden', 'visible')).toBe('base visible');
  });

  it('resolves Tailwind conflicts (last wins)', () => {
    expect(cn('px-4', 'px-8')).toBe('px-8');
  });

  it('handles undefined and null inputs', () => {
    expect(cn('foo', undefined, null, 'bar')).toBe('foo bar');
  });

  it('returns empty string for no inputs', () => {
    expect(cn()).toBe('');
  });
});

describe('parseDecimalInput', () => {
  it('parses a comma decimal separator (iOS/EU keyboards)', () => {
    expect(parseDecimalInput('65,3')).toBe(65.3);
  });

  it('parses a period decimal separator', () => {
    expect(parseDecimalInput('65.3')).toBe(65.3);
  });

  it('trims surrounding whitespace', () => {
    expect(parseDecimalInput(' 70 ')).toBe(70);
  });

  it('parses plain integers', () => {
    expect(parseDecimalInput('170')).toBe(170);
  });

  it('returns NaN for blank input', () => {
    expect(parseDecimalInput('')).toBeNaN();
    expect(parseDecimalInput('   ')).toBeNaN();
  });

  it('returns NaN for non-numeric input', () => {
    expect(parseDecimalInput('abc')).toBeNaN();
  });

  it('returns an already-numeric value unchanged (RHF setValueAs on numeric default)', () => {
    expect(parseDecimalInput(65.3)).toBe(65.3);
    expect(parseDecimalInput(70)).toBe(70);
  });
});
