import { describe, expect, it } from 'vitest';
import {
  decideMealLanguage,
  detectMealInputLanguage,
} from '@/lib/ai/language/detect';

describe('detectMealInputLanguage', () => {
  it('detects Vietnamese input from diacritics', () => {
    expect(detectMealInputLanguage('cơm thịt kho trứng')).toBe('vi');
  });

  it('detects short unaccented Vietnamese dish descriptions', () => {
    expect(detectMealInputLanguage('com tam suon nuong')).toBe('vi');
  });

  it('treats Vietnamese food words inside English sentences as mixed', () => {
    expect(detectMealInputLanguage('pho bo with extra beef')).toBe('mixed');
  });

  it('detects clear English ascii meal input', () => {
    expect(detectMealInputLanguage('grilled chicken with rice')).toBe('en');
  });

  it('keeps brand-heavy English food input in English', () => {
    expect(detectMealInputLanguage('KFC zinger burger')).toBe('en');
  });

  it('returns unknown for unsupported non-Latin input', () => {
    expect(detectMealInputLanguage('寿司')).toBe('unknown');
  });
});

describe('decideMealLanguage', () => {
  it('uses Vietnamese diacritics as the output-language signal', () => {
    expect(decideMealLanguage('bún bò Huế')).toEqual({
      inputLanguage: 'vi',
      outputLanguage: 'vi',
      reason: 'vietnamese_diacritics',
    });
  });

  it('uses Vietnamese food words as the output-language signal', () => {
    expect(decideMealLanguage('banh mi thit nuong')).toEqual({
      inputLanguage: 'vi',
      outputLanguage: 'vi',
      reason: 'vietnamese_food_word',
    });
  });

  it('uses English ascii as the output-language signal', () => {
    expect(decideMealLanguage('salmon salad with rice')).toEqual({
      inputLanguage: 'en',
      outputLanguage: 'en',
      reason: 'english_ascii',
    });
  });

  it('uses locale fallback for mixed text', () => {
    expect(
      decideMealLanguage('pho bo with extra beef', { localeFallback: 'vi' })
    ).toEqual({
      inputLanguage: 'mixed',
      outputLanguage: 'vi',
      reason: 'locale_fallback',
    });
  });

  it('defaults mixed or unknown input to English without a locale fallback', () => {
    expect(decideMealLanguage('pho bo with extra beef')).toEqual({
      inputLanguage: 'mixed',
      outputLanguage: 'en',
      reason: 'default_fallback',
    });
  });
});
