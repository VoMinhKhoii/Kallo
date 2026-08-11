import { describe, expect, it } from 'vitest';
import { INSTANT_NOODLE_ROW, PRE_MATCH_ALIASES } from '../../matching/aliases';
import { AMBIGUOUS } from '../lexicon/concept-aliases';
import {
  conceptFoldCollisions,
  getConcept,
  resolveConcept,
  surfaceFormsForConcept,
} from '../lexicon/concepts';
import {
  foldCollisions,
  lookupUnit,
  resolveUnitType,
  unitsForLocale,
  unitsForType,
} from '../lexicon/unit-lexicon';
import { PIECE_UNIT_TOKENS } from '../piece-vessel';
import { applySizeModifier, findPrior, PORTION_PRIORS } from '../priors';
import { MAX_RELATIVE_BAND_WIDTH } from '../resolver';

describe('unit lexicon', () => {
  it('maps VN counters to unit types (NOT grams)', () => {
    expect(resolveUnitType('cái')).toBe('count');
    expect(resolveUnitType('lát')).toBe('slice');
    expect(resolveUnitType('tô')).toBe('container');
    expect(resolveUnitType('ly')).toBe('volume');
    expect(resolveUnitType('bánh bao')).toBe('count');
    expect(resolveUnitType('cục')).toBe('count');
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
    expect(resolveConcept('ĐÙI GÀ')).toBe('chicken-thigh');
    expect(resolveConcept('cá phi lê')).toBe('fish-fillet');
    expect(resolveConcept('nem lui')).toBe('nem-lui');
  });

  it('generic words resolve to AMBIGUOUS, never a single guessed concept', () => {
    expect(resolveConcept('bun')).toBe(AMBIGUOUS);
    expect(resolveConcept('slice')).toBe(AMBIGUOUS);
    expect(resolveConcept('bowl')).toBe(AMBIGUOUS);
    expect(resolveConcept('rice')).toBe(AMBIGUOUS);
    expect(resolveConcept('bánh')).toBe(AMBIGUOUS);
    expect(resolveConcept('miếng cá')).toBe(AMBIGUOUS);
    expect(resolveConcept('cua')).toBe(AMBIGUOUS);
    expect(resolveConcept('trứng gà luộc')).toBe(AMBIGUOUS);
  });

  it('unknown surface form → null (defer to LLM)', () => {
    expect(resolveConcept('totally unknown food')).toBeNull();
    expect(resolveConcept(undefined)).toBeNull();
  });

  it('folds Vietnamese diacritics only after an exact miss', () => {
    expect(resolveConcept('dui ga')).toBe('chicken-thigh');
    expect(resolveConcept('ca phi le')).toBe('fish-fillet');
    expect(resolveConcept('nem lui')).toBe('nem-lui');
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

  it('loosens slice to count only for a piece-like token after exact miss', () => {
    const wingPiece = findPrior({
      conceptId: 'chicken-wing',
      unitType: 'slice',
      locale: 'vi',
      form: 'any',
      pieceLikeUnit: true,
    });
    expect(wingPiece?.conceptId).toBe('chicken-wing');
    expect(wingPiece?.unitType).toBe('count');

    expect(
      findPrior({
        conceptId: 'chicken-wing',
        unitType: 'slice',
        locale: 'vi',
        form: 'any',
        pieceLikeUnit: false,
      })
    ).toBeNull();
    expect(
      findPrior({
        conceptId: 'chicken-wing',
        unitType: 'container',
        locale: 'vi',
        form: 'any',
        pieceLikeUnit: true,
      })
    ).toBeNull();
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
      ['cục', 'cuc'],
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

describe('concept/prior reachability invariants', () => {
  const HEAD_PORTION_CASES = [
    ['rib-piece', 'sườn dê', 'miếng'],
    ['chicken-wing', 'cánh gà', 'con'],
    ['chicken-thigh', 'đùi gà', 'cái'],
    ['whole-fish', 'cá nguyên con', 'con'],
    ['fish-section', 'khúc cá', 'khúc'],
    ['fish-fillet', 'cá phi lê', 'miếng'],
    ['shell-on-shrimp', 'tôm nguyên vỏ', 'con'],
    ['peeled-shrimp', 'tôm bóc vỏ', 'con'],
    ['whole-crab', 'ghẹ nguyên con', 'con'],
    ['picked-crab-meat', 'thịt cua', 'phần'],
    ['egg-in-shell', 'trứng gà nguyên vỏ', 'quả'],
    ['peeled-egg', 'trứng gà bóc vỏ', 'quả'],
  ] as const;

  it.each(
    HEAD_PORTION_CASES
  )('reaches %s from the real surface %s and unit %s', (conceptId, surface, unit) => {
    const unitType = resolveUnitType(unit);
    expect(resolveConcept(surface)).toBe(conceptId);
    expect(unitType).not.toBeNull();
    const prior = findPrior({
      conceptId,
      unitType: unitType!,
      locale: 'vi',
      form: 'any',
      pieceLikeUnit: true,
    });
    const edibleConcepts = new Set([
      'fish-fillet',
      'peeled-shrimp',
      'picked-crab-meat',
      'peeled-egg',
    ]);
    const expectedBasis = edibleConcepts.has(conceptId)
      ? 'edible'
      : 'gross_as_served';
    expect(prior?.massBasis).toBe(expectedBasis);
  });

  it('keeps every prior reachable from a real concept surface and unit type', () => {
    for (const prior of PORTION_PRIORS) {
      const surfaces = surfaceFormsForConcept(prior.conceptId);
      const units = unitsForType(prior.unitType);
      expect(
        surfaces,
        `${prior.conceptId} has no real surface form`
      ).not.toEqual([]);
      expect(
        units,
        `${prior.conceptId}/${prior.unitType} has no real unit surface`
      ).not.toEqual([]);
      expect(resolveConcept(surfaces[0])).toBe(prior.conceptId);
      const resolvedUnitType = resolveUnitType(units[0].token);
      expect(resolvedUnitType).toBe(prior.unitType);
      expect(
        findPrior({
          conceptId: prior.conceptId,
          unitType: resolvedUnitType!,
          locale: prior.locale,
          form: prior.form,
        })
      ).not.toBeNull();
    }
  });

  it('does not anchor the ambiguous bare `sườn` surface as an 85g rib piece', () => {
    expect(resolveConcept('sườn')).toBeNull();
  });

  it('keeps every prior band within the resolver width ceiling', () => {
    for (const prior of PORTION_PRIORS) {
      const relativeWidth =
        (prior.perUnit.high - prior.perUnit.low) / prior.perUnit.mid;
      expect(
        relativeWidth,
        `${prior.conceptId}/${prior.unitType} band is too wide`
      ).toBeLessThanOrEqual(MAX_RELATIVE_BAND_WIDTH);
    }
  });

  it('keeps folded unit collisions empty', () => {
    expect(foldCollisions()).toEqual([]);
  });
});

describe('instant noodles — the `1 gói mì` path', () => {
  it('types `gói` as a count unit, accented or not', () => {
    // Prod gap: `gói` was absent from the lexicon entirely, so the most
    // ordinary phrasing for instant noodles carried no unit the resolver
    // could hang a prior on and the portion stayed unanchored.
    expect(resolveUnitType('gói')).toBe('count');
    expect(resolveUnitType('GÓI')).toBe('count');
    expect(resolveUnitType('goi')).toBe('count');
    expect(resolveUnitType('pack')).toBe('count');
    expect(resolveUnitType('packets')).toBe('count');
  });

  it('adds no folded-key collision', () => {
    expect(foldCollisions()).toEqual([]);
  });

  it('resolves qualified surface forms to the packet concept', () => {
    expect(resolveConcept('mì gói')).toBe('instant-noodle-pack');
    expect(resolveConcept('Mì Tôm')).toBe('instant-noodle-pack');
    expect(resolveConcept('mi an lien')).toBe('instant-noodle-pack');
    expect(resolveConcept('instant noodles')).toBe('instant-noodle-pack');
  });

  it('leaves bare `mì` unresolved rather than guessing a packet', () => {
    // `mì` also covers fresh egg noodles and wheat flour; mapping it here
    // would put a packet's weight on a bowl of mì Quảng.
    expect(resolveConcept('mì')).toBeNull();
    expect(resolveConcept('mì xào')).toBeNull();
  });

  it('supplies a DRY packet weight, and scales with the size cue', () => {
    const prior = findPrior({
      conceptId: 'instant-noodle-pack',
      unitType: 'count',
      locale: 'vi',
      form: 'raw',
    });
    expect(prior).not.toBeNull();
    expect(prior?.perUnit.mid).toBe(80);
    expect(applySizeModifier(prior!.perUnit, 'small')).toBe(70);
    expect(applySizeModifier(prior!.perUnit, 'large')).toBe(90);
    // Dry, not prepared: noodles roughly triple in mass once cooked, so a
    // band anywhere near a bowl's mass would be the wrong basis entirely.
    expect(prior?.form).toBe('raw');
    expect(prior?.perUnit.high).toBeLessThan(150);
  });

  it('links the concept to the same row the alias targets', () => {
    // `dbRowName` has no runtime reader — this assertion IS its purpose. It is
    // the executable drift-guard tying three things that must agree: the
    // concept registry, the pre-match alias target, and the name that
    // migration 20260806120000 writes to usda_6583_raw. If someone re-curates
    // that row's name and updates only the migration, this fails.
    const concept = getConcept('instant-noodle-pack');
    expect(concept?.label).toContain('Mì gói');
    expect(concept?.dbRowName).toBe(INSTANT_NOODLE_ROW);
    expect(PRE_MATCH_ALIASES['mì tôm']).toBe(INSTANT_NOODLE_ROW);
  });
});

describe('concept fold collisions', () => {
  it('never folds into an AMBIGUOUS marker', () => {
    // `fold('bún') === 'bun'`, and bare English `bun` is a deliberate
    // AMBIGUOUS generic. Folding into it sent bún bò / bún riêu / bún chả to
    // the clarify path on 19 of 697 real-log ingredients.
    expect(resolveConcept('bún')).not.toBe(AMBIGUOUS);
    expect(resolveConcept('bun')).toBe(AMBIGUOUS);
  });

  it('blocks the canh gà soup collision without hiding exact cánh gà', () => {
    expect(resolveConcept('canh gà')).toBeNull();
    expect(resolveConcept('cánh gà')).toBe('chicken-wing');
  });

  it('refuses to guess when two concepts share a folded key', () => {
    // bơ/bò → `bo`, dưa/dừa/dứa → `dua`. Requiring diacritics is correct;
    // first-wins would silently misroute on iteration order.
    for (const key of conceptFoldCollisions()) {
      expect(resolveConcept(key)).toBeNull();
    }
  });
});
