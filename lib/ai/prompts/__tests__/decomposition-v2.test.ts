import { describe, expect, it } from 'vitest';
import {
  buildCompressedDecompositionV2Prompt,
  buildDecompositionV2Prompt,
  getDecompositionV2PromptBuilder,
  getDecompositionV2PromptLabel,
} from '../decomposition-v2';

const baseUserContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'auto-detect' as const,
  outputLanguage: 'match_user_input' as const,
  cookingHabits: {
    oilUsage: 'moderate',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    sugarBraised: 'moderate',
    brothConsumption: 'occasional',
  },
} as const;

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

  it('user_context block reflects supplied cookingHabits', () => {
    const out = buildCompressedDecompositionV2Prompt(baseUserContext);
    expect(out).toMatch(/oil_usage: moderate/);
    expect(out).toMatch(/sugar_braised: moderate/);
    expect(out).toMatch(/broth_consumption: occasional/);
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
