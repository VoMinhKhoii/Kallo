import { describe, expect, it } from 'vitest';
import { DEFAULT_NUTRIENTS } from './nutrients';
import { resolveMicronutrientTargets } from './reference-targets';

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

    expect(targets.sodiumMg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'unsupported',
    });
    expect(targets.magnesiumMg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'unsupported',
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

  it('marks unsupported nutrients instead of inventing targets', () => {
    const targets = resolveMicronutrientTargets(baseProfile);

    expect(targets.vitaminDMcg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'educational',
    });
    expect(targets.vitaminHMcg).toMatchObject({
      value: null,
      source: 'unsupported',
      sourceLabelKey: 'nutrition.targetSources.unsupported',
      applicability: 'hidden',
    });
  });
});
