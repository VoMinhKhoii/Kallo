import { describe, expect, it } from 'vitest';
import type {
  DecomposedDishV2,
  DecomposedIngredientV2,
} from '../../pipeline/schemas-v2';
import { PORTION_PRIORS } from '../../portion/priors';
import {
  buildGroundedEstimationPrompt,
  type MatchCandidate,
  type MealItemWithCandidates,
} from '../grounded-estimation';
import {
  buildStaticPrefix,
  renderPriorLines,
} from '../grounded-estimation-rules';
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

  it('toggles both protein-default prompt signals together at build time', () => {
    withRestoredEnv(['PROTEIN_PORTION_DEFAULT'], () => {
      process.env.PROTEIN_PORTION_DEFAULT = 'off';
      const disabled = buildPrompt('thịt ram');
      expect(disabled).not.toContain('default_protein_portion:');
      expect(disabled).not.toContain('When a protein has no count/unit/anchor');

      process.env.PROTEIN_PORTION_DEFAULT = 'on';
      const enabled = buildPrompt('thịt ram');
      expect(enabled).toContain('default_protein_portion:');
      expect(enabled).toContain('When a protein has no count/unit/anchor');
    });
  });

  it('toggles the inedible-portion rule independently at build time', () => {
    withRestoredEnv(['INEDIBLE_PORTION_RULE'], () => {
      process.env.INEDIBLE_PORTION_RULE = 'off';
      expect(buildStaticPrefix()).not.toContain(
        'Every DB per-100 g row is for EDIBLE FLESH'
      );

      process.env.INEDIBLE_PORTION_RULE = 'on';
      const enabled = buildStaticPrefix();
      expect(enabled).toContain('Every DB per-100 g row is for EDIBLE FLESH');
      expect(enabled).toContain(
        'Deduct ONCE — never both from `db_inedible_pct` and from your own estimate.'
      );
    });
  });

  it('renders refuse fields and excludes the legacy deduction rule when enabled', () => {
    withRestoredEnv(['REFUSE_PCT_SCHEMA', 'INEDIBLE_PORTION_RULE'], () => {
      process.env.REFUSE_PCT_SCHEMA = 'on';
      process.env.INEDIBLE_PORTION_RULE = 'on';
      const enabled = buildStaticPrefix();
      expect(enabled).toContain('grossG > 0 and integer refusePct');
      expect(enabled).toContain(
        'rib ≈ 40–60%; wing ≈ 30–50%; whole fish ≈ 35–50%'
      );
      expect(enabled).toContain(
        'db_inedible_pct, when present on a candidate, is the DB'
      );
      expect(enabled).toContain(
        'Gross PORTION_PRIORS use basis-explicit labels'
      );
      expect(enabled).not.toContain(
        'Deduct ONCE — never both from `db_inedible_pct`'
      );
      expect(enabled).not.toContain('Always emit grams > 0');
    });
  });

  it('renders explicit mass basis only behind REFUSE_PCT_SCHEMA', () => {
    withRestoredEnv(['REFUSE_PCT_SCHEMA'], () => {
      const mealItem = mealItemWithIng(
        [candidate()],
        ing({
          explicitMass: { grams: 200, basis: 'gross_as_served' },
        })
      );

      process.env.REFUSE_PCT_SCHEMA = 'off';
      const disabled = buildPrompt('1 miếng sườn 200g', [mealItem]);
      expect(disabled).not.toContain('user_mass_g=');
      expect(disabled).not.toContain('mass_basis=');

      process.env.REFUSE_PCT_SCHEMA = 'on';
      const enabled = buildPrompt('1 miếng sườn 200g', [mealItem]);
      expect(enabled).toContain('user_mass_g="200.0"');
      expect(enabled).toContain('mass_basis="gross_as_served"');
    });
  });

  it('toggles all sizing-hint prompt signals together at build time', () => {
    withRestoredEnv(['PROMPT_SIZING_HINTS', 'PROTEIN_PORTION_DEFAULT'], () => {
      process.env.PROMPT_SIZING_HINTS = 'off';
      process.env.PROTEIN_PORTION_DEFAULT = 'on';
      const mealItem = mealItemWithIng(
        [candidate()],
        ing({ count: 2, unitToken: 'miếng' })
      );
      mealItem.ingredients[0].resolvedGramsAnchor = 180;
      const disabled = buildPrompt('2 miếng thịt ram với cơm', [mealItem]);
      expect(disabled).not.toContain('Use cuisine priors:');
      expect(disabled).not.toContain('phần protein áp chảo');
      expect(disabled).not.toContain('Staple carb base:');
      expect(disabled).not.toContain('default_rice_portion:');
      expect(disabled).not.toContain('default_protein_portion:');
      expect(disabled).not.toContain('When a protein has no count/unit/anchor');
      expect(disabled).toContain('BASIS RULE');
      expect(disabled).toContain('Absorbed cooking fat:');
      expect(disabled).toContain('broth_consumption:');
      expect(disabled).toContain('sugar_braised:');
      expect(disabled).toContain('resolved_grams="180.0"');
      expect(disabled).toContain('user_count="2" user_unit="miếng"');

      process.env.PROMPT_SIZING_HINTS = 'on';
      const enabled = buildPrompt('thịt ram với cơm');
      expect(enabled).toContain('Use cuisine priors:');
      expect(enabled).toContain('Staple carb base:');
      expect(enabled).toContain('default_rice_portion:');
      expect(enabled).toContain('default_protein_portion:');
    });
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

describe('renderPriorLines', () => {
  it('contains one rendered line for every portion prior', () => {
    withRestoredEnv(['REFUSE_PCT_SCHEMA'], () => {
      process.env.REFUSE_PCT_SCHEMA = 'on';
      const lines = renderPriorLines().split('\n');
      expect(lines).toHaveLength(PORTION_PRIORS.length);
      for (const prior of PORTION_PRIORS) {
        expect(
          lines.some((line) =>
            line.includes(
              `≈ ${prior.perUnit.mid}g (${prior.perUnit.low}–${prior.perUnit.high}g)`
            )
          )
        ).toBe(true);
      }
    });
  });

  it('renders a unique label for every portion prior', () => {
    const labels = renderPriorLines()
      .split('\n')
      .map((line) => line.match(/- 1 (.+) ≈/)?.[1]);

    expect(labels).not.toContain(undefined);
    expect(new Set(labels).size).toBe(labels.length);
    expect(labels).toContain('lát bánh mì');
    expect(labels).toContain('ổ bánh mì');
  });
});
