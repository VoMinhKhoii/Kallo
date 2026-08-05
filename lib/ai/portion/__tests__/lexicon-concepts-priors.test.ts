import { describe, expect, it } from 'vitest';
import { AMBIGUOUS, getConcept, resolveConcept } from '../concepts';
import { PIECE_UNIT_TOKENS } from '../piece-vessel';
import { applySizeModifier, findPrior } from '../priors';
import {
  foldCollisions,
  lookupUnit,
  resolveUnitType,
  unitsForLocale,
} from '../unit-lexicon';

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

  it('collapses whitespace INSIDE a multi-word token, not just at the ends', () => {
    // The multi-word entries are the only ones spacing can break, and a
    // double-spaced token is exactly what a model emits. Trimming alone left
    // these missing the table entirely.
    expect(resolveUnitType('phi  lê')).toBe('slice');
    expect(resolveUnitType('phi\tlê')).toBe('slice');
    // …and the folded fallback has to agree, for the un-accented typing case.
    expect(resolveUnitType(' PHI   LE ')).toBe('slice');
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

  it('reaches a locale-tagged prior from any request locale (locale is a prior, not a filter)', () => {
    // Production regression: nothing populated userContext.inputLanguage, so
    // every request resolved locale='global' and the vi-tagged bánh bao prior
    // was unreachable — "2 bánh bao trứng cút" fell to LLM-guess grams again
    // (293 kcal observed in eval vs the ~750 the prior anchors).
    for (const locale of ['global', 'en'] as const) {
      const p = findPrior({
        conceptId: 'banh-bao',
        unitType: 'count',
        locale,
        form: 'composed',
      });
      expect(p?.perUnit).toEqual({ low: 150, mid: 165, high: 180 });
    }
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

/**
 * The unit lexicon and PIECE_UNIT_TOKENS are two hand-maintained lists of the
 * same thing — counter words. They drifted: `steak`, `fillet`, `chunk`, `cut`,
 * `khoanh`, `khứa` and `phi lê` gated the piece picker while being invisible to
 * the lexicon, so those portions got a silhouette and no unit the resolver
 * could hang a prior on. Unanchored, the estimate comes back too wide and the
 * anomaly gate routes the whole meal to clarify — on web that's a question, on
 * mobile it was a dead stream.
 *
 * Neither table is a strict superset of the other by design (the lexicon also
 * holds containers and masses), but every PIECE token must be a known unit.
 */
describe('unit token tables agree', () => {
  it('types every piece token in the lexicon', () => {
    const unknown = [...PIECE_UNIT_TOKENS].filter(
      (token) => resolveUnitType(token) === null
    );
    expect(unknown).toEqual([]);
  });

  it('types a Vietnamese counter typed without its tone marks', () => {
    // Very common input ("2 lat ca kho"). PIECE_UNIT_TOKENS folds diacritics
    // and this table did not, so the picker recognised a token the resolver
    // could not.
    for (const [accented, bare] of [
      ['miếng', 'mieng'],
      ['lát', 'lat'],
      ['khúc', 'khuc'],
      ['phi lê', 'phi le'],
      ['tô', 'to'],
      ['đĩa', 'dia'],
    ]) {
      expect(resolveUnitType(bare), bare).toBe(resolveUnitType(accented));
      expect(resolveUnitType(bare), bare).not.toBeNull();
    }
  });

  it('never folds two different unit types onto one key', () => {
    expect(foldCollisions()).toEqual([]);
  });

  it('recognises both the singular and the plural counter', () => {
    // Neither normalizer strips a trailing "s", so plurals are listed
    // explicitly or they simply do not match.
    for (const [singular, plural] of [
      ['steak', 'steaks'],
      ['fillet', 'fillets'],
      ['piece', 'pieces'],
      ['slice', 'slices'],
      ['chunk', 'chunks'],
      ['cut', 'cuts'],
    ]) {
      expect(resolveUnitType(singular), singular).not.toBeNull();
      expect(resolveUnitType(plural), plural).not.toBeNull();
      expect(PIECE_UNIT_TOKENS.has(singular), singular).toBe(true);
      expect(PIECE_UNIT_TOKENS.has(plural), plural).toBe(true);
    }
  });
});
