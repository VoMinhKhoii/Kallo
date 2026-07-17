import { describe, expect, it } from 'vitest';
import { AMBIGUOUS, getConcept, resolveConcept } from '../concepts';
import { applySizeModifier, findPrior } from '../priors';
import { lookupUnit, resolveUnitType, unitsForLocale } from '../unit-lexicon';

describe('unit lexicon', () => {
  it('maps VN counters to unit types (NOT grams)', () => {
    expect(resolveUnitType('cái')).toBe('count');
    expect(resolveUnitType('lát')).toBe('slice');
    expect(resolveUnitType('tô')).toBe('container');
    expect(resolveUnitType('ly')).toBe('volume');
    expect(resolveUnitType('bánh bao')).toBe('count');
  });

  it('maps English/global units', () => {
    expect(resolveUnitType('slice')).toBe('slice');
    expect(resolveUnitType('bowl')).toBe('container');
    expect(resolveUnitType('cup')).toBe('volume');
    expect(resolveUnitType('oz')).toBe('mass');
  });

  it('normalizes case + diacritics + whitespace on lookup', () => {
    expect(resolveUnitType('  LÁT ')).toBe('slice');
    expect(lookupUnit('SLICE')?.locale).toBe('en');
  });

  it('unknown token → null (resolver will not guess)', () => {
    expect(resolveUnitType('zorp')).toBeNull();
    expect(resolveUnitType(undefined)).toBeNull();
  });

  it('is locale-tagged for coverage reporting', () => {
    expect(unitsForLocale('vi').length).toBeGreaterThan(0);
    expect(unitsForLocale('en').length).toBeGreaterThan(0);
  });
});

describe('food concepts (alias → concept)', () => {
  it('resolves specific surface forms to stable concept ids', () => {
    expect(resolveConcept('bánh bao')).toBe('banh-bao');
    expect(resolveConcept('trứng cút')).toBe('quail-egg');
    expect(resolveConcept('Bánh mỳ')).toBe('banh-mi-loaf');
    expect(resolveConcept('chicken breast')).toBe('chicken-breast');
  });

  it('generic words resolve to AMBIGUOUS, never a single guessed concept', () => {
    expect(resolveConcept('bun')).toBe(AMBIGUOUS);
    expect(resolveConcept('slice')).toBe(AMBIGUOUS);
    expect(resolveConcept('bowl')).toBe(AMBIGUOUS);
    expect(resolveConcept('rice')).toBe(AMBIGUOUS);
    expect(resolveConcept('bánh')).toBe(AMBIGUOUS);
  });

  it('unknown surface form → null (defer to LLM)', () => {
    expect(resolveConcept('totally unknown food')).toBeNull();
    expect(resolveConcept(undefined)).toBeNull();
  });

  it('concepts with a DB row link carry a verified name_primary', () => {
    expect(getConcept('banh-bao')?.dbRowName).toBe('Bánh bao nhân thịt');
    expect(getConcept('quail-egg')?.dbRowName).toBe('Trứng chim cút');
    expect(getConcept('banh-mi-loaf')?.dbRowName).toBe('Bánh mỳ');
  });

  it('concepts without a verified row leave dbRowName unset (portion-only)', () => {
    expect(getConcept('chicken-breast')?.dbRowName).toBeUndefined();
    expect(getConcept('cooked-rice')?.dbRowName).toBeUndefined();
  });
});

describe('portion priors', () => {
  it('finds an exact locale + form prior', () => {
    const p = findPrior({
      conceptId: 'banh-bao',
      unitType: 'count',
      locale: 'vi',
      form: 'composed',
    });
    expect(p?.perUnit).toEqual({ low: 150, mid: 165, high: 180 });
    expect(p?.confidence).toBe('high');
    expect(p?.source).toMatch(/bánh bao/i);
  });

  it('falls back to a global prior when no locale-specific one exists', () => {
    const p = findPrior({
      conceptId: 'chicken-breast',
      unitType: 'count',
      locale: 'vi', // no vi prior; global exists
      form: 'cooked',
    });
    expect(p?.locale).toBe('global');
  });

  it('returns null when no prior exists for the (concept, unit) pair', () => {
    expect(
      findPrior({
        conceptId: 'banh-bao',
        unitType: 'volume',
        locale: 'vi',
        form: 'composed',
      })
    ).toBeNull();
  });

  it('a slice prior is concept-scoped, never global', () => {
    // banh-mi-loaf has a slice prior; there is NO cross-concept global slice.
    const loafSlice = findPrior({
      conceptId: 'banh-mi-loaf',
      unitType: 'slice',
      locale: 'vi',
      form: 'raw',
    });
    expect(loafSlice).not.toBeNull();
    const banhBaoSlice = findPrior({
      conceptId: 'banh-bao',
      unitType: 'slice',
      locale: 'vi',
      form: 'composed',
    });
    expect(banhBaoSlice).toBeNull();
  });

  it('applySizeModifier picks low/mid/high', () => {
    const band = { low: 10, mid: 20, high: 30 };
    expect(applySizeModifier(band, 'small')).toBe(10);
    expect(applySizeModifier(band, undefined)).toBe(20);
    expect(applySizeModifier(band, 'large')).toBe(30);
  });
});
