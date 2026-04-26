import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUTRIENTS,
  NUTRIENT_META,
} from '@/lib/nutrition/catalog/nutrients';
import { resolveMicronutrientTargets } from '@/lib/nutrition/catalog/reference-targets';

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

  it('does not score age-dependent Vietnam iron when female age is missing', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: 'female',
      age: null,
    });

    expect(targets.ironMg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'unsupported',
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

  it('does not score sex-dependent nutrients when biological sex is missing', () => {
    const targets = resolveMicronutrientTargets({
      ...baseProfile,
      biologicalSex: null,
    });

    expect(targets.ironMg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'unsupported',
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
