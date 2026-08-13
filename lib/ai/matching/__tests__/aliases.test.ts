import { describe, expect, it } from 'vitest';
import {
  EXACT_ALIASES,
  resolveAlias,
  resolvePreMatchAlias,
} from '@/lib/ai/matching/aliases';

describe('resolveAlias', () => {
  it.each([
    ['Sugar', 'Đường kính'],
    ['Squid', 'Mực ống'],
    ['Fish sauce', 'Nước mắm'],
    ['Vegetable oil', 'Dầu đậu nành'],
    ['Steamed white rice', 'Cơm'],
  ])('maps English pipeline ingredient "%s"', (input, expected) => {
    expect(resolveAlias(input)).toBe(expected);
  });

  it('leaves unknown ingredients unchanged', () => {
    expect(resolveAlias('unknown ingredient')).toBe('unknown ingredient');
  });
});

describe('EXACT_ALIASES staples (verified DB targets)', () => {
  it.each<[string, string]>([
    ['tôm', 'Tôm biển'],
    ['shrimp', 'Tôm biển'],
    ['bánh mì', 'Bánh mỳ'],
    ['bánh mỳ', 'Bánh mỳ'],
    ['bánh bao', 'Bánh bao nhân thịt'],
    ['mực', 'Mực tươi'],
    ['squid', 'Mực tươi'],
    ['bánh ướt', 'Bánh ướt'],
    ['bánh cuốn', 'Bánh ướt'],
    ['hủ tiếu', 'Bánh phở'],
    ['bánh hỏi', 'Bún'],
    ['xôi', 'Xôi trắng'],
  ])('%s → %s', (key, target) => {
    expect(EXACT_ALIASES[key]?.target).toBe(target);
  });

  it('tags each alias with a language', () => {
    for (const entry of Object.values(EXACT_ALIASES)) {
      expect(['vi', 'en']).toContain(entry.lang);
    }
  });

  it('leaves out staples without a real DB row', () => {
    expect(EXACT_ALIASES['bánh canh']).toBeUndefined();
    expect(EXACT_ALIASES['hành phi']).toBeUndefined();
  });
});

describe('resolvePreMatchAlias', () => {
  it('rewrites the curated exact-alias staples', () => {
    expect(resolvePreMatchAlias('Tôm')).toBe('Tôm biển');
    expect(resolvePreMatchAlias('Bánh mì')).toBe('Bánh mỳ');
    expect(resolvePreMatchAlias('Mực')).toBe('Mực tươi');
  });

  it('rewrites the curated rice-sheet and rice-noodle staples', () => {
    expect(resolvePreMatchAlias('bánh ướt')).toBe('Bánh ướt');
    expect(resolvePreMatchAlias('Bánh Cuốn')).toBe('Bánh ướt');
    expect(resolvePreMatchAlias('hủ tiếu')).toBe('Bánh phở');
    expect(resolvePreMatchAlias('bánh hỏi')).toBe('Bún');
    expect(resolvePreMatchAlias('xôi')).toBe('Xôi trắng');
  });

  it('still rewrites the original wrong-match corrections', () => {
    expect(resolvePreMatchAlias('cá lóc')).toBe('Cá quả');
    expect(resolvePreMatchAlias('đậu ve')).toBe('Đậu cô ve');
  });

  it('normalizes NFD input before lookup', () => {
    expect(resolvePreMatchAlias('Tôm'.normalize('NFD'))).toBe('Tôm biển');
  });

  it('leaves unknown names unchanged', () => {
    expect(resolvePreMatchAlias('Ức gà')).toBe('Ức gà');
  });
});
