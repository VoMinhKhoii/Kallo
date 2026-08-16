import { describe, expect, it } from 'vitest';
import {
  buildCompressedDecompositionPrompt,
  buildDecompositionPrompt,
  getDecompositionPromptLabel,
} from '@/lib/ai/prompts/build/decomposition';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

const USER_CONTEXT: PromptPersonalizationContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  cookingHabits: {
    oilUsage: 'normal',
    sugarBraised: 'high',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

describe('buildDecompositionPrompt — quantity precedence rule', () => {
  it('renders the <quantity_precedence> block with multi-cuisine quantifier examples', () => {
    const prompt = buildDecompositionPrompt(USER_CONTEXT);
    expect(prompt).toContain('<quantity_precedence>');
    expect(prompt).toMatch(/Explicit quantifiers ALWAYS take precedence/i);
    expect(prompt).toMatch(/default_protein_portion are fallbacks/i);
    // Vietnamese count/unit examples should be present.
    expect(prompt).toContain('"3 ốp la"');
    expect(prompt).toContain('"8 cây nem lụi"');
    // English count/unit examples should be present.
    expect(prompt).toContain('"3 fried eggs"');
    expect(prompt).toContain('"5 oz steak"');
    // Modifier guidance should explicitly cover both languages.
    expect(prompt).toMatch(/"nhỏ"/);
    expect(prompt).toMatch(/"small"/);
  });

  it('keeps default portions in <user_context> but marks them as fallbacks', () => {
    const prompt = buildDecompositionPrompt(USER_CONTEXT);
    expect(prompt).toContain('default_rice_portion');
    expect(prompt).toContain('default_protein_portion');
    expect(prompt).toMatch(/fallbacks?/);
  });
});

describe('buildCompressedDecompositionPrompt — quantity precedence rule', () => {
  it('embeds the precedence rule into <rules> for the compact variant', () => {
    const prompt = buildCompressedDecompositionPrompt(USER_CONTEXT);
    expect(prompt).toMatch(/Explicit quantifiers .*ALWAYS take precedence/i);
    expect(prompt).toMatch(/Default portions are fallbacks/i);
    // The compact variant intentionally skips few-shots, so we just verify the rule lands.
    expect(prompt).not.toMatch(/<example>/);
  });
});

describe('getDecompositionPromptLabel', () => {
  it('defaults to production', () => {
    expect(getDecompositionPromptLabel({})).toBe('production');
  });

  it('honors compressed override', () => {
    expect(
      getDecompositionPromptLabel({
        PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'compressed',
      })
    ).toBe('compressed');
  });

  it('falls back to production for unknown values', () => {
    expect(
      getDecompositionPromptLabel({
        PIPELINE_DECOMPOSITION_PROMPT_LABEL: 'unknown',
      })
    ).toBe('production');
  });
});
