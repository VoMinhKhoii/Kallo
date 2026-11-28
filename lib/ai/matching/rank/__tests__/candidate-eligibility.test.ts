import { describe, expect, it } from 'vitest';
import {
  isCandidateEligibleForIngredient,
  sourceLimitForIngredient,
} from '@/lib/ai/matching/rank/candidate-eligibility';

interface Row {
  id: string;
  name_primary: string;
  name_en: string;
  name_alt: null;
}

const row = (id: string, name_primary: string, name_en = ''): Row => ({
  id,
  name_primary,
  name_en,
  name_alt: null,
});

const CHICKEN = row(
  'chicken',
  'Đùi gà, thịt và da, sống',
  'Chicken, thigh, meat and skin, raw'
);
const TURKEY = row(
  'turkey',
  'Đùi gà tây, chỉ lấy thịt, nướng',
  'Turkey, thigh, meat only, roasted'
);
const PHEASANT = row(
  'pheasant',
  'Đùi gà lôi, chỉ lấy thịt, sống',
  'Pheasant, leg, meat only, raw'
);
const GROUSE = row(
  'grouse',
  'Ức gà gô rừng',
  'Grouse, ruffed, breast meat, skinless, raw'
);
const JUNGLE_FOWL = row('jungle-fowl', 'Thịt gà rừng', 'Jungle fowl');
const GUINEA_FOWL = row(
  'guinea-fowl',
  'Thịt gà sao',
  'Guinea hen, meat and skin, raw'
);
const STUFFING = row('stuffing', 'Bread stuffing, prepared from mix');
const BIRDS = [CHICKEN, TURKEY, PHEASANT, GROUSE, JUNGLE_FOWL, GUINEA_FOWL];

/** Ids of the rows the guard keeps for `query`. */
const kept = (query: string, rows: Row[] = BIRDS) =>
  rows
    .filter((candidate) => isCandidateEligibleForIngredient(query, candidate))
    .map((candidate) => candidate.id);

describe('isCandidateEligibleForIngredient: species', () => {
  it('keeps only chicken for a bare gà query', () => {
    expect(kept('đùi gà')).toEqual(['chicken']);
    expect(kept('thịt gà')).toEqual(['chicken']);
  });

  it('holds a named bird to its own rows, in either language', () => {
    expect(kept('đùi gà tây')).toEqual(['turkey']);
    expect(kept('turkey thigh')).toEqual(['turkey']);
    expect(kept('pheasant leg')).toEqual(['pheasant']);
    expect(kept('chim trĩ')).toEqual(['pheasant']);
  });

  it('leaves a named bird unmatched when only other birds are offered', () => {
    expect(kept('đùi gà tây', [CHICKEN, PHEASANT])).toEqual([]);
    expect(kept('turkey thigh', [CHICKEN, PHEASANT])).toEqual([]);
  });

  it('keeps grouse, jungle fowl and guinea fowl apart', () => {
    expect(kept('thịt gà rừng')).toEqual(['jungle-fowl']);
    expect(kept('jungle fowl')).toEqual(['jungle-fowl']);
    expect(kept('junglefowl')).toEqual(['jungle-fowl']);
    expect(kept('grouse breast')).toEqual(['grouse']);
    expect(kept('ức gà gô')).toEqual(['grouse']);
    expect(kept('guinea fowl')).toEqual(['guinea-fowl']);
    expect(kept('roast guineafowl')).toEqual(['guinea-fowl']);
    expect(kept('guinea-hen')).toEqual(['guinea-fowl']);
    expect(kept('gà sao')).toEqual(['guinea-fowl']);
  });

  it('keeps a row that names no bird for a query that names one', () => {
    expect(kept('turkey stuffing', [STUFFING, CHICKEN])).toEqual(['stuffing']);
  });

  it('pairs a species across languages', () => {
    const viOnly = [CHICKEN, TURKEY, PHEASANT, GROUSE].map((r) => ({
      ...r,
      name_en: '',
    }));
    const enOnly = [CHICKEN, TURKEY, PHEASANT, GROUSE].map((r) => ({
      ...r,
      name_primary: r.name_en,
      name_en: '',
    }));

    expect(kept('turkey thigh', viOnly)).toEqual(['turkey']);
    expect(kept('pheasant leg', viOnly)).toEqual(['pheasant']);
    expect(kept('đùi gà tây', enOnly)).toEqual(['turkey']);
    expect(kept('ức gà gô', enOnly)).toEqual(['grouse']);
    expect(kept('đùi gà', enOnly)).toEqual(['chicken']);
  });

  it('reads decomposed (NFD) Vietnamese on both sides', () => {
    // Vietnamese-only rows: an English name would satisfy the guard by itself.
    const nfd = (r: Row): Row => ({
      ...r,
      name_primary: r.name_primary.normalize('NFD'),
      name_en: '',
    });
    const rows = [nfd(TURKEY), nfd(CHICKEN)];

    expect(kept('đùi gà'.normalize('NFD'), rows)).toEqual(['chicken']);
    expect(kept('đùi gà tây'.normalize('NFD'), rows)).toEqual(['turkey']);
    expect(kept('đùi gà', rows)).toEqual(['chicken']);
    expect(kept('đùi gà tây', rows)).toEqual(['turkey']);
  });
});

describe('sourceLimitForIngredient', () => {
  it('over-fetches for every query a species guard can filter', () => {
    expect(sourceLimitForIngredient('đùi gà', 3)).toBe(8);
    expect(sourceLimitForIngredient('gà rán', 3)).toBe(8);
    expect(sourceLimitForIngredient('đùi gà tây', 3)).toBe(8);
    expect(sourceLimitForIngredient('turkey thigh', 3)).toBe(8);
    expect(sourceLimitForIngredient('roast guineafowl', 3)).toBe(8);
    expect(sourceLimitForIngredient('đùi gà'.normalize('NFD'), 3)).toBe(8);
  });

  it('keeps the configured limit for everything else', () => {
    expect(sourceLimitForIngredient('chicken thigh', 3)).toBe(3);
    expect(sourceLimitForIngredient('thịt bò', 3)).toBe(3);
  });
});
