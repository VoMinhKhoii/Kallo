import { describe, expect, it } from 'vitest';
import { capitalizeFirst } from '@/lib/core/text/capitalize';

// Mirrors apps/mobile-flutter/test/shared/logic/display_format_test.dart —
// the composer's lower-case names get a capital, barcode/OCR brand casing
// ("belVita", "iPro") must survive untouched.
describe('capitalizeFirst', () => {
  it('capitalizes a lower-case composer name', () => {
    expect(capitalizeFirst('phở bò')).toBe('Phở bò');
  });

  it('capitalizes a diacritic first character', () => {
    expect(capitalizeFirst('gạo tẻ')).toBe('Gạo tẻ');
  });

  it('leaves a brand name whose first word is mixed-case alone', () => {
    expect(capitalizeFirst('belVita cookies')).toBe('belVita cookies');
    expect(capitalizeFirst('iPro shake')).toBe('iPro shake');
  });

  it('leaves a name starting with a digit alone', () => {
    expect(capitalizeFirst('120g gạo')).toBe('120g gạo');
  });

  it('leaves a name starting with an emoji alone', () => {
    expect(capitalizeFirst('🍜 bún')).toBe('🍜 bún');
  });

  it('passes an empty string straight through', () => {
    expect(capitalizeFirst('')).toBe('');
  });
});
