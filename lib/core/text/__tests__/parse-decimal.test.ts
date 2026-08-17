import { describe, expect, it } from 'vitest';
import { parseDecimalInput } from '@/lib/core/text/parse-decimal';

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
