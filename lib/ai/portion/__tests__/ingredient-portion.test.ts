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
        explicitMass: { grams: 250, basis: 'edible' },
        stateHint: 'raw_weight',
      }),
      dishCookingMethod: 'nướng',
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('explicit_user_mass');
    expect(r.grams?.mid).toBe(250);
  });

  it.each([
    'sườn dê',
    'suon de',
  ])('anchors a goat rib piece from %s independently of the nutrition row', (rawName) => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName,
        canonicalName: 'rice',
        count: 1,
        unitToken: 'miếng',
      }),
      dishCookingMethod: 'nướng',
      inputLanguage: 'vi',
    });
    expect(r).toMatchObject({
      grams: { low: 70, mid: 85, high: 100 },
      massBasis: 'gross_as_served',
      provenance: 'retrieved_prior',
    });
  });

  it('recomposes a split whole-fish count into a scoped concept anchor', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName: 'cá',
        canonicalName: 'Unrelated selected nutrition row',
        count: 1,
        unitToken: 'con',
      }),
      dishCookingMethod: 'nướng',
      inputLanguage: 'vi',
    });
    expect(r).toMatchObject({
      grams: { low: 250, mid: 325, high: 400 },
      massBasis: 'gross_as_served',
      provenance: 'retrieved_prior',
    });
  });

  it('treats a generic boiled chicken egg as peeled before eating', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName: 'trứng gà',
        canonicalName: 'Trứng gà',
        count: 3,
        unitToken: 'quả',
      }),
      dishCookingMethod: 'luộc',
      inputLanguage: 'vi',
    });
    expect(r).toMatchObject({
      grams: { low: 135, mid: 150, high: 165 },
      massBasis: 'edible',
      provenance: 'retrieved_prior',
    });
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
        massBasis: 'edible',
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
        massBasis: null,
        provenance: 'llm_range',
        confidence: 'none',
        note: '',
      })
    ).toBeNull();
    expect(
      anchorGramsFromResolution({
        grams: null,
        massBasis: null,
        provenance: 'unresolved',
        confidence: 'none',
        note: '',
      })
    ).toBeNull();
  });

  it('withholds a gross anchor from the edible resolved_grams prompt seam', () => {
    expect(
      anchorGramsFromResolution({
        grams: { low: 70, mid: 85, high: 100 },
        massBasis: 'gross_as_served',
        provenance: 'retrieved_prior',
        confidence: 'high',
        note: '',
      })
    ).toBeNull();
  });
});
