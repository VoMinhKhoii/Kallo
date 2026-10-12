import { describe, expect, it } from 'vitest';
import { anchorGramsFromResolution } from '../ingredient-portion';
import { resolvePortion } from '../resolver';
import type { ResolverConceptInput } from '../types';

const conceptInput = (
  over: Partial<ResolverConceptInput> = {}
): ResolverConceptInput => ({
  conceptId: 'banh-bao',
  ambiguous: false,
  locale: 'vi',
  form: 'composed',
  dbServingSizeG: null,
  ...over,
});

describe('resolvePortion — fallback ladder', () => {
  it('step 0: an explicit ZERO count is unresolved (clarify), never one serving', () => {
    // Production report: "0 fried chicken" was analyzed as a full serving
    // because the .positive() count schema dropped the zero silently.
    const r = resolvePortion(conceptInput({ conceptId: 'chicken-breast' }), {
      count: 0,
      unitToken: 'cái',
    });
    expect(r.provenance).toBe('unresolved');
    expect(r.grams).toBeNull();
    expect(r.unresolvedReason).toBe('explicit_zero');
  });

  it('step 0: zero count outranks even an explicit mass', () => {
    const r = resolvePortion(conceptInput({ conceptId: 'chicken-breast' }), {
      count: 0,
      explicitMass: { grams: 200, basis: 'edible' },
    });
    expect(r.provenance).toBe('unresolved');
  });

  it('step 1: explicit edible mass is honored verbatim', () => {
    const r = resolvePortion(
      conceptInput({ conceptId: 'chicken-breast', form: 'raw' }),
      { explicitMass: { grams: 250, basis: 'edible' } }
    );
    expect(r.provenance).toBe('explicit_user_mass');
    expect(r.grams).toEqual({ low: 250, mid: 250, high: 250 });
    expect(r.massBasis).toBe('edible');
    expect(r.confidence).toBe('high');
  });

  it('step 1: unknown mass becomes edible when no refuse-bearing cut exists', () => {
    const r = resolvePortion(
      conceptInput({
        conceptId: 'chicken-breast',
        canonicalName: 'Ức gà',
        rawName: 'ức gà',
      }),
      { explicitMass: { grams: 300, basis: 'unknown' } }
    );
    expect(r.grams?.mid).toBe(300);
    expect(r.massBasis).toBe('edible');
  });

  it('step 1: unknown mass becomes gross for a refuse-bearing cut', () => {
    const r = resolvePortion(
      conceptInput({
        conceptId: 'rib-piece',
        canonicalName: 'Sườn heo',
        rawName: 'sườn heo',
      }),
      { explicitMass: { grams: 300, basis: 'unknown' } }
    );
    expect(r.grams?.mid).toBe(300);
    expect(r.massBasis).toBe('gross_as_served');
  });

  it('step 1 outranks a prior when both are present', () => {
    const r = resolvePortion(conceptInput(), {
      count: 2,
      unitToken: 'bánh bao',
      explicitMass: { grams: 300, basis: 'edible' },
    });
    expect(r.provenance).toBe('explicit_user_mass');
    expect(r.grams?.mid).toBe(300);
  });

  it('step 2: packaged serving weight on the matched row × count', () => {
    const r = resolvePortion(
      conceptInput({ conceptId: 'banh-mi-loaf', dbServingSizeG: 40 }),
      { count: 2, unitToken: 'ổ' }
    );
    expect(r.provenance).toBe('packaged_serving');
    expect(r.grams?.mid).toBe(80);
  });

  // Steps 3–4 (built-in portion priors) were removed on 2026-10-12: a counted
  // unit with a seeded prior no longer pins grams — Call 2 sizes it.
  it.each([
    ['banh-bao', 'vi', 'composed', 1, 'bánh bao'],
    ['rib-piece', 'vi', 'any', 1, 'miếng'],
    ['fish-fillet', 'vi', 'any', 1, 'miếng'],
    ['peeled-egg', 'vi', 'any', 1, 'quả'],
    ['chicken-breast', 'en', 'cooked', 1, 'piece'],
    ['banh-mi-loaf', 'vi', 'raw', 3, 'lát'],
  ] as const)('defers %s × "%s" to Call 2 instead of a prior anchor', (conceptId, locale, form, count, unitToken) => {
    const r = resolvePortion(conceptInput({ conceptId, locale, form }), {
      count,
      unitToken,
      sizeModifier: 'large',
    });
    expect(r.provenance).toBe('llm_range');
    expect(r.grams).toBeNull();
    expect(anchorGramsFromResolution(r)).toBeNull();
  });

  it('"1 chén cơm" gets no gram anchor; "200g cơm" still anchors 200 g', () => {
    const rice = conceptInput({
      conceptId: 'cooked-rice',
      form: 'cooked',
      canonicalName: 'Cơm trắng',
      rawName: 'cơm',
    });
    const bowl = resolvePortion(rice, { count: 1, unitToken: 'chén' });
    expect(bowl.provenance).toBe('llm_range');
    expect(anchorGramsFromResolution(bowl)).toBeNull();

    const weighed = resolvePortion(rice, {
      explicitMass: { grams: 200, basis: 'unknown' },
    });
    expect(weighed.provenance).toBe('explicit_user_mass');
    expect(anchorGramsFromResolution(weighed)).toBe(200);
  });

  it('step 6: no prior for the unit → null, defer to Call 2 LLM range', () => {
    const r = resolvePortion(conceptInput(), {
      count: 1,
      unitToken: 'tô', // no container prior for banh-bao
    });
    expect(r.grams).toBeNull();
    expect(r.provenance).toBe('llm_range');
  });

  it('step 6: no unit token at all → null (never guesses grams)', () => {
    const r = resolvePortion(conceptInput(), { count: 2 });
    expect(r.grams).toBeNull();
    expect(r.provenance).toBe('llm_range');
  });

  it('step 7: ambiguous concept → unresolved with ambiguous_food reason', () => {
    const r = resolvePortion(
      conceptInput({ ambiguous: true, conceptId: null }),
      {
        count: 1,
        unitToken: 'cái',
      }
    );
    expect(r.grams).toBeNull();
    expect(r.provenance).toBe('unresolved');
    expect(r.unresolvedReason).toBe('ambiguous_food');
  });

  it('mass unit token does not trigger a count/slice prior lookup', () => {
    // A mass unit ("g") with no explicitMass falls through to llm_range —
    // priors are only for count/slice/volume/container units.
    const r = resolvePortion(conceptInput(), { count: 100, unitToken: 'g' });
    expect(r.provenance).toBe('llm_range');
  });
});

// ---------------------------------------------------------------------------
// D4 regression fixtures — pure resolver-level (no LLM call).
// ---------------------------------------------------------------------------

describe('D4 regression — raw-weight honored verbatim', () => {
  it('250gr ức gà cân sống → 250g exactly, no yield conversion', () => {
    const r = resolvePortion(
      conceptInput({ conceptId: 'chicken-breast', form: 'raw' }),
      { explicitMass: { grams: 250, basis: 'edible' } }
    );
    expect(r.provenance).toBe('explicit_user_mass');
    expect(r.grams).toEqual({ low: 250, mid: 250, high: 250 });
    expect(r.note).toMatch(/no yield fudge/);
  });

  it('defaults unknown explicit mass to gross for a refuse-bearing cut', () => {
    const r = resolvePortion(
      conceptInput({
        conceptId: null,
        canonicalName: 'Sườn heo',
        rawName: '1 miếng sườn heo',
      }),
      { explicitMass: { grams: 200, basis: 'unknown' } }
    );
    expect(r.grams?.mid).toBe(200);
    expect(r.massBasis).toBe('gross_as_served');
  });

  it('maps unknown basis to edible when the ingredient has no refuse cut', () => {
    const r = resolvePortion(
      conceptInput({
        conceptId: null,
        canonicalName: 'Cá kho',
        rawName: 'unknown-basis ingredient',
      }),
      { explicitMass: { grams: 200, basis: 'unknown' } }
    );
    expect(r.grams?.mid).toBe(200);
    expect(r.massBasis).toBe('edible');
  });
});

describe('D4 regression — slice with no concept', () => {
  it('a bare "slice" with no concept never resolves to a number', () => {
    const r = resolvePortion(
      conceptInput({ ambiguous: true, conceptId: null }),
      { count: 1, unitToken: 'slice' }
    );
    expect(r.grams).toBeNull();
    expect(r.provenance).toBe('unresolved');
  });
});
