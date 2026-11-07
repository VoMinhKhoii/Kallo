import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import {
  dishPieceCount,
  type MatchCandidate,
  type MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import { buildGroundedEstimationPrompt } from '@/lib/ai/prompts/build/grounded-estimation';
import {
  buildStaticPrefix,
  CALIBRATION_RULE,
  DISH_SIZING_RULE,
  SHARE_RULE,
} from '@/lib/ai/prompts/text/grounded-estimation';
import type { PromptPersonalizationContext } from '@/lib/ai/prompts/types';

const baseUserContext: PromptPersonalizationContext = {
  countryOfOrigin: 'Vietnam',
  countryOfResidence: 'Vietnam',
  inputLanguage: 'vi',
  outputLanguage: 'vi',
  cookingHabits: {
    oilUsage: 'normal',
    defaultRicePortion: 'medium',
    defaultProteinPortion: 'medium',
    brothConsumption: 'some',
  },
};

const FLAG_BASELINE = {
  VESSEL_GUARD: 'on',
} as const;
const originalFlags = new Map(
  Object.keys(FLAG_BASELINE).map((key) => [key, process.env[key]])
);

beforeEach(() => {
  for (const [key, value] of Object.entries(FLAG_BASELINE)) {
    process.env[key] = value;
  }
});

afterAll(() => {
  for (const [key, value] of originalFlags) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

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

function buildPrompt(
  originalPrompt: string,
  mealItems = [mealItemWithIng([candidate()])]
): string {
  return buildGroundedEstimationPrompt({
    originalPrompt,
    mealItems,
    userContext: baseUserContext,
  });
}

function withRestoredEnv(keys: string[], callback: () => void): void {
  const originals = new Map(keys.map((key) => [key, process.env[key]]));
  try {
    callback();
  } finally {
    for (const [key, value] of originals) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

describe('grounded-estimation prompt structure', () => {
  it("tells Call 2 the user's own bowl of rice, by country", () => {
    const prompt = (countryOfOrigin: string, outputLanguage: 'vi' | 'en') =>
      buildGroundedEstimationPrompt({
        originalPrompt: 'test prompt',
        mealItems: [mealItemWithIng([candidate()])],
        userContext: { ...baseUserContext, countryOfOrigin, outputLanguage },
      });
    expect(prompt('Vietnam', 'vi')).toContain(
      'rice_bowl_g: 120 (small 80, full 160)'
    );
    const korean = prompt('South Korea', 'en');
    expect(korean).toContain('rice_bowl_g: 210 (small 140, full 280)');
    // The global rule names no Vietnamese bowl words.
    expect(korean).toContain('Plain cooked rice by the bowl with no weight');
    expect(korean).not.toContain('lưng chén');
  });

  it('keeps the vessel-less extracted prefix byte-stable', () => {
    expect(buildStaticPrefix(false)).toMatchSnapshot();
  });

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
    // The closing share rule mentions <original_prompt> inline, so match the
    // block's own opening line.
    const originalPromptIdx = out.lastIndexOf('<original_prompt>\n');
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
    const out = buildPrompt('cơm', [
      mealItemWithIng([candidate()], ing({ stateHint: 'unspecified' })),
    ]);
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
    const out = buildPrompt('1 đùi gà', [
      mealItemWithIng([candidate()], ing({ prepNotes: ['   ', ''] })),
    ]);
    expect(out).not.toMatch(/prep_notes=/);
  });

  it('renders unmatched ingredients with match_status="unmatched" and no candidates', () => {
    const out = buildPrompt('nem lụi', [
      mealItemWithIng(
        [],
        ing({ rawName: 'nem lụi', canonicalName: 'Nem lụi' })
      ),
    ]);
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

  it('renders vessel envelope attributes and the vessel rule', () => {
    const mealItem = mealItemWithIng([candidate()]);
    mealItem.mealItem.vesselSize = 'medium';
    mealItem.vesselEnvelope = {
      family: 'bowl',
      tier: 2,
      dishClass: 'soup',
      token: 'tô',
      vesselMl: 700,
      guardG: { low: 470, high: 730 },
      midG: 595,
    };
    const out = buildPrompt('một tô phở', [mealItem]);
    expect(out).toContain(
      'vessel="tô" vessel_size="medium" vessel_ml="700" dish_class="soup" serve_total_guard_g="470-730"'
    );
    expect(out).toContain('<vessel_rule>');
  });

  it('omits the vessel rule when no envelope is present', () => {
    const out = buildPrompt('ức gà');
    expect(out).not.toContain('<vessel_rule>');
  });

  it('renders refuse fields and never the legacy deduction rule', () => {
    {
      const enabled = buildStaticPrefix();
      expect(enabled).toContain('grossG > 0 and integer refusePct');
      expect(enabled).toContain(
        'rib ≈ 40–60%; wing ≈ 30–50%; whole fish ≈ 35–50%'
      );
      expect(enabled).toContain(
        "db_inedible_pct, when present on a candidate, is that row's own"
      );
      expect(enabled).toContain(
        'Gross PORTION_PRIORS use basis-explicit labels'
      );
      expect(enabled).not.toContain(
        'Deduct ONCE — never both from `db_inedible_pct`'
      );
      expect(enabled).not.toContain('Always emit grams > 0');
      expect(enabled).toContain(
        'accept it and emit grossG in its basis per the grams_rule'
      );
    }
  });

  it('renders explicit mass basis attributes', () => {
    const mealItem = mealItemWithIng(
      [candidate()],
      ing({
        explicitMass: { grams: 200, basis: 'gross_as_served' },
      })
    );
    const enabled = buildPrompt('1 miếng sườn 200g', [mealItem]);
    expect(enabled).toContain('user_mass_g="200.0"');
    expect(enabled).toContain('mass_basis="gross_as_served"');
  });

  it('carries no built-in sizing hints or portion defaults', () => {
    const mealItem = mealItemWithIng(
      [candidate()],
      ing({ count: 2, unitToken: 'miếng' })
    );
    mealItem.ingredients[0].resolvedGramsAnchor = 180;
    const out = buildPrompt('2 miếng thịt ram với cơm', [mealItem]);
    expect(out).not.toContain('Use cuisine priors:');
    expect(out).not.toContain('phần protein áp chảo');
    expect(out).not.toContain('Staple carb base:');
    expect(out).not.toContain('When a protein has no count/unit/anchor');
    expect(out).not.toContain('default_rice_portion');
    expect(out).not.toContain('default_protein_portion');
    expect(out).toContain('  oil_usage: normal\n');
    expect(out).toContain('  broth_consumption: some\n');
    expect(out).toContain('BASIS RULE');
    expect(out).toContain('Absorbed cooking fat:');
    expect(out).toContain('resolved_grams="180.0"');
    expect(out).toContain('user_count="2" user_unit="miếng"');
  });

  it('ends with the share, calibration and dish-sizing rules, in that order', () => {
    const out = buildPrompt('nửa đĩa cơm tấm chia với bạn');
    expect(out.startsWith(buildStaticPrefix(false))).toBe(true);
    expect(
      out.endsWith(`${SHARE_RULE}${CALIBRATION_RULE}${DISH_SIZING_RULE}`)
    ).toBe(true);
    const share = out.indexOf('\n\n<share_rule>\n');
    const calibration = out.indexOf('\n\n<calibration>\n');
    const dish = out.indexOf('\n\n<dish_sizing>\n');
    expect(share).toBeGreaterThan(out.lastIndexOf('</ingredient_data>'));
    expect(share).toBeGreaterThan(out.indexOf('Ranking: when the user names'));
    expect(calibration).toBeGreaterThan(share);
    expect(dish).toBeGreaterThan(calibration);
    expect(out.endsWith('\n</dish_sizing>')).toBe(true);
  });

  it('toggles vessel guard prompt signals together at build time', () => {
    const mealItem = mealItemWithIng([candidate()]);
    mealItem.mealItem.vesselSize = 'medium';
    mealItem.vesselEnvelope = {
      family: 'bowl',
      tier: 2,
      dishClass: 'soup',
      token: 'tô',
      vesselMl: 700,
      guardG: { low: 470, high: 730 },
      midG: 595,
    };
    withRestoredEnv(['VESSEL_GUARD'], () => {
      process.env.VESSEL_GUARD = 'off';
      const disabled = buildPrompt('một tô phở', [mealItem]);
      expect(disabled).not.toContain('<vessel_rule>');
      expect(disabled).not.toContain('vessel_ml=');
      expect(disabled).not.toContain('serve_total_guard_g=');
      expect(disabled).toContain('vessel="tô"');

      process.env.VESSEL_GUARD = 'on';
      const enabled = buildPrompt('một tô phở', [mealItem]);
      expect(enabled).toContain('<vessel_rule>');
      expect(enabled).toContain('vessel_ml="700"');
      expect(enabled).toContain('serve_total_guard_g="470-730"');
    });
  });
});

describe('candidate db_name_en rendering (global locale)', () => {
  const enUserContext: PromptPersonalizationContext = {
    ...baseUserContext,
    countryOfOrigin: 'United States',
    countryOfResidence: 'United States',
    inputLanguage: 'en',
    outputLanguage: 'en',
  };
  const rollCandidate = candidate({
    dbName: 'Ức gà, cuộn, nướng lò',
    dbNameEn: 'Chicken breast, roll, oven-roasted',
  });

  it('vi locale renders NO db_name_en and no locale verdict note', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'ức gà nướng',
      mealItems: [mealItemWithIng([rollCandidate])],
      userContext: baseUserContext,
    });
    expect(out).not.toContain('db_name_en=');
    expect(out).not.toContain('SAME row’s English name'.normalize());
    expect(out).not.toContain('db_name_en (when present)');
  });

  it('global locale renders db_name_en beside db_name plus the verdict note', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'grilled chicken breast',
      mealItems: [mealItemWithIng([rollCandidate])],
      userContext: enUserContext,
    });
    expect(out).toContain(
      'db_name="Ức gà, cuộn, nướng lò" db_name_en="Chicken breast, roll, oven-roasted"'
    );
    expect(out).toContain('db_name_en (when present)');
  });

  it('global locale omits db_name_en when missing or identical to db_name', () => {
    const out = buildGroundedEstimationPrompt({
      originalPrompt: 'grilled chicken breast',
      mealItems: [
        mealItemWithIng([
          candidate({ dbName: 'Chicken broth', dbNameEn: 'Chicken broth' }),
        ]),
        mealItemWithIng([candidate({ dbNameEn: null })]),
      ],
      userContext: enUserContext,
    });
    expect(out).not.toContain('db_name_en=');
  });
});

describe('buildStaticPrefix locale blocks', () => {
  it('vi (default) keeps the VN density priors; global swaps them', () => {
    const vi = buildStaticPrefix(false);
    expect(vi).toContain('nem lụi ~250–290 kcal/100g');
    expect(vi).not.toContain('pizza slice');

    const global = buildStaticPrefix(false, 'global');
    expect(global).toContain('pizza slice ~250–300 kcal/100g');
    expect(global).not.toContain('nem lụi ~250–290');
    // Shared cap and refuse anchors stay in both variants.
    expect(global).toContain('under 900 kcal/100g');
    expect(global).toContain('rib ≈ 40–60%');
  });
});

describe('a piece count on the part a split dish is named after', () => {
  const dish = (
    name: string,
    parts: DecomposedIngredientV2[]
  ): MealItemWithCandidates => ({
    mealItem: { name, cookingMethod: 'deep-fried', ingredients: parts },
    ingredients: parts.map((ingredient) => ({
      ingredient,
      candidates: [candidate()],
    })),
  });
  const shrimp: DecomposedIngredientV2 = {
    rawName: 'tôm',
    canonicalName: 'Tôm',
    count: 1,
    unitToken: 'miếng',
  };
  const crumbs: DecomposedIngredientV2 = {
    rawName: 'bột chiên xù',
    canonicalName: 'Bột chiên xù',
  };

  it('moves "1 miếng" from the shrimp onto the shrimp cutlet', () => {
    const katsu = dish('Tôm tonkatsu', [shrimp, crumbs]);
    expect(dishPieceCount(katsu)).toMatchObject({ count: 1, unit: 'miếng' });
    const out = buildGroundedEstimationPrompt({
      originalPrompt: '1 miếng tôm tonkatsu',
      mealItems: [katsu],
      userContext: baseUserContext,
    });
    expect(out).toContain('dish_count="1" dish_unit="miếng"');
    expect(out).not.toContain('user_count="1"');
  });

  it('moves the count onto a hyphenated dish named from the part', () => {
    expect(
      dishPieceCount(
        dish('Shrimp-katsu', [
          {
            ...shrimp,
            rawName: 'shrimp',
            canonicalName: 'Shrimp',
            unitToken: 'piece',
          },
          crumbs,
        ])
      )
    ).toMatchObject({ count: 1 });
  });

  it('keeps a count of the food itself on the food', () => {
    // "5 con tôm" counts shrimp, not pieces of a dish.
    expect(
      dishPieceCount(
        dish('Tôm chiên', [{ ...shrimp, count: 5, unitToken: 'con' }, crumbs])
      )
    ).toBeNull();
    // A one-ingredient dish has nothing to share the count with.
    expect(dishPieceCount(dish('Tôm tonkatsu', [shrimp]))).toBeNull();
    // A part the dish is not named after keeps its own count.
    expect(
      dishPieceCount(
        dish('Cơm gà', [
          { ...shrimp, rawName: 'trứng', canonicalName: 'Trứng' },
          crumbs,
        ])
      )
    ).toBeNull();
    // A dish that only contains the counted part ("2 miếng gà" in "Cơm gà")
    // is one plate with two pieces of chicken, not two plates.
    expect(
      dishPieceCount(
        dish('Cơm gà', [
          { ...shrimp, rawName: 'gà', canonicalName: 'Gà', count: 2 },
          { rawName: 'cơm', canonicalName: 'Cơm' },
        ])
      )
    ).toBeNull();
    // Named from the part as a whole word only: "hamburger" is not "ham …".
    expect(
      dishPieceCount(
        dish('Hamburger', [
          {
            ...shrimp,
            rawName: 'ham',
            canonicalName: 'Ham',
            count: 2,
            unitToken: 'slices',
          },
          { rawName: 'bun', canonicalName: 'Bun' },
        ])
      )
    ).toBeNull();
  });
});
