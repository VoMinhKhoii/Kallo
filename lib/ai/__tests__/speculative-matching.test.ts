import { describe, expect, it } from 'vitest';
import { extractIngredientNames } from '../matching/speculative';

describe('extractIngredientNames', () => {
  it('extracts names from partial JSON stream', () => {
    const seen = new Set<string>();
    const partial =
      '{"mealItems":[{"name":"Cơm","ingredients":[{"name":"Gạo tẻ","estimatedGrams":200';
    const names = extractIngredientNames(partial, seen);
    // Both "Cơm" (meal item) and "Gạo tẻ" (ingredient) are extracted
    expect(names).toContain('Cơm');
    expect(names).toContain('Gạo tẻ');
  });

  it('tracks seen names and returns only new ones', () => {
    const seen = new Set<string>();
    const partial1 =
      '{"mealItems":[{"name":"Cơm","ingredients":[{"name":"Gạo tẻ"';
    extractIngredientNames(partial1, seen);

    // Second chunk adds a new ingredient
    const partial2 = `${partial1},{"name":"Thịt bò","estimatedGrams":150}`;
    const newNames = extractIngredientNames(partial2, seen);
    expect(newNames).toEqual(['Thịt bò']);
    expect(newNames).not.toContain('Gạo tẻ');
    expect(newNames).not.toContain('Cơm');
  });

  it('returns empty array when no new names found', () => {
    const seen = new Set<string>(['Cơm', 'Gạo tẻ']);
    const partial = '{"name":"Cơm","ingredients":[{"name":"Gạo tẻ"}]}';
    expect(extractIngredientNames(partial, seen)).toEqual([]);
  });

  it('handles empty string', () => {
    expect(extractIngredientNames('', new Set())).toEqual([]);
  });

  it('handles malformed JSON gracefully', () => {
    const partial = '{"name":"Incomplete';
    // Should not crash — regex just won't match incomplete strings
    expect(extractIngredientNames(partial, new Set())).toEqual([]);
  });

  it('extracts names with Vietnamese diacritics', () => {
    const seen = new Set<string>();
    const partial =
      '{"name":"Bún bò Huế","ingredients":[{"name":"Bún phở"},{"name":"Thịt bò"}]}';
    const names = extractIngredientNames(partial, seen);
    expect(names).toContain('Bún bò Huế');
    expect(names).toContain('Bún phở');
    expect(names).toContain('Thịt bò');
  });
});
