import { describe, expect, it } from 'vitest';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
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
  // Built-in portion priors no longer pin grams (2026-10-12): a counted food
  // with a seeded prior goes to Call 2 with no resolved_grams anchor.
  it.each([
    ['bánh bao', 'Bánh bao nhân thịt', 2, 'bánh bao', 'hấp'],
    ['sườn dê', 'rice', 1, 'miếng', 'nướng'],
    ['cá', 'Unrelated selected nutrition row', 1, 'con', 'nướng'],
    ['trứng gà', 'Trứng gà', 3, 'quả', 'luộc'],
    ['cơm', 'Cơm trắng', 1, 'chén', null],
  ] as const)('gives "%s" × %s no gram anchor', (rawName, canonicalName, count, unitToken, method) => {
    const r = resolveIngredientPortion({
      ingredient: ing({ rawName, canonicalName, count, unitToken }),
      dishCookingMethod: method,
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('llm_range');
    expect(anchorGramsFromResolution(r)).toBeNull();
  });

  it('still anchors an explicit "200g cơm"', () => {
    const r = resolveIngredientPortion({
      ingredient: ing({
        rawName: 'cơm',
        canonicalName: 'Cơm trắng',
        explicitMass: { grams: 200, basis: 'unknown' },
      }),
      dishCookingMethod: null,
      inputLanguage: 'vi',
    });
    expect(r.provenance).toBe('explicit_user_mass');
    expect(anchorGramsFromResolution(r)).toBe(200);
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
          ingredient: ing({
            count: 2,
            unitToken: 'bánh bao',
            explicitMass: { grams: 300, basis: 'edible' },
          }),
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
    expect(anchors).toEqual([300, null]);
  });
});

describe('anchorGramsFromResolution', () => {
  it('returns mid for grounded provenances', () => {
    expect(
      anchorGramsFromResolution({
        grams: { low: 1, mid: 2, high: 3 },
        massBasis: 'edible',
        provenance: 'packaged_serving',
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
        provenance: 'explicit_user_mass',
        confidence: 'high',
        note: '',
      })
    ).toBeNull();
  });
});
