import { describe, expect, it } from 'vitest';
import type { DecomposedIngredientV2 } from '../../pipeline/schemas-v2';
import {
  anchorGramsFromResolution,
  resolveIngredientPortion,
  resolvePortionsForCallTwo,
} from '../ingredient-portion';

const ing = (
  over: Partial<DecomposedIngredientV2> = {}
): DecomposedIngredientV2 => ({
  rawName: 'bánh bao',
  canonicalName: 'Bánh bao nhân thịt',
  ...over,
});

describe('resolveIngredientPortion — adapter', () => {
  it('resolves a count-based VN staple via its prior', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({ count: 2, unitToken: 'bánh bao' }),
      dishCookingMethod: 'hấp',
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('retrieved_prior');
    expect(r.grams?.mid).toBe(330);
  });

  it('routes an ambiguous surface form to clarify', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName: 'bun',
        canonicalName: 'bun',
        count: 1,
        unitToken: 'piece',
      }),
      dishCookingMethod: null,
      inputLanguage: 'en',
    });
    expect(r.provenance).toBe('unresolved');
    expect(r.unresolvedReason).toBe('ambiguous_food');
  });

  it('honors explicit raw mass from the ingredient', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName: 'ức gà',
        canonicalName: 'Ức gà',
        explicitMass: { grams: 250, basis: 'raw' },
        stateHint: 'raw_weight',
      }),
      dishCookingMethod: 'nướng',
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('explicit_user_mass');
    expect(r.grams?.mid).toBe(250);
  });

  it('unknown food + no explicit mass → defers to Call 2 (llm_range)', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({ rawName: 'nước dùng', canonicalName: 'nước dùng' }),
      dishCookingMethod: 'ninh',
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('llm_range');
    expect(r.grams).toBeNull();
  });
});

describe('resolvePortionsForCallTwo — orchestrator seam', () => {
  it('returns resolutions + anchors aligned to input order', () => {
    const { resolutions, anchors } = resolvePortionsForCallTwo(
      [
        {
          ingredient: ing({ count: 2, unitToken: 'bánh bao' }),
          dishCookingMethod: 'hấp',
        },
        {
          ingredient: ing({ rawName: 'nước dùng', canonicalName: 'nước dùng' }),
          dishCookingMethod: 'ninh',
        },
      ],
      'vi'
    );
    expect(resolutions).toHaveLength(2);
    expect(anchors).toEqual([330, null]);
  });
});

describe('anchorGramsFromResolution', () => {
  it('returns mid for grounded provenances', () => {
    expect(
      anchorGramsFromResolution({
        grams: { low: 1, mid: 2, high: 3 },
        provenance: 'retrieved_prior',
        confidence: 'high',
        note: '',
      })
    ).toBe(2);
  });

  it('returns null for llm_range and unresolved', () => {
    expect(
      anchorGramsFromResolution({
        grams: null,
        provenance: 'llm_range',
        confidence: 'none',
        note: '',
      })
    ).toBeNull();
    expect(
      anchorGramsFromResolution({
        grams: null,
        provenance: 'unresolved',
        confidence: 'none',
        note: '',
      })
    ).toBeNull();
  });
});
