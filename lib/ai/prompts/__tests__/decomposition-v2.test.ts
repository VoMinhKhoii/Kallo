import { describe, expect, it } from 'vitest';
import {
  buildCompressedDecompositionV2Prompt,
  buildDecompositionV2Prompt,
  getDecompositionV2PromptBuilder,
  getDecompositionV2PromptLabel,
} from '../decomposition-v2';
import type { PromptPersonalizationContext } from '../types';

const baseUserContext: PromptPersonalizationContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'medium',
    brothConsumption: 'some',
  },
};

describe('decomposition-v2 prompt', () => {
  it('compressed builder does NOT mention grams as a required field', () => {
    const out = buildCompressedDecompositionV2Prompt(baseUserContext);
    // Schema fields should list rawName, canonicalName, cookingMethod?, stateHint?, stateNote?, prepNotes?
    expect(out).toMatch(/rawName/);
    expect(out).toMatch(/canonicalName/);
    expect(out).toMatch(/stateHint/);
    expect(out).toMatch(/prepNotes/);
    // grams should NOT be in the schema_fields block
    expect(out).not.toMatch(/grams:\s/);
    expect(out).not.toMatch(/ingredients\[\]:\s*\{[^}]*grams/);
  });

  it('production builder includes modifier routing for all 5 categories', () => {
    const out = buildDecompositionV2Prompt(baseUserContext);
    expect(out).toMatch(/Quantity cues/);
    expect(out).toMatch(/Identity changes/);
    expect(out).toMatch(/Ingredient removal\/addition/);
    expect(out).toMatch(/Weight basis/);
    expect(out).toMatch(/Same-food density tweaks/);
  });

  it('production builder includes the cân sống → stateHint=raw_weight example', () => {
    const out = buildDecompositionV2Prompt(baseUserContext);
    expect(out).toMatch(/cân sống/);
    expect(out).toMatch(/raw_weight/);
  });

  it('production builder includes the bỏ da bỏ mỡ → prepNotes example', () => {
    const out = buildDecompositionV2Prompt(baseUserContext);
    expect(out).toMatch(/bỏ da/);
    expect(out).toMatch(/bỏ mỡ/);
  });

  it('user_context block carries country info only (cookingHabits moved to Call 2)', () => {
    const out = buildCompressedDecompositionV2Prompt(baseUserContext);
    expect(out).toMatch(/country_of_origin: Vietnam/);
    expect(out).toMatch(/country_of_residence: Vietnam/);
    // Portion / cooking-habit knobs are NOT load-bearing for decomposition
    // (Call 1 doesn't emit grams). They belong only in Call 2.
    expect(out).not.toMatch(/oil_usage/);
    expect(out).not.toMatch(/default_rice_portion/);
    expect(out).not.toMatch(/default_protein_portion/);
    expect(out).not.toMatch(/sugar_braised/);
    expect(out).not.toMatch(/broth_consumption/);
  });

  it('label resolution defaults to compressed; production opt-in via env', () => {
    expect(getDecompositionV2PromptLabel({})).toBe('compressed');
    expect(
      getDecompositionV2PromptLabel({
        PIPELINE_DECOMPOSITION_V2_PROMPT_LABEL: 'production',
      })
    ).toBe('production');
    expect(
      getDecompositionV2PromptLabel({
        PIPELINE_DECOMPOSITION_V2_PROMPT_LABEL: 'compressed',
      })
    ).toBe('compressed');
    expect(
      getDecompositionV2PromptLabel({
        PIPELINE_DECOMPOSITION_V2_PROMPT_LABEL: 'garbage',
      })
    ).toBe('compressed');
  });

  it('builder factory returns the matching builder', () => {
    expect(getDecompositionV2PromptBuilder('compressed')).toBe(
      buildCompressedDecompositionV2Prompt
    );
    expect(getDecompositionV2PromptBuilder('production')).toBe(
      buildDecompositionV2Prompt
    );
  });
});
