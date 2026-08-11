import { describe, expect, it } from 'vitest';
import { anchorGramsFromResolution } from '../ingredient-portion';
import { MAX_RELATIVE_BAND_WIDTH, resolvePortion } from '../resolver';
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

  it('step 3: retrieved locale-scoped prior (bánh bao count)', () => {
    const r = resolvePortion(conceptInput(), {
      count: 1,
      unitToken: 'bánh bao',
    });
    expect(r.provenance).toBe('retrieved_prior');
    expect(r.grams).toEqual({ low: 150, mid: 165, high: 180 });
    expect(r.confidence).toBe('high');
  });

  it('anchors one rib piece as gross-as-served instead of unresolved', () => {
    const r = resolvePortion(
      conceptInput({ conceptId: 'rib-piece', form: 'any' }),
      { count: 1, unitToken: 'miếng' }
    );
    expect(r).toMatchObject({
      grams: { low: 70, mid: 85, high: 100 },
      massBasis: 'gross_as_served',
      provenance: 'retrieved_prior',
    });
  });

  it.each([
    ['fish-fillet', 'miếng', 90],
    ['peeled-shrimp', 'con', 16],
    ['picked-crab-meat', 'phần', 65],
    ['peeled-egg', 'quả', 50],
  ] as const)('resolves the already-edible %s prior as a promptable anchor', (conceptId, unitToken, expectedGrams) => {
    const result = resolvePortion(conceptInput({ conceptId, form: 'any' }), {
      count: 1,
      unitToken,
    });
    expect(result.massBasis).toBe('edible');
    expect(anchorGramsFromResolution(result)).toBe(expectedGrams);
  });

  it('step 4: curated global prior (chicken breast count, locale=global)', () => {
    const r = resolvePortion(
      conceptInput({
        conceptId: 'chicken-breast',
        locale: 'en',
        form: 'cooked',
      }),
      { count: 1, unitToken: 'piece' }
    );
    expect(r.provenance).toBe('curated_prior');
    expect(r.grams?.mid).toBe(175);
  });

  it('size modifier recentres mid within the band (small → low, large → high)', () => {
    const small = resolvePortion(conceptInput(), {
      count: 1,
      unitToken: 'bánh bao',
      sizeModifier: 'small',
    });
    const large = resolvePortion(conceptInput(), {
      count: 1,
      unitToken: 'bánh bao',
      sizeModifier: 'large',
    });
    expect(small.grams?.mid).toBe(150);
    expect(large.grams?.mid).toBe(180);
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

  it('threshold constant is exposed and > 0', () => {
    expect(MAX_RELATIVE_BAND_WIDTH).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// D4 regression fixtures — pure resolver-level (no LLM call). kcal computed
// from the resolved grams × the verified DB row's per-100g energy.
// ---------------------------------------------------------------------------

describe('D4 regression — 2 bánh bao trứng cút lands 600–950 kcal', () => {
  const BANH_BAO_KCAL_PER_100G = 219; // fao_vn_2007_1009_cooked (verified)
  const QUAIL_EGG_KCAL_PER_100G = 154; // fao_vn_2007_9007_raw (verified)

  it('2 bánh bao → ~150–180g/unit, meal kcal in band', () => {
    const buns = resolvePortion(conceptInput(), {
      count: 2,
      unitToken: 'bánh bao',
    });
    expect(buns.provenance).toBe('retrieved_prior');
    expect(buns.grams?.mid).toBe(330); // 2 × 165g

    // Quail eggs inside the dish (count inherited).
    const eggs = resolvePortion(
      conceptInput({ conceptId: 'quail-egg', form: 'cooked' }),
      { count: 2, unitToken: 'quả' }
    );
    expect(eggs.grams?.mid).toBe(20); // 2 × 10g

    const bunKcal = (buns.grams!.mid * BANH_BAO_KCAL_PER_100G) / 100;
    const eggKcal = (eggs.grams!.mid * QUAIL_EGG_KCAL_PER_100G) / 100;
    const totalMid = bunKcal + eggKcal;

    // The old bug produced ~390 kcal; the grounded prior lands well inside band.
    expect(totalMid).toBeGreaterThanOrEqual(600);
    expect(totalMid).toBeLessThanOrEqual(950);
    // Even at the LOW end of the band the meal clears 600.
    const lowKcal =
      (buns.grams!.low * BANH_BAO_KCAL_PER_100G) / 100 +
      (eggs.grams!.low * QUAIL_EGG_KCAL_PER_100G) / 100;
    expect(lowKcal).toBeGreaterThanOrEqual(600);
  });

  it('2 bánh bao (count-based, no eggs) alone clears the band floor', () => {
    const buns = resolvePortion(conceptInput(), {
      count: 2,
      unitToken: 'bánh bao',
    });
    const kcal = (buns.grams!.mid * BANH_BAO_KCAL_PER_100G) / 100;
    expect(kcal).toBeGreaterThanOrEqual(600); // 330g × 2.19 = 722.7
    expect(kcal).toBeLessThanOrEqual(950);
  });
});

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
});

describe('D4 regression — explicit slice case', () => {
  it('3 lát bánh mì → loaf-scoped slice prior × 3', () => {
    const r = resolvePortion(
      conceptInput({ conceptId: 'banh-mi-loaf', locale: 'vi', form: 'raw' }),
      { count: 3, unitToken: 'lát' }
    );
    expect(r.provenance).toBe('retrieved_prior');
    // 3 × 25–35g = 75–105g, mid 90g.
    expect(r.grams).toEqual({ low: 75, mid: 90, high: 105 });
  });

  it('a bare "slice" with no concept never resolves to a number', () => {
    const r = resolvePortion(
      conceptInput({ ambiguous: true, conceptId: null }),
      { count: 1, unitToken: 'slice' }
    );
    expect(r.grams).toBeNull();
    expect(r.provenance).toBe('unresolved');
  });
});
