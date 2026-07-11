import { describe, expect, it } from 'vitest';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '../../pipeline/schemas-v2';
import {
  buildGroundedEstimationPrompt,
  type MatchCandidate,
  type MealItemWithCandidates,
} from '../grounded-estimation';
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

function ing(
  args: Partial<DecomposedIngredientV2> = {}
): DecomposedIngredientV2 {
  return {
    rawName: 'ức gà',
    canonicalName: 'Ức gà',
    ...args,
  };
}

function candidate(args: Partial<MatchCandidate> = {}): MatchCandidate {
  return {
    id: 'c1',
    similarity: 0.85,
    dbName: 'Ức gà',
    dbState: 'raw',
    source: 'fao',
    per100gKcal: 120,
    per100gProteinG: 22.5,
    per100gCarbohydrateG: 0,
    per100gFatG: 2.6,
    inediblePct: null,
    ...args,
  };
}

function mealItemWithIng(
  candidates: MatchCandidate[],
  ingredient: DecomposedIngredientV2 = ing(),
  dish: Partial<DecomposedDishV2> = {}
): MealItemWithCandidates {
  return {
    mealItem: {
      name: dish.name ?? 'ức gà nướng',
      cookingMethod: dish.cookingMethod ?? 'nướng',
      ingredients: [ingredient],
    },
    ingredients: [{ ingredient, candidates }],
  };
}

describe('grounded-estimation prompt structure', () => {
  it('STATIC PREFIX comes before user_context which comes before ingredient_data', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'test prompt',
      mealItems: [mealItemWithIng([candidate()])],
      userContext: baseUserContext,
    });
    // The static prefix references some of these tag names in its rules,
    // so look for the actual standalone block markers (last occurrence is
    // the real block; earlier mentions are inline in the rules).
    const staticIdx = out.indexOf('<role>');
    const userCtxIdx = out.lastIndexOf('<user_context>');
    const originalPromptIdx = out.lastIndexOf('<original_prompt>');
    const ingDataIdx = out.lastIndexOf('<ingredient_data>');
    expect(staticIdx).toBeGreaterThanOrEqual(0);
    expect(userCtxIdx).toBeGreaterThan(staticIdx);
    expect(originalPromptIdx).toBeGreaterThan(userCtxIdx);
    expect(ingDataIdx).toBeGreaterThan(originalPromptIdx);
  });

  it('static prefix is byte-identical across requests with different ingredient data (cache prefix invariant)', () => {
    const a = buildGroundedEstimationPrompt({
      originalPrompt: '100g cơm',
      mealItems: [mealItemWithIng([candidate()])],
      userContext: baseUserContext,
    });
    const b = buildGroundedEstimationPrompt({
      originalPrompt: '1 đùi gà nướng',
      mealItems: [
        mealItemWithIng(
          [candidate({ id: 'c1', dbName: 'Đùi gà', dbState: 'cooked' })],
          ing({ rawName: 'đùi gà', canonicalName: 'Đùi gà' }),
          { name: 'đùi gà nướng', cookingMethod: 'nướng' }
        ),
      ],
      userContext: baseUserContext,
    });
    // Cut both at the first <user_context> tag — everything before must match.
    const prefixA = a.slice(0, a.indexOf('<user_context>'));
    const prefixB = b.slice(0, b.indexOf('<user_context>'));
    expect(prefixA).toBe(prefixB);
    expect(prefixA.length).toBeGreaterThan(2000); // clears Vertex implicit-cache min
  });

  it('renders multiple candidates with stable ids and DB facts', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'ức gà',
      mealItems: [
        mealItemWithIng([
          candidate({
            id: 'c1',
            similarity: 0.82,
            dbName: 'Thịt gà ta',
            inediblePct: 52,
          }),
          candidate({
            id: 'c2',
            similarity: 0.78,
            dbName: 'Chicken, breast, meat only, raw',
            source: 'usda',
          }),
        ]),
      ],
      userContext: baseUserContext,
    });
    expect(out).toMatch(/id="c1"/);
    expect(out).toMatch(/id="c2"/);
    expect(out).toMatch(/db_name="Thịt gà ta"/);
    expect(out).toMatch(/db_inedible_pct="52"/);
    expect(out).toMatch(/source="usda"/);
  });

  it('omits state_hint attribute when stateHint is "unspecified" or absent', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'cơm',
      mealItems: [
        mealItemWithIng([candidate()], ing({ stateHint: 'unspecified' })),
      ],
      userContext: baseUserContext,
    });
    // Static prefix mentions state_hint values in rule text; only check
    // the dynamic suffix (everything from <ingredient_data> onward).
    const ingDataStart = out.lastIndexOf('<ingredient_data>');
    expect(ingDataStart).toBeGreaterThan(0);
    const suffix = out.slice(ingDataStart);
    expect(suffix).not.toMatch(/state_hint=/);
  });

  it('emits state_hint and state_note when present', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: '300gr ức gà nấu chậm (cân sống)',
      mealItems: [
        mealItemWithIng(
          [candidate()],
          ing({ stateHint: 'raw_weight', stateNote: 'cân sống' })
        ),
      ],
      userContext: baseUserContext,
    });
    const suffix = out.slice(out.lastIndexOf('<ingredient_data>'));
    expect(suffix).toMatch(/state_hint="raw_weight"/);
    expect(suffix).toMatch(/state_note="cân sống"/);
  });

  it('emits prep_notes joined with " | "', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: '1 đùi gà nướng (bỏ da bỏ mỡ)',
      mealItems: [
        mealItemWithIng(
          [candidate({ dbName: 'Đùi gà', dbState: 'cooked' })],
          ing({
            rawName: 'đùi gà',
            canonicalName: 'Đùi gà',
            prepNotes: ['bỏ da', 'bỏ mỡ'],
          })
        ),
      ],
      userContext: baseUserContext,
    });
    const suffix = out.slice(out.lastIndexOf('<ingredient_data>'));
    expect(suffix).toMatch(/prep_notes="bỏ da \| bỏ mỡ"/);
  });

  it('skips prep_notes attribute when only whitespace entries', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: '1 đùi gà',
      mealItems: [
        mealItemWithIng([candidate()], ing({ prepNotes: ['   ', ''] })),
      ],
      userContext: baseUserContext,
    });
    expect(out).not.toMatch(/prep_notes=/);
  });

  it('renders unmatched ingredients with match_status="unmatched" and no candidates', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'nem lụi',
      mealItems: [
        mealItemWithIng(
          [],
          ing({ rawName: 'nem lụi', canonicalName: 'Nem lụi' })
        ),
      ],
      userContext: baseUserContext,
    });
    const suffix = out.slice(out.lastIndexOf('<ingredient_data>'));
    expect(suffix).toMatch(/match_status="unmatched"/);
    expect(suffix).not.toMatch(/<candidate /);
  });

  it('escapes XML-unsafe attribute values', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'meal & test < > "quoted"',
      mealItems: [
        mealItemWithIng(
          [candidate()],
          ing({ rawName: 'name with "quotes" & <stuff>', canonicalName: 'X' })
        ),
      ],
      userContext: baseUserContext,
    });
    expect(out).toMatch(/&amp;/);
    expect(out).toMatch(/&quot;/);
    expect(out).toMatch(/&lt;/);
    expect(out).toMatch(/&gt;/);
  });
});
