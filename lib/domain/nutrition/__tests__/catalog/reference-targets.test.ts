import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUTRIENTS,
  NUTRIENT_META,
} from '@/lib/domain/nutrition/catalog/nutrients';
import {
  type AgeBand,
  NASEM_DRI,
  VIETNAM_RDA,
  WHO_FAO,
} from '@/lib/domain/nutrition/catalog/reference-target-tables';
import { resolveMicronutrientTargets } from '@/lib/domain/nutrition/catalog/reference-targets';

const baseProfile = {
  biologicalSex: 'male',
  age: 30,
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
};

describe('resolveMicronutrientTargets', () => {
  it('uses Vietnam RDA for Vietnamese onboarding context', () => {
    const targets = resolveMicronutrientTargets(baseProfile);

    expect(targets.ironMg).toMatchObject({
      value: 10,
      unit: 'mg',
      source: 'vietnam_rda',
      sourceLabelKey: 'nutrition.targetSources.vietnamRda',
    });
    expect(targets.vitaminCMg).toMatchObject({
      value: 70,
      source: 'vietnam_rda',
    });
  });

  it('returns a target object for every known nutrient key', () => {
    const targets = resolveMicronutrientTargets(baseProfile);

    expect(Object.keys(targets).sort()).toEqual(
      Object.keys(NUTRIENT_META).sort()
    );
    // Sodium is now a scored ceiling target for VN users (DG <2000 mg).
    expect(targets.sodiumMg).toMatchObject({
      value: 2000,
      unit: 'mg',
      source: 'vietnam_rda',
      applicability: 'scored',
      nutrientType: 'ceiling',
    });
    // Magnesium VN RDA, adult male 20–29 yr.
    expect(targets.magnesiumMg).toMatchObject({
      value: 340,
      unit: 'mg',
      source: 'vietnam_rda',
      applicability: 'scored',
    });
  });

  it('has sourced scored targets for every default nutrient', () => {
    const vietnamTargets = resolveMicronutrientTargets(baseProfile);
    const whoTargets = resolveMicronutrientTargets({
      ...baseProfile,
      countryOfOrigin: 'US',
      countryOfResidence: 'US',
    });

    for (const nutrient of DEFAULT_NUTRIENTS) {
      expect(vietnamTargets[nutrient].applicability).toBe('scored');
      expect(vietnamTargets[nutrient].source).toBe('vietnam_rda');
      expect(vietnamTargets[nutrient].sourceLabelKey).toBe(
        'nutrition.targetSources.vietnamRda'
      );
      expect(vietnamTargets[nutrient].value).toBeGreaterThan(0);

      // WHO/FAO 2004 does not publish a phosphorus RNI, so non-VN users
      // fall back to NASEM/IOM 1997 (700 mg) instead of being unsupported.
      if (nutrient === 'phosphorusMg') {
        expect(whoTargets[nutrient].applicability).toBe('scored');
        expect(whoTargets[nutrient].source).toBe('nasem');
        expect(whoTargets[nutrient].sourceLabelKey).toBe(
          'nutrition.targetSources.nasem'
        );
        expect(whoTargets[nutrient].value).toBeGreaterThan(0);
        continue;
      }

      expect(whoTargets[nutrient].applicability).toBe('scored');
      expect(whoTargets[nutrient].source).toBe('who_fao');
      expect(whoTargets[nutrient].sourceLabelKey).toBe(
        'nutrition.targetSources.whoFao'
      );
      expect(whoTargets[nutrient].value).toBeGreaterThan(0);
    }
  });

  it('also accepts VN country codes defensively', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      countryOfOrigin: 'VN',
      countryOfResidence: null,
    });

    expect(targets.ironMg.source).toBe('vietnam_rda');
  });

  it('uses female Vietnam RDA iron for reproductive-age women', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: 'female',
      age: 28,
    });

    expect(targets.ironMg).toMatchObject({
      value: 24,
      unit: 'mg',
      source: 'vietnam_rda',
    });
  });

  it('uses postmenopausal Vietnam RDA iron for older women', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: 'female',
      age: 55,
    });

    expect(targets.ironMg).toMatchObject({
      value: 10,
      unit: 'mg',
      source: 'vietnam_rda',
    });
  });

  it('defaults age-unknown Vietnam female iron to the premenopausal RDA', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: 'female',
      age: null,
    });

    // Age unknown → keep the (higher) premenopausal floor rather than null.
    expect(targets.ironMg).toMatchObject({
      value: 24,
      source: 'vietnam_rda',
      applicability: 'scored',
    });
    expect(targets.vitaminCMg).toMatchObject({
      value: 70,
      source: 'vietnam_rda',
      applicability: 'scored',
    });
  });

  it('uses WHO/FAO for non-Vietnam context', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      countryOfOrigin: 'US',
      countryOfResidence: 'US',
    });

    expect(targets.calciumMg).toMatchObject({
      value: 1000,
      unit: 'mg',
      source: 'who_fao',
      sourceLabelKey: 'nutrition.targetSources.whoFao',
    });
    expect(targets.vitaminCMg).toMatchObject({
      value: 45,
      source: 'who_fao',
    });
  });

  it('uses the sex-neutral average when biological sex is missing', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: null,
    });

    // Sex unknown → mean of male/female RDA (iron: (10 + 24) / 2 = 17) so the
    // nutrient still scores instead of showing "no target".
    expect(targets.ironMg).toMatchObject({
      value: 17,
      source: 'vietnam_rda',
      sourceLabelKey: 'nutrition.targetSources.vietnamRda',
      applicability: 'scored',
    });
    expect(targets.vitaminCMg).toMatchObject({
      value: 70,
      unit: 'mg',
      source: 'vietnam_rda',
      sourceLabelKey: 'nutrition.targetSources.vietnamRda',
      applicability: 'scored',
    });
  });

  it('marks unsupported nutrients instead of inventing targets', () => {
    const targets = resolveMicronutrientTargets(baseProfile);

    // Vitamin D now has a real scored target (15 µg for adults 19–49)
    // even though the editorial pull-quote also stays in educationCards.
    expect(targets.vitaminDMcg).toMatchObject({
      value: 15,
      unit: 'mcg',
      source: 'vietnam_rda',
      applicability: 'scored',
    });
    expect(targets.vitaminHMcg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'hidden',
    });
  });

  describe('expanded micronutrient coverage', () => {
    const vnMaleAdult = baseProfile;
    const vnFemaleAdult = {
      ...baseProfile,
      biologicalSex: 'female' as const,
      age: 30,
    };
    const usMaleAdult = {
      ...baseProfile,
      countryOfOrigin: 'US',
      countryOfResidence: 'US',
    };
    const usFemaleAdult = {
      ...usMaleAdult,
      biologicalSex: 'female' as const,
    };

    it('encodes VN MoH 2016 values for every newly scored nutrient', () => {
      const m = resolveMicronutrientTargets(vnMaleAdult);
      const f = resolveMicronutrientTargets(vnFemaleAdult);

      expect(m.zincMg).toMatchObject({ value: 10, unit: 'mg' });
      expect(f.zincMg).toMatchObject({ value: 8 });
      expect(m.magnesiumMg).toMatchObject({ value: 340 });
      expect(f.magnesiumMg).toMatchObject({ value: 270 });
      expect(m.potassiumMg).toMatchObject({ value: 2500 });
      expect(f.potassiumMg).toMatchObject({ value: 2000 });
      expect(m.sodiumMg).toMatchObject({
        value: 2000,
        nutrientType: 'ceiling',
      });
      expect(m.copperMcg).toMatchObject({ value: 900, unit: 'mcg' });
      expect(m.manganeseMg).toMatchObject({ value: 2.3 });
      expect(f.manganeseMg).toMatchObject({ value: 1.8 });
      expect(m.vitaminEMg).toMatchObject({ value: 6.5 });
      expect(f.vitaminEMg).toMatchObject({ value: 6.0 });
      expect(m.vitaminKMcg).toMatchObject({ value: 150 });
      expect(m.vitaminB5Mg).toMatchObject({ value: 5 });
      expect(m.vitaminB9Mcg).toMatchObject({ value: 400 });
      expect(m.vitaminB12Mcg).toMatchObject({ value: 2.4 });

      for (const targets of [m, f]) {
        for (const [key, target] of Object.entries(targets)) {
          // Fiber is the one scored key VN MoH 2016 does not publish, so a VN
          // context legitimately resolves it from NASEM (see NASEM_DRI.fiberG).
          if (key === 'fiberG') continue;
          if (
            target.applicability === 'scored' &&
            target.source !== 'vietnam_rda'
          ) {
            throw new Error(
              `VN context returned non-VN source for ${key}: ${target.source}`
            );
          }
        }
      }
    });

    it('encodes WHO/FAO 2004 values for non-VN users', () => {
      const m = resolveMicronutrientTargets(usMaleAdult);
      const f = resolveMicronutrientTargets(usFemaleAdult);

      expect(m.magnesiumMg).toMatchObject({
        value: 260,
        source: 'who_fao',
      });
      expect(f.magnesiumMg).toMatchObject({ value: 220, source: 'who_fao' });
      expect(m.zincMg).toMatchObject({ value: 7.0, source: 'who_fao' });
      expect(f.zincMg).toMatchObject({ value: 4.9, source: 'who_fao' });
      expect(m.vitaminEMg).toMatchObject({ value: 10, source: 'who_fao' });
      expect(f.vitaminEMg).toMatchObject({ value: 7.5, source: 'who_fao' });
      expect(m.vitaminKMcg).toMatchObject({ value: 65, source: 'who_fao' });
      expect(f.vitaminKMcg).toMatchObject({ value: 55, source: 'who_fao' });
      expect(m.vitaminB5Mg).toMatchObject({ value: 5, source: 'who_fao' });
      expect(m.vitaminB9Mcg).toMatchObject({
        value: 400,
        source: 'who_fao',
      });
      expect(m.vitaminB12Mcg).toMatchObject({
        value: 2.4,
        source: 'who_fao',
      });
    });

    it('falls back to NASEM/IOM for nutrients WHO/FAO does not publish', () => {
      const m = resolveMicronutrientTargets(usMaleAdult);
      const f = resolveMicronutrientTargets(usFemaleAdult);

      expect(m.copperMcg).toMatchObject({
        value: 900,
        source: 'nasem',
        sourceLabelKey: 'nutrition.targetSources.nasem',
      });
      expect(m.manganeseMg).toMatchObject({ value: 2.3, source: 'nasem' });
      expect(f.manganeseMg).toMatchObject({ value: 1.8, source: 'nasem' });
      expect(m.phosphorusMg).toMatchObject({ value: 700, source: 'nasem' });
      expect(m.potassiumMg).toMatchObject({ value: 3400, source: 'nasem' });
      expect(f.potassiumMg).toMatchObject({ value: 2600, source: 'nasem' });
      expect(m.sodiumMg).toMatchObject({
        value: 2300,
        source: 'nasem',
        nutrientType: 'ceiling',
      });
    });

    it('applies VN vitamin D age split (≥50 → 20 µg)', () => {
      const young = resolveMicronutrientTargets({ ...baseProfile, age: 30 });
      const older = resolveMicronutrientTargets({ ...baseProfile, age: 60 });
      expect(young.vitaminDMcg).toMatchObject({ value: 15 });
      expect(older.vitaminDMcg).toMatchObject({ value: 20 });
    });

    it('applies WHO/FAO vitamin D age bands (5/10/15)', () => {
      const young = resolveMicronutrientTargets({ ...usMaleAdult, age: 30 });
      const mid = resolveMicronutrientTargets({ ...usMaleAdult, age: 55 });
      const old = resolveMicronutrientTargets({ ...usMaleAdult, age: 70 });
      expect(young.vitaminDMcg).toMatchObject({
        value: 5,
        source: 'who_fao',
      });
      expect(mid.vitaminDMcg).toMatchObject({ value: 10, source: 'who_fao' });
      expect(old.vitaminDMcg).toMatchObject({ value: 15, source: 'who_fao' });
    });

    it('gives fiber a NASEM AI in every context, banded at 51', () => {
      // Neither VN MoH 2016 nor WHO/FAO 2004 publish a fiber figure, so both
      // contexts resolve it from NASEM_DRI — VN users included.
      const vnMale = resolveMicronutrientTargets(vnMaleAdult);
      const vnFemale = resolveMicronutrientTargets(vnFemaleAdult);
      const usMaleOlder = resolveMicronutrientTargets({
        ...usMaleAdult,
        age: 55,
      });
      const usFemaleOlder = resolveMicronutrientTargets({
        ...usFemaleAdult,
        age: 55,
      });
      const sexUnknown = resolveMicronutrientTargets({
        ...baseProfile,
        biologicalSex: null,
      });

      expect(vnMale.fiberG).toMatchObject({
        value: 38,
        unit: 'g',
        source: 'nasem',
        applicability: 'scored',
        nutrientType: 'floor',
      });
      expect(vnFemale.fiberG).toMatchObject({ value: 25, source: 'nasem' });
      expect(usMaleOlder.fiberG).toMatchObject({ value: 30, source: 'nasem' });
      expect(usFemaleOlder.fiberG).toMatchObject({
        value: 21,
        source: 'nasem',
      });
      // Sex unknown → mean of the <51 band: (38 + 25) / 2 = 31.5, rounded to
      // a whole number by roundTarget at this scale.
      expect(sexUnknown.fiberG).toMatchObject({
        value: 32,
        unit: 'g',
        source: 'nasem',
      });
    });

    it('bands fiber below 19 too — onboarding accepts ages from 13', () => {
      // `bodyMetricsSchema` (lib/domain/onboarding/schemas.ts) takes 13–100,
      // so a teenager is a real profile and must not be scored against the
      // adult AI. Values are the NASEM 2005 Macronutrients DRI table.
      const boy12 = resolveMicronutrientTargets({
        ...usMaleAdult,
        age: 12,
      });
      const girl16 = resolveMicronutrientTargets({
        ...usFemaleAdult,
        age: 16,
      });

      expect(boy12.fiberG).toMatchObject({ value: 31, source: 'nasem' });
      expect(girl16.fiberG).toMatchObject({ value: 26, source: 'nasem' });
    });

    it('keeps the age-unknown fiber default on the adult band', () => {
      // Said out loud now rather than falling out of band ordering: an unknown
      // age scores as a 19-year-old, so it reads the 19–50 row — and the
      // toddler band at the bottom of the table cannot steal it.
      const unknownAge = resolveMicronutrientTargets({
        ...usMaleAdult,
        age: null,
      });
      const unknownAgeFemale = resolveMicronutrientTargets({
        ...usFemaleAdult,
        age: null,
      });

      expect(unknownAge.fiberG).toMatchObject({ value: 38, source: 'nasem' });
      expect(unknownAgeFemale.fiberG).toMatchObject({
        value: 25,
        source: 'nasem',
      });
    });

    it('gives the youngest fiber band its real floor (1–3 y)', () => {
      // The bottom of the table is the 1–3 y AI, not a second copy of the
      // adult row. NASEM publishes nothing below 1 y, so it also serves as the
      // catch-all.
      const toddler = resolveMicronutrientTargets({ ...usMaleAdult, age: 2 });

      expect(toddler.fiberG).toMatchObject({ value: 19, source: 'nasem' });
    });

    it('applies B6 age split at 50 (1.3 → 1.7 M / 1.5 F)', () => {
      const young = resolveMicronutrientTargets({
        ...baseProfile,
        biologicalSex: 'female',
        age: 30,
      });
      const older = resolveMicronutrientTargets({
        ...baseProfile,
        biologicalSex: 'female',
        age: 55,
      });
      const olderMale = resolveMicronutrientTargets({
        ...baseProfile,
        biologicalSex: 'male',
        age: 55,
      });
      expect(young.vitaminB6Mg).toMatchObject({ value: 1.3 });
      expect(older.vitaminB6Mg).toMatchObject({ value: 1.5 });
      expect(olderMale.vitaminB6Mg).toMatchObject({ value: 1.7 });
    });
  });
});

describe('age-banded entries', () => {
  /** Every banded entry in every published table, named by source and key. */
  const banded: Array<[string, string, AgeBand[]]> = (
    [
      ['VIETNAM_RDA', VIETNAM_RDA],
      ['WHO_FAO', WHO_FAO],
      ['NASEM_DRI', NASEM_DRI],
    ] as const
  ).flatMap(([source, table]) =>
    Object.entries(table)
      .filter(([, entry]) => entry && 'ageBands' in entry)
      .map(
        ([key, entry]) =>
          [source, key, (entry as { ageBands: AgeBand[] }).ageBands] as [
            string,
            string,
            AgeBand[],
          ]
      )
  );

  const contexts = [
    { countryOfOrigin: 'Vietnam', countryOfResidence: 'Vietnam' },
    { countryOfOrigin: 'US', countryOfResidence: 'US' },
  ];
  const sexes = ['male', 'female', null];

  it('has banded entries to check in the first place', () => {
    // Guards the loops below from silently passing on an empty list.
    expect(banded.length).toBeGreaterThan(0);
  });

  it('resolves an unknown age exactly as a 19-year-old, in every context', () => {
    // The contract the resolver now states outright. Whole target maps, so it
    // covers every banded key at once — including the ones added later.
    for (const context of contexts) {
      for (const biologicalSex of sexes) {
        const profile = { ...context, biologicalSex };
        expect(resolveMicronutrientTargets({ ...profile, age: null })).toEqual(
          resolveMicronutrientTargets({ ...profile, age: 19 })
        );
      }
    }
  });

  it('leaves every table but fiber on the band it always resolved to', () => {
    // The old rule was "unknown age takes the LAST band". For a table whose
    // only split is at 50/51 that band IS the young-adult row, so the explicit
    // 19 lands in exactly the same place and nothing about those targets
    // changes. Fiber is the one table that published bands below 19, which is
    // why it needed a duplicate adult row before and does not now.
    for (const [source, key, bands] of banded) {
      const where = `${source}.${key}`;
      expect(bands.at(-1)?.minAge, `${where} needs a catch-all`).toBe(0);
      if (key === 'fiberG') continue;
      // No band between the catch-all and 19: age 19 falls through to the same
      // last band the old null-age branch returned.
      const above = bands.slice(0, -1).map((band) => band.minAge);
      expect(Math.min(...above), `${where} bands below 19`).toBeGreaterThan(19);
    }
  });
});
