# Nutrition Page Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a dedicated `/nutrition` page that shows long-term macro and micronutrient dietary patterns with target sources, confidence labels, lazy trends, and curated food-source candidates.

**Architecture:** Add a focused `lib/nutrition/` domain for reference targets, confidence math, summary bucketing, candidate lookup, and server actions. Add client UI under `components/nutrition/` that fetches aggregate overview data first, then lazy-loads per-nutrient trend/candidate data on interaction. Keep the page distinct from `/dashboard`: dashboard tracks goal execution; nutrition analyzes dietary patterns.

**Tech Stack:** Next.js App Router, React 19, TanStack Query, Drizzle ORM, PostgreSQL/Supabase, next-intl, Recharts, lucide-react, sonner, Vitest, Testing Library, Biome

**Spec:** `docs/superpowers/specs/2026-04-25-nutrition-page-design.md`

---

## Chunk 1: Worktree, Metadata, and Reference Targets

### Task 1.0: Create implementation worktree

**Files:** None

- [ ] **Step 1: Create a dedicated worktree from the approved spec branch**

```bash
cd /Users/khoivo/Documents/kallo-nutrition-page
git worktree add ../kallo-nutrition-page-impl -b feat/nutrition-page-implementation feat/nutrition-page
cd ../kallo-nutrition-page-impl
git --no-pager status --short
git --no-pager branch --show-current
```

Expected: new worktree at `/Users/khoivo/Documents/kallo-nutrition-page-impl`, clean status, branch `feat/nutrition-page-implementation`.

- [ ] **Step 2: Install dependencies if needed**

```bash
bun install
```

Expected: dependencies are available in the implementation worktree.

- [ ] **Step 3: Review relevant rules before coding**

Use these skills before any React/Next implementation work:

- `@vercel-react-best-practices`
- `@web-design-guidelines` before UI work in Chunk 3

Expected: implementation follows App Router, TanStack Query, i18n, and accessibility patterns.

---

### Task 1.1: Add nutrition domain types and nutrient metadata

**Files:**
- Create: `lib/nutrition/types.ts`
- Create: `lib/nutrition/nutrients.ts`
- Test: `lib/nutrition/nutrients.test.ts`

- [ ] **Step 1: Write failing metadata tests**

Create `lib/nutrition/nutrients.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  DEFAULT_NUTRIENTS,
  HIDDEN_NUTRIENTS,
  SUPPORTED_CANDIDATE_NUTRIENTS,
  getNutrientMeta,
} from './nutrients';

describe('nutrition nutrient metadata', () => {
  it('keeps biotin hidden', () => {
    expect(HIDDEN_NUTRIENTS).toContain('vitaminHMcg');
    expect(DEFAULT_NUTRIENTS).not.toContain('vitaminHMcg');
  });

  it('includes the approved default scored nutrients', () => {
    expect(DEFAULT_NUTRIENTS).toEqual([
      'calciumMg',
      'ironMg',
      'vitaminCMg',
      'phosphorusMg',
      'vitaminB1Mg',
      'vitaminB2Mg',
      'vitaminPpMg',
      'vitaminAMcg',
    ]);
  });

  it('marks candidate-supported nutrients as default scored nutrients', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      expect(DEFAULT_NUTRIENTS).toContain(nutrient);
    }
  });

  it('defines units and message keys for default nutrients', () => {
    for (const nutrient of DEFAULT_NUTRIENTS) {
      const meta = getNutrientMeta(nutrient);
      expect(meta.labelKey).toMatch(/^nutrition\\.nutrients\\./);
      expect(meta.unit).toBeTruthy();
      expect(['mineral', 'vitamin', 'other']).toContain(meta.group);
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test lib/nutrition/nutrients.test.ts
```

Expected: FAIL because `lib/nutrition/nutrients.ts` does not exist.

- [ ] **Step 3: Create `lib/nutrition/types.ts`**

```ts
export type NutritionRange = '7d' | '30d' | '90d';
export type NutritionRangeInput = 'auto' | NutritionRange;
export type BucketTimezone = 'local' | 'utc';
export type TargetSource = 'vietnam_rda' | 'who_fao' | 'unsupported';
export type NutrientGroup = 'mineral' | 'vitamin' | 'other';
export type ConfidenceDisplayState =
  | 'normal'
  | 'limited_data'
  | 'warning_points'
  | 'insufficient_data';
export type NutritionStatus =
  | 'below_target'
  | 'adequate'
  | 'above_target'
  | 'limited_data';

export type NutritionNutrientKey =
  | 'fiberG'
  | 'sodiumMg'
  | 'calciumMg'
  | 'ironMg'
  | 'magnesiumMg'
  | 'phosphorusMg'
  | 'potassiumMg'
  | 'zincMg'
  | 'copperMcg'
  | 'manganeseMg'
  | 'betaCaroteneMcg'
  | 'vitaminAMcg'
  | 'vitaminDMcg'
  | 'vitaminEMg'
  | 'vitaminKMcg'
  | 'vitaminCMg'
  | 'vitaminB1Mg'
  | 'vitaminB2Mg'
  | 'vitaminPpMg'
  | 'vitaminB5Mg'
  | 'vitaminB6Mg'
  | 'vitaminB9Mcg'
  | 'vitaminB12Mcg'
  | 'vitaminHMcg';

export type MacroKey = 'calories' | 'protein' | 'carbohydrate' | 'fat';

export interface NutrientMeta {
  key: NutritionNutrientKey;
  dbColumn: string;
  labelKey: string;
  unit: 'g' | 'mg' | 'mcg' | 'kcal';
  group: NutrientGroup;
}

export interface NutrientSummaryItem {
  nutrient: NutritionNutrientKey;
  labelKey: string;
  average: number;
  unit: string;
  percentOfTarget: number | null;
  confidence: number;
  status: NutritionStatus;
  applicability?: 'scored' | 'educational' | 'hidden' | 'unsupported';
}

export interface MacroConsistencySummary {
  averageConsistencyPct: number;
  weakestMacro: MacroKey | null;
}

export interface MacroPattern {
  key: MacroKey | 'fiber';
  labelKey: string;
  averagePerDay: number;
  target: number | null;
  unit: string;
  consistencyPct: number | null;
}

export interface NutrientCardData {
  nutrient: NutritionNutrientKey;
  labelKey: string;
  group: NutrientGroup;
  averagePerDay: number | null;
  target: number | null;
  targetSource: TargetSource;
  targetSourceLabelKey: string;
  unit: string;
  percentOfTarget: number | null;
  confidence: number;
  displayState: ConfidenceDisplayState;
  caveatKey?: string;
  contextMetrics?: {
    key: NutritionNutrientKey;
    labelKey: string;
    averagePerDay: number | null;
    unit: string;
  }[];
  sourceBreakdown?: {
    faoVietnamCalorieShare: number;
    faoVietnamConfidence: number | null;
    missingSodiumCondimentItems?: number;
  };
  supportsCandidates: boolean;
}

export interface EducationCardData {
  id: 'vitamin_d';
  titleKey: string;
  bodyKey: string;
}

export interface NutritionOverview {
  requestedRange: NutritionRangeInput;
  resolvedRange: NutritionRange;
  bucketTimezone: BucketTimezone;
  loggedDays: number;
  loggedDaysLast30: number;
  trendStatus: 'ready' | 'too_few_logged_days';
  period: { startDate: string; endDate: string };
  summary: {
    mostConsistent: NutrientSummaryItem[];
    needsAttention: NutrientSummaryItem[];
    limitedDataCount: number;
    macroConsistency: MacroConsistencySummary;
  };
  macros: MacroPattern[];
  micronutrients: NutrientCardData[];
  moreNutrients: NutrientCardData[];
  educationCards: EducationCardData[];
}

export interface NutrientTrend {
  nutrient: NutritionNutrientKey;
  range: NutritionRange;
  bucketTimezone: BucketTimezone;
  displayMode: 'line' | 'points' | 'insufficient_data';
  points: {
    date: string;
    value: number | null;
    confidence: number;
  }[];
}
```

- [ ] **Step 4: Create `lib/nutrition/nutrients.ts`**

```ts
import type { NutrientMeta, NutritionNutrientKey } from './types';

export const DEFAULT_NUTRIENTS = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const MORE_NUTRIENTS = [
  'sodiumMg',
  'magnesiumMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'vitaminB12Mcg',
  'vitaminB9Mcg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminEMg',
  'vitaminKMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const HIDDEN_NUTRIENTS = [
  'vitaminHMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const EDUCATION_NUTRIENTS = [
  'vitaminDMcg',
] as const satisfies readonly NutritionNutrientKey[];

export const SUPPORTED_CANDIDATE_NUTRIENTS = [
  'calciumMg',
  'ironMg',
  'vitaminCMg',
  'phosphorusMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminAMcg',
] as const;

export type DefaultNutrientKey = (typeof DEFAULT_NUTRIENTS)[number];
export type SupportedCandidateNutrient =
  (typeof SUPPORTED_CANDIDATE_NUTRIENTS)[number];

export const NUTRIENT_META: Record<NutritionNutrientKey, NutrientMeta> = {
  fiberG: {
    key: 'fiberG',
    dbColumn: 'fiber_g',
    labelKey: 'nutrition.nutrients.fiber',
    unit: 'g',
    group: 'other',
  },
  sodiumMg: {
    key: 'sodiumMg',
    dbColumn: 'sodium_mg',
    labelKey: 'nutrition.nutrients.sodium',
    unit: 'mg',
    group: 'mineral',
  },
  calciumMg: {
    key: 'calciumMg',
    dbColumn: 'calcium_mg',
    labelKey: 'nutrition.nutrients.calcium',
    unit: 'mg',
    group: 'mineral',
  },
  ironMg: {
    key: 'ironMg',
    dbColumn: 'iron_mg',
    labelKey: 'nutrition.nutrients.iron',
    unit: 'mg',
    group: 'mineral',
  },
  magnesiumMg: {
    key: 'magnesiumMg',
    dbColumn: 'magnesium_mg',
    labelKey: 'nutrition.nutrients.magnesium',
    unit: 'mg',
    group: 'mineral',
  },
  phosphorusMg: {
    key: 'phosphorusMg',
    dbColumn: 'phosphorus_mg',
    labelKey: 'nutrition.nutrients.phosphorus',
    unit: 'mg',
    group: 'mineral',
  },
  potassiumMg: {
    key: 'potassiumMg',
    dbColumn: 'potassium_mg',
    labelKey: 'nutrition.nutrients.potassium',
    unit: 'mg',
    group: 'mineral',
  },
  zincMg: {
    key: 'zincMg',
    dbColumn: 'zinc_mg',
    labelKey: 'nutrition.nutrients.zinc',
    unit: 'mg',
    group: 'mineral',
  },
  copperMcg: {
    key: 'copperMcg',
    dbColumn: 'copper_mcg',
    labelKey: 'nutrition.nutrients.copper',
    unit: 'mcg',
    group: 'mineral',
  },
  manganeseMg: {
    key: 'manganeseMg',
    dbColumn: 'manganese_mg',
    labelKey: 'nutrition.nutrients.manganese',
    unit: 'mg',
    group: 'mineral',
  },
  betaCaroteneMcg: {
    key: 'betaCaroteneMcg',
    dbColumn: 'beta_carotene_mcg',
    labelKey: 'nutrition.nutrients.betaCarotene',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminAMcg: {
    key: 'vitaminAMcg',
    dbColumn: 'vitamin_a_mcg',
    labelKey: 'nutrition.nutrients.vitaminA',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminDMcg: {
    key: 'vitaminDMcg',
    dbColumn: 'vitamin_d_mcg',
    labelKey: 'nutrition.nutrients.vitaminD',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminEMg: {
    key: 'vitaminEMg',
    dbColumn: 'vitamin_e_mg',
    labelKey: 'nutrition.nutrients.vitaminE',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminKMcg: {
    key: 'vitaminKMcg',
    dbColumn: 'vitamin_k_mcg',
    labelKey: 'nutrition.nutrients.vitaminK',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminCMg: {
    key: 'vitaminCMg',
    dbColumn: 'vitamin_c_mg',
    labelKey: 'nutrition.nutrients.vitaminC',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB1Mg: {
    key: 'vitaminB1Mg',
    dbColumn: 'vitamin_b1_mg',
    labelKey: 'nutrition.nutrients.vitaminB1',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB2Mg: {
    key: 'vitaminB2Mg',
    dbColumn: 'vitamin_b2_mg',
    labelKey: 'nutrition.nutrients.vitaminB2',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminPpMg: {
    key: 'vitaminPpMg',
    dbColumn: 'vitamin_pp_mg',
    labelKey: 'nutrition.nutrients.vitaminPp',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB5Mg: {
    key: 'vitaminB5Mg',
    dbColumn: 'vitamin_b5_mg',
    labelKey: 'nutrition.nutrients.vitaminB5',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB6Mg: {
    key: 'vitaminB6Mg',
    dbColumn: 'vitamin_b6_mg',
    labelKey: 'nutrition.nutrients.vitaminB6',
    unit: 'mg',
    group: 'vitamin',
  },
  vitaminB9Mcg: {
    key: 'vitaminB9Mcg',
    dbColumn: 'vitamin_b9_mcg',
    labelKey: 'nutrition.nutrients.vitaminB9',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminB12Mcg: {
    key: 'vitaminB12Mcg',
    dbColumn: 'vitamin_b12_mcg',
    labelKey: 'nutrition.nutrients.vitaminB12',
    unit: 'mcg',
    group: 'vitamin',
  },
  vitaminHMcg: {
    key: 'vitaminHMcg',
    dbColumn: 'vitamin_h_mcg',
    labelKey: 'nutrition.nutrients.vitaminH',
    unit: 'mcg',
    group: 'vitamin',
  },
};

export function getNutrientMeta(key: NutritionNutrientKey): NutrientMeta {
  return NUTRIENT_META[key];
}
```

- [ ] **Step 5: Run metadata tests**

```bash
bun run test lib/nutrition/nutrients.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit foundation types**

```bash
git add lib/nutrition/types.ts lib/nutrition/nutrients.ts lib/nutrition/nutrients.test.ts
git commit -m "feat: add nutrition nutrient metadata" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 1.2: Add reference target resolver

**Files:**
- Create: `lib/nutrition/reference-targets.ts`
- Test: `lib/nutrition/reference-targets.test.ts`

- [ ] **Step 1: Write failing target resolver tests**

Create `lib/nutrition/reference-targets.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test lib/nutrition/reference-targets.test.ts
```

Expected: FAIL because `reference-targets.ts` does not exist.

- [ ] **Step 3: Implement target resolver**

Create `lib/nutrition/reference-targets.ts`:

```ts
import type { NutritionNutrientKey, TargetSource } from './types';
import { NUTRIENT_META } from './nutrients';

type BiologicalSex = 'male' | 'female';

interface NutritionProfileForTargets {
  biologicalSex: string | null;
  age: number | null;
  countryOfOrigin: string | null;
  countryOfResidence: string | null;
}

export interface MicronutrientTarget {
  key: NutritionNutrientKey;
  value: number | null;
  unit: 'mg' | 'mcg';
  source: TargetSource;
  sourceLabelKey: string;
  applicability: 'scored' | 'educational' | 'hidden' | 'unsupported';
}

export interface ReferenceSource {
  id: Exclude<TargetSource, 'unsupported'>;
  label: string;
  labelKey: string;
  citation: string;
  version: string;
}

export const REFERENCE_SOURCES: Record<
  Exclude<TargetSource, 'unsupported'>,
  ReferenceSource
> = {
  vietnam_rda: {
    id: 'vietnam_rda',
    label: 'Vietnam RDA',
    labelKey: 'nutrition.targetSources.vietnamRda',
    citation: 'Vietnam Ministry of Health recommended dietary allowances, 2016',
    version: '2016',
  },
  who_fao: {
    id: 'who_fao',
    label: 'WHO/FAO',
    labelKey: 'nutrition.targetSources.whoFao',
    citation:
      'WHO/FAO Vitamin and Mineral Requirements in Human Nutrition, 2nd edition',
    version: '2004',
  },
};

type TargetRow = Record<
  BiologicalSex,
  {
    value: number;
    unit: 'mg' | 'mcg';
  }
>;

const VIETNAM_RDA: Partial<Record<NutritionNutrientKey, TargetRow>> = {
  calciumMg: {
    male: { value: 1000, unit: 'mg' },
    female: { value: 1000, unit: 'mg' },
  },
  ironMg: {
    male: { value: 10, unit: 'mg' },
    female: { value: 24, unit: 'mg' },
  },
  phosphorusMg: {
    male: { value: 700, unit: 'mg' },
    female: { value: 700, unit: 'mg' },
  },
  vitaminAMcg: {
    male: { value: 850, unit: 'mcg' },
    female: { value: 700, unit: 'mcg' },
  },
  vitaminCMg: {
    male: { value: 70, unit: 'mg' },
    female: { value: 70, unit: 'mg' },
  },
  vitaminB1Mg: {
    male: { value: 1.4, unit: 'mg' },
    female: { value: 1.1, unit: 'mg' },
  },
  vitaminB2Mg: {
    male: { value: 1.4, unit: 'mg' },
    female: { value: 1.1, unit: 'mg' },
  },
  vitaminPpMg: {
    male: { value: 16, unit: 'mg' },
    female: { value: 14, unit: 'mg' },
  },
};

const WHO_FAO: Partial<Record<NutritionNutrientKey, TargetRow>> = {
  calciumMg: {
    male: { value: 1000, unit: 'mg' },
    female: { value: 1000, unit: 'mg' },
  },
  ironMg: {
    male: { value: 9, unit: 'mg' },
    female: { value: 18, unit: 'mg' },
  },
  phosphorusMg: {
    male: { value: 700, unit: 'mg' },
    female: { value: 700, unit: 'mg' },
  },
  vitaminAMcg: {
    male: { value: 900, unit: 'mcg' },
    female: { value: 700, unit: 'mcg' },
  },
  vitaminCMg: {
    male: { value: 45, unit: 'mg' },
    female: { value: 45, unit: 'mg' },
  },
  vitaminB1Mg: {
    male: { value: 1.2, unit: 'mg' },
    female: { value: 1.0, unit: 'mg' },
  },
  vitaminB2Mg: {
    male: { value: 1.3, unit: 'mg' },
    female: { value: 1.1, unit: 'mg' },
  },
  vitaminPpMg: {
    male: { value: 16, unit: 'mg' },
    female: { value: 14, unit: 'mg' },
  },
};

const TARGET_KEYS: NutritionNutrientKey[] = [
  'calciumMg',
  'ironMg',
  'phosphorusMg',
  'vitaminAMcg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  'vitaminDMcg',
  'vitaminHMcg',
];

function isVietnameseContext(profile: NutritionProfileForTargets): boolean {
  const vietnamValues = new Set(['VN', 'VIETNAM', 'VIET NAM']);
  return [profile.countryOfOrigin, profile.countryOfResidence]
    .filter(Boolean)
    .some((country) => vietnamValues.has(country?.trim().toUpperCase() ?? ''));
}

function normalizeSex(value: string | null): BiologicalSex {
  return value === 'female' ? 'female' : 'male';
}

export function resolveMicronutrientTargets(
  profile: NutritionProfileForTargets
): Record<NutritionNutrientKey, MicronutrientTarget> {
  const sourceTable = isVietnameseContext(profile) ? VIETNAM_RDA : WHO_FAO;
  const source: Exclude<TargetSource, 'unsupported'> = isVietnameseContext(
    profile
  )
    ? 'vietnam_rda'
    : 'who_fao';
  const sex = normalizeSex(profile.biologicalSex);
  const targets = Object.fromEntries(
    Object.keys(NUTRIENT_META).map((key) => [
      key,
      {
        key,
        value: null,
        unit: NUTRIENT_META[key as NutritionNutrientKey].unit === 'mcg'
          ? 'mcg'
          : 'mg',
        source: 'unsupported',
        sourceLabelKey: 'nutrition.targetSources.unsupported',
        applicability: 'unsupported',
      },
    ])
  ) as Record<NutritionNutrientKey, MicronutrientTarget>;

  for (const key of TARGET_KEYS) {
    if (key === 'vitaminDMcg') {
      targets[key] = {
        key,
        value: null,
        unit: 'mcg',
        source: 'unsupported',
        sourceLabelKey: 'nutrition.targetSources.unsupported',
        applicability: 'educational',
      };
      continue;
    }

    if (key === 'vitaminHMcg') {
      targets[key] = {
        key,
        value: null,
        unit: 'mcg',
        source: 'unsupported',
        sourceLabelKey: 'nutrition.targetSources.unsupported',
        applicability: 'hidden',
      };
      continue;
    }

    const target = sourceTable[key]?.[sex];
    if (!target) {
      targets[key] = {
        key,
        value: null,
        unit: 'mg',
        source: 'unsupported',
        sourceLabelKey: 'nutrition.targetSources.unsupported',
        applicability: 'unsupported',
      };
      continue;
    }

    const value =
      key === 'ironMg' &&
      source === 'vietnam_rda' &&
      sex === 'female' &&
      (profile.age ?? 0) >= 50
        ? 10
        : target.value;

    targets[key] = {
      key,
      value,
      unit: target.unit,
      source,
      sourceLabelKey: REFERENCE_SOURCES[source].labelKey,
      applicability: 'scored',
    };
  }

  return targets;
}
```

- [ ] **Step 4: Run target resolver tests**

```bash
bun run test lib/nutrition/reference-targets.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit target resolver**

```bash
git add lib/nutrition/reference-targets.ts lib/nutrition/reference-targets.test.ts
git commit -m "feat: add nutrition reference targets" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 2: Confidence, Summary, and Candidate Data

### Task 2.1: Add confidence and summary logic

**Files:**
- Create: `lib/nutrition/confidence.ts`
- Create: `lib/nutrition/summary.ts`
- Test: `lib/nutrition/confidence.test.ts`
- Test: `lib/nutrition/summary.test.ts`

- [ ] **Step 1: Write failing confidence tests**

Create `lib/nutrition/confidence.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  getCaloriesWithNutrientData,
  getConfidenceMetadata,
  getConfidenceDisplayState,
  getNutrientConfidence,
} from './confidence';

describe('nutrition confidence', () => {
  it('includes unmatched calories in the denominator', () => {
    expect(
      getNutrientConfidence({
        totalCalories: 800,
        caloriesWithNutrientData: 500,
      })
    ).toBe(62.5);
  });

  it('returns unmatched calorie metadata for UI explanations', () => {
    expect(
      getConfidenceMetadata({
        totalCalories: 800,
        caloriesWithNutrientData: 500,
      })
    ).toEqual({
      confidence: 62.5,
      caloriesMissingNutrientData: 300,
    });
  });

  it('counts all calories when the nutrient value is present', () => {
    expect(
      getCaloriesWithNutrientData([
        { calories: 300, nutrientValue: 1.2 },
        { calories: 500, nutrientValue: 0 },
      ])
    ).toBe(800);
  });

  it('excludes source rows with null nutrient values from the numerator', () => {
    expect(
      getCaloriesWithNutrientData([
        { calories: 500, nutrientValue: 2.1 },
        { calories: 300, nutrientValue: null },
      ])
    ).toBe(500);
  });

  it('returns zero confidence for empty periods', () => {
    expect(
      getNutrientConfidence({
        totalCalories: 0,
        caloriesWithNutrientData: 0,
      })
    ).toBe(0);
  });

  it('uses exact threshold boundaries', () => {
    expect(getConfidenceDisplayState(70)).toBe('normal');
    expect(getConfidenceDisplayState(69.9)).toBe('limited_data');
    expect(getConfidenceDisplayState(40)).toBe('limited_data');
    expect(getConfidenceDisplayState(39.9)).toBe('warning_points');
    expect(getConfidenceDisplayState(20)).toBe('warning_points');
    expect(getConfidenceDisplayState(19.9)).toBe('insufficient_data');
  });
});
```

- [ ] **Step 2: Write failing summary and macro consistency tests**

Create `lib/nutrition/summary.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  bucketNutrients,
  getMacroConsistency,
  getMacroConsistencySummary,
  getTrendStatus,
  resolveInitialRange,
} from './summary';

describe('nutrition summary', () => {
  it('keeps low-confidence below-target nutrients out of needs attention', () => {
    const result = bucketNutrients([
      {
        nutrient: 'ironMg',
        labelKey: 'nutrition.nutrients.iron',
        average: 5,
        unit: 'mg',
        percentOfTarget: 35,
        confidence: 39.9,
        status: 'below_target',
      },
    ]);

    expect(result.needsAttention).toHaveLength(0);
    expect(result.limitedDataCount).toBe(1);
  });

  it('puts below-target nutrients with sufficient confidence in needs attention', () => {
    const result = bucketNutrients([
      {
        nutrient: 'ironMg',
        labelKey: 'nutrition.nutrients.iron',
        average: 5,
        unit: 'mg',
        percentOfTarget: 35,
        confidence: 40,
        status: 'below_target',
      },
    ]);

    expect(result.needsAttention).toHaveLength(1);
    expect(result.limitedDataCount).toBe(0);
  });

  it('puts above-target nutrients with sufficient confidence in most consistent', () => {
    const result = bucketNutrients([
      {
        nutrient: 'calciumMg',
        labelKey: 'nutrition.nutrients.calcium',
        average: 1200,
        unit: 'mg',
        percentOfTarget: 120,
        confidence: 80,
        status: 'above_target',
      },
    ]);

    expect(result.mostConsistent).toHaveLength(1);
    expect(result.needsAttention).toHaveLength(0);
  });

  it('keeps unsupported educational nutrients out of summary buckets', () => {
    const result = bucketNutrients([
      {
        nutrient: 'vitaminDMcg',
        labelKey: 'nutrition.nutrients.vitaminD',
        average: 0,
        unit: 'mcg',
        percentOfTarget: 20,
        confidence: 90,
        status: 'below_target',
        applicability: 'educational',
      },
    ]);

    expect(result.mostConsistent).toHaveLength(0);
    expect(result.needsAttention).toHaveLength(0);
    expect(result.limitedDataCount).toBe(0);
  });

  it('uses exact rounded calorie matching with no tolerance band', () => {
    expect(
      getMacroConsistency({
        target: 2000,
        values: [2000.4, 1999.6],
        macro: 'calories',
      })
    ).toBe(100);

    expect(
      getMacroConsistency({
        target: 2000,
        values: [1999, 2001, 1900],
        macro: 'calories',
      })
    ).toBe(0);
  });

  it('uses non-calorie macro thresholds', () => {
    expect(
      getMacroConsistency({
        target: 100,
        values: [90, 89],
        macro: 'protein',
      })
    ).toBe(50);

    expect(
      getMacroConsistency({
        target: 200,
        values: [170, 230, 169],
        macro: 'carbohydrate',
      })
    ).toBe(67);
  });

  it('summarizes macro consistency and weakest macro', () => {
    expect(
      getMacroConsistencySummary({
        calories: 100,
        protein: 80,
        carbohydrate: 60,
        fat: 40,
      })
    ).toEqual({
      averageConsistencyPct: 70,
      weakestMacro: 'fat',
    });
  });

  it('resolves initial range from logged days in last 30 days', () => {
    expect(resolveInitialRange(13)).toBe('7d');
    expect(resolveInitialRange(14)).toBe('30d');
  });

  it('marks trend readiness per range', () => {
    expect(getTrendStatus('7d', 2)).toBe('too_few_logged_days');
    expect(getTrendStatus('7d', 3)).toBe('ready');
    expect(getTrendStatus('30d', 9)).toBe('too_few_logged_days');
    expect(getTrendStatus('30d', 10)).toBe('ready');
    expect(getTrendStatus('90d', 29)).toBe('too_few_logged_days');
    expect(getTrendStatus('90d', 30)).toBe('ready');
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

```bash
bun run test lib/nutrition/confidence.test.ts lib/nutrition/summary.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 4: Implement confidence logic**

Create `lib/nutrition/confidence.ts`:

```ts
import type { ConfidenceDisplayState } from './types';

export function getNutrientConfidence({
  totalCalories,
  caloriesWithNutrientData,
}: {
  totalCalories: number;
  caloriesWithNutrientData: number;
}): number {
  if (totalCalories <= 0) return 0;

  return Math.round((caloriesWithNutrientData / totalCalories) * 1000) / 10;
}

export function getCaloriesWithNutrientData(
  items: { calories: number; nutrientValue: number | null | undefined }[]
): number {
  return items.reduce((sum, item) => {
    if (item.nutrientValue == null) return sum;
    return sum + Math.max(0, item.calories);
  }, 0);
}

export function getConfidenceMetadata({
  totalCalories,
  caloriesWithNutrientData,
}: {
  totalCalories: number;
  caloriesWithNutrientData: number;
}): {
  confidence: number;
  caloriesMissingNutrientData: number;
} {
  return {
    confidence: getNutrientConfidence({
      totalCalories,
      caloriesWithNutrientData,
    }),
    caloriesMissingNutrientData: Math.max(
      0,
      totalCalories - caloriesWithNutrientData
    ),
  };
}

export function getConfidenceDisplayState(
  confidence: number
): ConfidenceDisplayState {
  if (confidence >= 70) return 'normal';
  if (confidence >= 40) return 'limited_data';
  if (confidence >= 20) return 'warning_points';
  return 'insufficient_data';
}
```

- [ ] **Step 5: Implement summary logic**

Create `lib/nutrition/summary.ts`:

```ts
import type {
  MacroConsistencySummary,
  MacroKey,
  NutrientSummaryItem,
  NutritionRange,
} from './types';

export function resolveInitialRange(loggedDaysLast30: number): NutritionRange {
  return loggedDaysLast30 < 14 ? '7d' : '30d';
}

export function getTrendStatus(
  range: NutritionRange,
  loggedDays: number
): 'ready' | 'too_few_logged_days' {
  const thresholds: Record<NutritionRange, number> = {
    '7d': 3,
    '30d': 10,
    '90d': 30,
  };

  return loggedDays >= thresholds[range] ? 'ready' : 'too_few_logged_days';
}

export function getMacroConsistency({
  macro,
  target,
  values,
}: {
  macro: MacroKey;
  target: number | null;
  values: number[];
}): number | null {
  if (!target || values.length === 0) return null;

  const matches = values.filter((value) => {
    if (macro === 'calories') return Math.round(value) === target;
    if (macro === 'protein') return value >= target * 0.9;

    const lower = target * 0.85;
    const upper = target * 1.15;
    return value >= lower && value <= upper;
  }).length;

  return Math.round((matches / values.length) * 100);
}

export function getMacroConsistencySummary(
  values: Record<MacroKey, number | null>
): MacroConsistencySummary {
  const entries = Object.entries(values).filter(
    (entry): entry is [MacroKey, number] => entry[1] !== null
  );
  if (entries.length === 0) {
    return { averageConsistencyPct: 0, weakestMacro: null };
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const weakest = entries.reduce((lowest, current) =>
    current[1] < lowest[1] ? current : lowest
  );

  return {
    averageConsistencyPct: Math.round(total / entries.length),
    weakestMacro: weakest[0],
  };
}

export function bucketNutrients(items: NutrientSummaryItem[]): {
  mostConsistent: NutrientSummaryItem[];
  needsAttention: NutrientSummaryItem[];
  limitedDataCount: number;
} {
  const mostConsistent: NutrientSummaryItem[] = [];
  const needsAttention: NutrientSummaryItem[] = [];
  let limitedDataCount = 0;

  for (const item of items) {
    if (item.applicability && item.applicability !== 'scored') {
      continue;
    }

    if (item.confidence < 40 || item.status === 'limited_data') {
      limitedDataCount += 1;
      continue;
    }

    if (item.status === 'below_target') {
      needsAttention.push(item);
      continue;
    }

    if (item.status === 'adequate' || item.status === 'above_target') {
      mostConsistent.push(item);
    }
  }

  return { mostConsistent, needsAttention, limitedDataCount };
}
```

- [ ] **Step 6: Run pure logic tests**

```bash
bun run test lib/nutrition/confidence.test.ts lib/nutrition/summary.test.ts
```

Expected: PASS.

- [ ] **Step 7: Commit pure logic**

```bash
git add lib/nutrition/confidence.ts lib/nutrition/confidence.test.ts lib/nutrition/summary.ts lib/nutrition/summary.test.ts
git commit -m "feat: add nutrition confidence and summary logic" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 2.2: Add curated food-source candidates

**Files:**
- Create: `lib/nutrition/food-source-candidates.ts`
- Test: `lib/nutrition/food-source-candidates.test.ts`

- [ ] **Step 1: Write failing candidate tests**

Create `lib/nutrition/food-source-candidates.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { SUPPORTED_CANDIDATE_NUTRIENTS } from './nutrients';
import { getCuratedFoodSourceCandidates } from './food-source-candidates';

describe('curated food-source candidates', () => {
  it('provides at least five candidates for every supported nutrient', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      expect(getCuratedFoodSourceCandidates(nutrient).length).toBeGreaterThanOrEqual(5);
    }
  });

  it('uses i18n keys for all user-facing content', () => {
    for (const nutrient of SUPPORTED_CANDIDATE_NUTRIENTS) {
      for (const candidate of getCuratedFoodSourceCandidates(nutrient)) {
        expect(candidate.nameKey).toMatch(/^nutrition\\.candidates\\./);
        expect(candidate.servingKey).toMatch(/^nutrition\\.candidates\\./);
        expect(candidate.rationaleKey).toMatch(/^nutrition\\.candidates\\./);
        if (candidate.cautionKey) {
          expect(candidate.cautionKey).toMatch(/^nutrition\\.candidates\\./);
        }
      }
    }
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test lib/nutrition/food-source-candidates.test.ts
```

Expected: FAIL because implementation file does not exist.

- [ ] **Step 3: Implement curated candidates**

Create `lib/nutrition/food-source-candidates.ts`:

```ts
import type { SupportedCandidateNutrient } from './nutrients';

export interface FoodSourceCandidate {
  nutrient: SupportedCandidateNutrient;
  id: string;
  nameKey: string;
  servingKey: string;
  rationaleKey: string;
  cautionKey?: string;
}

const c = (
  nutrient: SupportedCandidateNutrient,
  id: string,
  caution = false
): FoodSourceCandidate => ({
  nutrient,
  id,
  nameKey: `nutrition.candidates.${nutrient}.${id}.name`,
  servingKey: `nutrition.candidates.${nutrient}.${id}.serving`,
  rationaleKey: `nutrition.candidates.${nutrient}.${id}.rationale`,
  cautionKey: caution
    ? `nutrition.candidates.${nutrient}.${id}.caution`
    : undefined,
});

export const CURATED_FOOD_SOURCE_CANDIDATES: Record<
  SupportedCandidateNutrient,
  FoodSourceCandidate[]
> = {
  calciumMg: [
    c('calciumMg', 'tofu'),
    c('calciumMg', 'smallFishWithBones'),
    c('calciumMg', 'yogurt'),
    c('calciumMg', 'mustardGreens'),
    c('calciumMg', 'soyMilk'),
  ],
  ironMg: [
    c('ironMg', 'clams'),
    c('ironMg', 'leanBeef'),
    c('ironMg', 'porkLiver', true),
    c('ironMg', 'waterSpinach'),
    c('ironMg', 'mungBeans'),
  ],
  vitaminCMg: [
    c('vitaminCMg', 'guava'),
    c('vitaminCMg', 'pomelo'),
    c('vitaminCMg', 'papaya'),
    c('vitaminCMg', 'mustardGreens'),
    c('vitaminCMg', 'freshHerbs'),
  ],
  phosphorusMg: [
    c('phosphorusMg', 'fish'),
    c('phosphorusMg', 'eggs'),
    c('phosphorusMg', 'tofu'),
    c('phosphorusMg', 'chicken'),
    c('phosphorusMg', 'peanuts'),
  ],
  vitaminB1Mg: [
    c('vitaminB1Mg', 'pork'),
    c('vitaminB1Mg', 'mungBeans'),
    c('vitaminB1Mg', 'brownRice'),
    c('vitaminB1Mg', 'peanuts'),
    c('vitaminB1Mg', 'soybeans'),
  ],
  vitaminB2Mg: [
    c('vitaminB2Mg', 'eggs'),
    c('vitaminB2Mg', 'yogurt'),
    c('vitaminB2Mg', 'porkLiver', true),
    c('vitaminB2Mg', 'fish'),
    c('vitaminB2Mg', 'mushrooms'),
  ],
  vitaminPpMg: [
    c('vitaminPpMg', 'chicken'),
    c('vitaminPpMg', 'fish'),
    c('vitaminPpMg', 'peanuts'),
    c('vitaminPpMg', 'leanPork'),
    c('vitaminPpMg', 'mushrooms'),
  ],
  vitaminAMcg: [
    c('vitaminAMcg', 'carrots'),
    c('vitaminAMcg', 'pumpkin'),
    c('vitaminAMcg', 'sweetPotato'),
    c('vitaminAMcg', 'eggYolk'),
    c('vitaminAMcg', 'darkLeafyGreens'),
  ],
};

export function getCuratedFoodSourceCandidates(
  nutrient: SupportedCandidateNutrient
): FoodSourceCandidate[] {
  return CURATED_FOOD_SOURCE_CANDIDATES[nutrient] ?? [];
}
```

- [ ] **Step 4: Run candidate tests**

```bash
bun run test lib/nutrition/food-source-candidates.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit candidates**

```bash
git add lib/nutrition/food-source-candidates.ts lib/nutrition/food-source-candidates.test.ts
git commit -m "feat: add curated nutrition food candidates" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 3: Server Actions and Aggregation

### Task 3.1: Add date helpers and validation schemas

**Files:**
- Create: `lib/nutrition/date-range.ts`
- Create: `lib/nutrition/schemas.ts`
- Test: `lib/nutrition/date-range.test.ts`
- Test: `lib/nutrition/schemas.test.ts`

- [ ] **Step 1: Write failing date and schema tests**

Create `lib/nutrition/date-range.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getNutritionPeriod } from './date-range';

describe('getNutritionPeriod', () => {
  it('includes today and returns local YYYY-MM-DD dates', () => {
    const period = getNutritionPeriod({
      range: '7d',
      now: new Date('2026-04-25T12:00:00.000Z'),
      timezoneOffset: -420,
    });

    expect(period.endDate).toBe('2026-04-25');
    expect(period.startDate).toBe('2026-04-19');
    expect(period.bucketTimezone).toBe('local');
  });

  it('falls back to UTC when timezoneOffset is null', () => {
    const period = getNutritionPeriod({
      range: '7d',
      now: new Date('2026-04-25T12:00:00.000Z'),
      timezoneOffset: null,
    });

    expect(period.bucketTimezone).toBe('utc');
  });
});
```

Create `lib/nutrition/schemas.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  foodSourceCandidatesInputSchema,
  nutrientTrendInputSchema,
  nutritionOverviewInputSchema,
} from './schemas';

describe('nutrition schemas', () => {
  it('accepts auto overview range and nullable timezoneOffset', () => {
    expect(
      nutritionOverviewInputSchema.parse({
        range: 'auto',
        timezoneOffset: null,
      })
    ).toEqual({ range: 'auto', timezoneOffset: null });
  });

  it('rejects invalid ranges', () => {
    expect(() =>
      nutritionOverviewInputSchema.parse({
        range: '365d',
        timezoneOffset: 0,
      })
    ).toThrow();
  });

  it('validates trend and candidate nutrient keys', () => {
    expect(
      nutrientTrendInputSchema.parse({
        nutrient: 'ironMg',
        range: '30d',
        timezoneOffset: 0,
      }).nutrient
    ).toBe('ironMg');

    expect(
      foodSourceCandidatesInputSchema.parse({ nutrient: 'ironMg' }).nutrient
    ).toBe('ironMg');
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
bun run test lib/nutrition/date-range.test.ts lib/nutrition/schemas.test.ts
```

Expected: FAIL because implementation files do not exist.

- [ ] **Step 3: Implement date helpers**

Create `lib/nutrition/date-range.ts`:

```ts
import type { BucketTimezone, NutritionRange } from './types';

const RANGE_DAYS: Record<NutritionRange, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
};

function toLocalDateString(date: Date, timezoneOffset: number | null): string {
  if (timezoneOffset === null) return date.toISOString().slice(0, 10);

  const localMs = date.getTime() - timezoneOffset * 60_000;
  return new Date(localMs).toISOString().slice(0, 10);
}

export function getNutritionPeriod({
  range,
  now = new Date(),
  timezoneOffset,
}: {
  range: NutritionRange;
  now?: Date;
  timezoneOffset: number | null;
}): {
  startDate: string;
  endDate: string;
  bucketTimezone: BucketTimezone;
} {
  const endDate = toLocalDateString(now, timezoneOffset);
  const start = new Date(`${endDate}T00:00:00.000Z`);
  start.setUTCDate(start.getUTCDate() - (RANGE_DAYS[range] - 1));

  return {
    startDate: start.toISOString().slice(0, 10),
    endDate,
    bucketTimezone: timezoneOffset === null ? 'utc' : 'local',
  };
}

export function localDateSqlExpression(
  columnSql: string,
  timezoneOffset: number | null
): string {
  if (timezoneOffset === null) return `${columnSql}::date`;

  const offsetMinutes = -timezoneOffset;
  return `(${columnSql} + (${offsetMinutes} || ' minutes')::interval)::date`;
}
```

- [ ] **Step 4: Implement schemas**

Create `lib/nutrition/schemas.ts`:

```ts
import { z } from 'zod';
import {
  DEFAULT_NUTRIENTS,
  MORE_NUTRIENTS,
  SUPPORTED_CANDIDATE_NUTRIENTS,
} from './nutrients';

export const nutritionRangeSchema = z.enum(['7d', '30d', '90d']);
export const nutritionRangeInputSchema = z.enum(['auto', '7d', '30d', '90d']);

export const timezoneOffsetSchema = z
  .number()
  .int()
  .min(-840)
  .max(720)
  .nullable();

export const nutritionOverviewInputSchema = z.object({
  range: nutritionRangeInputSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const nutrientTrendInputSchema = z.object({
  nutrient: z.enum([...DEFAULT_NUTRIENTS, ...MORE_NUTRIENTS]),
  range: nutritionRangeSchema,
  timezoneOffset: timezoneOffsetSchema,
});

export const foodSourceCandidatesInputSchema = z.object({
  nutrient: z.enum(SUPPORTED_CANDIDATE_NUTRIENTS),
});
```

- [ ] **Step 5: Run tests**

```bash
bun run test lib/nutrition/date-range.test.ts lib/nutrition/schemas.test.ts
```

Expected: PASS.

- [ ] **Step 6: Commit date/schema helpers**

```bash
git add lib/nutrition/date-range.ts lib/nutrition/date-range.test.ts lib/nutrition/schemas.ts lib/nutrition/schemas.test.ts
git commit -m "feat: add nutrition range validation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.2: Add aggregation helpers

**Files:**
- Create: `lib/nutrition/aggregation.ts`
- Test: `lib/nutrition/aggregation.test.ts`

- [ ] **Step 1: Write failing aggregation mapper tests**

Create `lib/nutrition/aggregation.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import {
  buildNutrientCard,
  getSodiumCaveatKey,
} from './aggregation';

describe('nutrition aggregation helpers', () => {
  it('builds vitamin A context from beta-carotene without changing score', () => {
    const card = buildNutrientCard({
      nutrient: 'vitaminAMcg',
      averagePerDay: 350,
      target: 700,
      targetSource: 'vietnam_rda',
      confidence: 80,
      betaCaroteneAveragePerDay: 1200,
    });

    expect(card.percentOfTarget).toBe(50);
    expect(card.contextMetrics).toEqual([
      expect.objectContaining({
        key: 'betaCaroteneMcg',
        averagePerDay: 1200,
      }),
    ]);
  });

  it('shows sodium caveat for low confidence', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 69.9,
        faoVietnamCalorieShare: 0,
        faoVietnamConfidence: null,
        missingSodiumCondimentItems: 0,
      })
    ).toBe('nutrition.caveats.sodium');
  });

  it('shows sodium caveat for missing FAO condiment sodium', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 90,
        faoVietnamCalorieShare: 0.1,
        faoVietnamConfidence: 100,
        missingSodiumCondimentItems: 1,
      })
    ).toBe('nutrition.caveats.sodium');
  });

  it('shows sodium caveat for FAO-heavy low-confidence meals', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 90,
        faoVietnamCalorieShare: 0.2,
        faoVietnamConfidence: 69.9,
        missingSodiumCondimentItems: 0,
      })
    ).toBe('nutrition.caveats.sodium');
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test lib/nutrition/aggregation.test.ts
```

Expected: FAIL because `aggregation.ts` does not exist.

- [ ] **Step 3: Implement aggregation mapping helpers**

Create `lib/nutrition/aggregation.ts`:

```ts
import { getConfidenceDisplayState } from './confidence';
import { getNutrientMeta } from './nutrients';
import type {
  NutrientCardData,
  NutritionNutrientKey,
  TargetSource,
} from './types';

export function getPercentOfTarget(
  averagePerDay: number | null,
  target: number | null
): number | null {
  if (averagePerDay == null || !target) return null;
  return Math.round((averagePerDay / target) * 100);
}

export function getNutrientStatus(
  percentOfTarget: number | null,
  confidence: number
): 'below_target' | 'adequate' | 'above_target' | 'limited_data' {
  if (confidence < 40 || percentOfTarget == null) return 'limited_data';
  if (percentOfTarget < 90) return 'below_target';
  if (percentOfTarget > 110) return 'above_target';
  return 'adequate';
}

export function getSodiumCaveatKey({
  confidence,
  faoVietnamCalorieShare,
  faoVietnamConfidence,
  missingSodiumCondimentItems,
}: {
  confidence: number;
  faoVietnamCalorieShare: number;
  faoVietnamConfidence: number | null;
  missingSodiumCondimentItems: number;
}): string | undefined {
  if (confidence < 70) return 'nutrition.caveats.sodium';
  if (missingSodiumCondimentItems > 0) return 'nutrition.caveats.sodium';
  if (
    faoVietnamCalorieShare >= 0.2 &&
    faoVietnamConfidence != null &&
    faoVietnamConfidence < 70
  ) {
    return 'nutrition.caveats.sodium';
  }

  return undefined;
}

export function buildNutrientCard({
  nutrient,
  averagePerDay,
  target,
  targetSource,
  confidence,
  betaCaroteneAveragePerDay,
  caveatKey,
  sourceBreakdown,
  supportsCandidates = false,
}: {
  nutrient: NutritionNutrientKey;
  averagePerDay: number | null;
  target: number | null;
  targetSource: TargetSource;
  confidence: number;
  betaCaroteneAveragePerDay?: number | null;
  caveatKey?: string;
  sourceBreakdown?: NutrientCardData['sourceBreakdown'];
  supportsCandidates?: boolean;
}): NutrientCardData {
  const meta = getNutrientMeta(nutrient);

  return {
    nutrient,
    labelKey: meta.labelKey,
    group: meta.group,
    averagePerDay,
    target,
    targetSource,
    targetSourceLabelKey:
      targetSource === 'vietnam_rda'
        ? 'nutrition.targetSources.vietnamRda'
        : targetSource === 'who_fao'
          ? 'nutrition.targetSources.whoFao'
          : 'nutrition.targetSources.unsupported',
    unit: meta.unit,
    percentOfTarget: getPercentOfTarget(averagePerDay, target),
    confidence,
    displayState: getConfidenceDisplayState(confidence),
    caveatKey,
    sourceBreakdown,
    contextMetrics:
      nutrient === 'vitaminAMcg'
        ? [
            {
              key: 'betaCaroteneMcg',
              labelKey: getNutrientMeta('betaCaroteneMcg').labelKey,
              averagePerDay: betaCaroteneAveragePerDay ?? null,
              unit: 'mcg',
            },
          ]
        : undefined,
    supportsCandidates,
  };
}
```

- [ ] **Step 4: Run aggregation tests**

```bash
bun run test lib/nutrition/aggregation.test.ts
```

Expected: PASS.

- [ ] **Step 5: Commit aggregation helpers**

```bash
git add lib/nutrition/aggregation.ts lib/nutrition/aggregation.test.ts
git commit -m "feat: add nutrition aggregation helpers" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 3.3: Add server actions

**Files:**
- Create: `lib/nutrition/actions/overview-query.ts`
- Create: `lib/nutrition/actions/overview-mapper.ts`
- Create: `lib/nutrition/actions/trend-query.ts`
- Create: `lib/nutrition/actions/overview.ts`
- Create: `lib/nutrition/actions/trend.ts`
- Create: `lib/nutrition/actions/candidates.ts`
- Create: `lib/nutrition/actions/index.ts`
- Test: `lib/nutrition/actions/overview-mapper.test.ts`
- Test: `lib/nutrition/actions/overview.test.ts`
- Test: `lib/nutrition/actions/trend.test.ts`
- Test: `lib/nutrition/actions/candidates.test.ts`

- [ ] **Step 1: Write action validation tests first**

Create `lib/nutrition/actions/overview.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getNutritionOverview } from './overview';

describe('getNutritionOverview', () => {
  it('rejects invalid range input', async () => {
    await expect(
      getNutritionOverview({ range: '365d', timezoneOffset: 0 } as never)
    ).rejects.toThrow();
  });

  it('assembles selected-range logged days and sodium source caveat from mocked rows', async () => {
    const overview = await getNutritionOverview({
      range: '7d',
      timezoneOffset: 0,
    });

    expect(overview.requestedRange).toBe('7d');
    expect(overview.resolvedRange).toBe('7d');
    expect(overview.loggedDays).toBe(3);
    expect(overview.trendStatus).toBe('ready');
    expect(
      overview.moreNutrients.find((card) => card.nutrient === 'sodiumMg')
        ?.caveatKey
    ).toBe('nutrition.caveats.sodium');
  });

  it('does not include trend arrays in overview nutrient cards', async () => {
    const overview = await getNutritionOverview({
      range: '30d',
      timezoneOffset: 0,
    });

    for (const card of [...overview.micronutrients, ...overview.moreNutrients]) {
      expect(card).not.toHaveProperty('trend');
    }
  });
});
```

Create `lib/nutrition/actions/trend.test.ts`:

```ts
import { describe, expect, it } from 'vitest';
import { getNutrientTrend } from './trend';

describe('getNutrientTrend', () => {
  it('rejects hidden nutrient keys', async () => {
    await expect(
      getNutrientTrend({
        nutrient: 'vitaminHMcg',
        range: '30d',
        timezoneOffset: 0,
      } as never)
    ).rejects.toThrow();
  });

  it('returns points for one requested nutrient only', async () => {
    const result = await getNutrientTrend({
      nutrient: 'ironMg',
      range: '7d',
      timezoneOffset: 0,
    });

    expect(result.nutrient).toBe('ironMg');
    expect(result.points).toEqual([
      { date: '2026-04-23', value: 5, confidence: 100 },
      { date: '2026-04-24', value: null, confidence: 0 },
      { date: '2026-04-25', value: 7, confidence: 62.5 },
    ]);
  });
});
```

Create `lib/nutrition/actions/candidates.test.ts`:

```ts
import { describe, expect, it, vi } from 'vitest';
import { getFoodSourceCandidates } from './candidates';

vi.mock('@/lib/auth', () => ({
  requireAuthAndProfile: vi.fn(async () => ({
    user: { id: 'user-1' },
    profile: {},
  })),
}));

describe('getFoodSourceCandidates', () => {
  it('rejects unsupported nutrient keys', async () => {
    await expect(
      getFoodSourceCandidates({ nutrient: 'vitaminHMcg' } as never)
    ).rejects.toThrow();
  });

  it('authenticates before returning curated candidates', async () => {
    const { requireAuthAndProfile } = await import('@/lib/auth');

    await getFoodSourceCandidates({ nutrient: 'ironMg' });

    expect(requireAuthAndProfile).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run action tests to verify they fail**

```bash
bun run test lib/nutrition/actions/overview.test.ts lib/nutrition/actions/trend.test.ts lib/nutrition/actions/candidates.test.ts
```

Expected: FAIL because action files do not exist.

- [ ] **Step 3: Implement candidate action**

Create `lib/nutrition/actions/candidates.ts`:

```ts
'use server';

import { getCuratedFoodSourceCandidates } from '../food-source-candidates';
import type { SupportedCandidateNutrient } from '../nutrients';
import { foodSourceCandidatesInputSchema } from '../schemas';
import { requireAuthAndProfile } from '@/lib/auth';

export async function getFoodSourceCandidates(input: {
  nutrient: SupportedCandidateNutrient;
}) {
  const parsed = foodSourceCandidatesInputSchema.parse(input);
  await requireAuthAndProfile();

  return {
    nutrient: parsed.nutrient,
    candidates: getCuratedFoodSourceCandidates(parsed.nutrient),
  };
}
```

- [ ] **Step 4: Implement query and mapper boundaries**

Create `lib/nutrition/actions/overview-query.ts`:

```ts
import { and, eq, gt, gte, lte, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import {
  ingredientSources,
  mealItems,
  meals,
  vietnameseFoodComposition,
} from '@/lib/db/schema';
import { localDateSqlExpression } from '../date-range';

export interface OverviewMealItemRow {
  localDate: string;
  calories: number;
  proteinG: number | null;
  carbohydrateG: number | null;
  fatG: number | null;
  fiberG: number | null;
  sourceCode: string | null;
  typeEn: string | null;
  typeVn: string | null;
  calciumMg: number | null;
  ironMg: number | null;
  vitaminCMg: number | null;
  phosphorusMg: number | null;
  vitaminB1Mg: number | null;
  vitaminB2Mg: number | null;
  vitaminPpMg: number | null;
  vitaminAMcg: number | null;
  betaCaroteneMcg: number | null;
  sodiumMg: number | null;
  magnesiumMg: number | null;
  potassiumMg: number | null;
  zincMg: number | null;
  copperMcg: number | null;
  manganeseMg: number | null;
  vitaminB12Mcg: number | null;
  vitaminB9Mcg: number | null;
  vitaminB5Mg: number | null;
  vitaminB6Mg: number | null;
  vitaminEMg: number | null;
  vitaminKMcg: number | null;
}

export async function countLoggedDaysLast30({
  userId,
  startDate,
  endDate,
  startAt,
  endAt,
  timezoneOffset,
}: {
  userId: string;
  startDate: string;
  endDate: string;
  startAt: Date;
  endAt: Date;
  timezoneOffset: number | null;
}): Promise<number> {
  const localDate = sql<string>`${sql.raw(
    localDateSqlExpression('meals.logged_at', timezoneOffset)
  )}`;
  const [{ loggedDays = 0 } = {}] = await db
    .select({
      loggedDays: sql<number>`count(distinct ${localDate})::int`,
    })
    .from(meals)
    .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
    .where(
      and(
        eq(meals.userId, userId),
        gt(mealItems.caloriesKcal, 0),
        gte(meals.loggedAt, startAt),
        lte(meals.loggedAt, endAt),
        gte(localDate, startDate),
        lte(localDate, endDate)
      )
    );

  return loggedDays;
}

export async function fetchOverviewRows({
  userId,
  startDate,
  endDate,
  startAt,
  endAt,
  timezoneOffset,
}: {
  userId: string;
  startDate: string;
  endDate: string;
  startAt: Date;
  endAt: Date;
  timezoneOffset: number | null;
}): Promise<OverviewMealItemRow[]> {
  const localDate = sql<string>`${sql.raw(
    localDateSqlExpression('meals.logged_at', timezoneOffset)
  )}`;

  return db
    .select({
      localDate,
      calories: sql<number>`coalesce(${mealItems.caloriesKcal}, 0)`,
      proteinG: mealItems.proteinG,
      carbohydrateG: mealItems.carbohydrateG,
      fatG: mealItems.fatG,
      fiberG: mealItems.fiberG,
      sourceCode: ingredientSources.code,
      typeEn: vietnameseFoodComposition.typeEn,
      typeVn: vietnameseFoodComposition.typeVn,
      calciumMg: mealItems.calciumMg,
      ironMg: mealItems.ironMg,
      vitaminCMg: mealItems.vitaminCMg,
      phosphorusMg: mealItems.phosphorusMg,
      vitaminB1Mg: mealItems.vitaminB1Mg,
      vitaminB2Mg: mealItems.vitaminB2Mg,
      vitaminPpMg: mealItems.vitaminPpMg,
      vitaminAMcg: mealItems.vitaminAMcg,
      betaCaroteneMcg: mealItems.betaCaroteneMcg,
      sodiumMg: mealItems.sodiumMg,
      magnesiumMg: mealItems.magnesiumMg,
      potassiumMg: mealItems.potassiumMg,
      zincMg: mealItems.zincMg,
      copperMcg: mealItems.copperMcg,
      manganeseMg: mealItems.manganeseMg,
      vitaminB12Mcg: mealItems.vitaminB12Mcg,
      vitaminB9Mcg: mealItems.vitaminB9Mcg,
      vitaminB5Mg: mealItems.vitaminB5Mg,
      vitaminB6Mg: mealItems.vitaminB6Mg,
      vitaminEMg: mealItems.vitaminEMg,
      vitaminKMcg: mealItems.vitaminKMcg,
    })
    .from(meals)
    .innerJoin(mealItems, eq(mealItems.mealId, meals.id))
    .leftJoin(
      vietnameseFoodComposition,
      eq(vietnameseFoodComposition.id, mealItems.foodCompositionId)
    )
    .leftJoin(
      ingredientSources,
      eq(ingredientSources.id, vietnameseFoodComposition.sourceId)
    )
    .where(
      and(
        eq(meals.userId, userId),
        gte(meals.loggedAt, startAt),
        lte(meals.loggedAt, endAt),
        gte(localDate, startDate),
        lte(localDate, endDate)
      )
    );
}
```

Keep `OverviewMealItemRow` flat; do not return Drizzle table objects to mappers. `startAt`/`endAt` must be UTC timestamp bounds that cover the local-date range so PostgreSQL can use `meals_user_logged_at_idx` before joins; local-date predicates are a correctness guard for bucket boundaries, not the primary filter.

Create `lib/nutrition/actions/overview-mapper.ts`:

```ts
import {
  getCaloriesWithNutrientData,
  getNutrientConfidence,
} from '../confidence';
import { getNutritionPeriod } from '../date-range';
import { DEFAULT_NUTRIENTS, MORE_NUTRIENTS } from '../nutrients';
import { resolveMicronutrientTargets } from '../reference-targets';
import {
  bucketNutrients,
  getMacroConsistency,
  getMacroConsistencySummary,
  getTrendStatus,
} from '../summary';
import { buildNutrientCard, getSodiumCaveatKey } from '../aggregation';
import type {
  MacroKey,
  MacroPattern,
  NutritionNutrientKey,
  NutritionOverview,
  NutritionRange,
  NutritionRangeInput,
} from '../types';
import type { OverviewMealItemRow } from './overview-query';
import type { userProfiles } from '@/lib/db/schema';

type NutritionProfile = typeof userProfiles.$inferSelect;
const DEFAULT_NUTRIENT_SET = new Set<NutritionNutrientKey>(DEFAULT_NUTRIENTS);
const MORE_NUTRIENT_SET = new Set<NutritionNutrientKey>(MORE_NUTRIENTS);

export function mapOverviewRowsToDto({
  rows,
  profile,
  requestedRange,
  resolvedRange,
  loggedDaysLast30,
  period,
}: {
  rows: OverviewMealItemRow[];
  profile: NutritionProfile;
  requestedRange: NutritionRangeInput;
  resolvedRange: NutritionRange;
  loggedDaysLast30: number;
  period: ReturnType<typeof getNutritionPeriod>;
}): NutritionOverview {
  const loggedDays = new Set(rows.filter((row) => row.calories > 0).map((row) => row.localDate)).size;
  const trendStatus = getTrendStatus(resolvedRange, loggedDays);
  const totalCalories = rows.reduce((sum, row) => sum + Math.max(0, row.calories), 0);
  const targets = resolveMicronutrientTargets(profile);
  const sodiumStats = getSodiumSourceStats(rows, totalCalories);
  const safeLoggedDays = Math.max(1, loggedDays);
  const macros = buildMacroPatterns(rows, safeLoggedDays, profile);
  const macroConsistencyValues = Object.fromEntries(
    macros
      .filter((macro): macro is MacroPattern & { key: MacroKey } =>
        ['calories', 'protein', 'carbohydrate', 'fat'].includes(macro.key)
      )
      .map((macro) => [macro.key, macro.consistencyPct])
  ) as Record<MacroKey, number | null>;
  const macroConsistency = getMacroConsistencySummary(macroConsistencyValues);
  const allCards = [...DEFAULT_NUTRIENTS, ...MORE_NUTRIENTS].map((nutrient) => {
    const nutrientValues = rows.map((row) => row[nutrient] as number | null);
    const averagePerDay =
      nutrientValues.reduce((sum, value) => sum + (value ?? 0), 0) / safeLoggedDays;
    const confidence = getNutrientConfidence({
      totalCalories,
      caloriesWithNutrientData: getCaloriesWithNutrientData(
        rows.map((row) => ({
          calories: row.calories,
          nutrientValue: row[nutrient] as number | null,
        }))
      ),
    });
    const target = targets[nutrient];

    return buildNutrientCard({
      nutrient,
      averagePerDay,
      target: target.value,
      targetSource: target.source,
      confidence,
      betaCaroteneAveragePerDay:
        nutrient === 'vitaminAMcg'
          ? rows.reduce((sum, row) => sum + (row.betaCaroteneMcg ?? 0), 0) /
            safeLoggedDays
          : undefined,
      caveatKey:
        nutrient === 'sodiumMg' ? getSodiumCaveatKey(sodiumStats) : undefined,
      sourceBreakdown:
        nutrient === 'sodiumMg'
          ? {
              faoVietnamCalorieShare: sodiumStats.faoVietnamCalorieShare,
              faoVietnamConfidence: sodiumStats.faoVietnamConfidence,
              missingSodiumCondimentItems:
                sodiumStats.missingSodiumCondimentItems,
            }
          : undefined,
      supportsCandidates: DEFAULT_NUTRIENT_SET.has(nutrient),
    });
  });
  const summaryItems = allCards.map((card) =>
    toSummaryItem(card, targets[card.nutrient])
  );
  const summaryBuckets = bucketNutrients(summaryItems);

  return {
    requestedRange,
    resolvedRange,
    bucketTimezone: period.bucketTimezone,
    loggedDays,
    loggedDaysLast30,
    trendStatus,
    period: { startDate: period.startDate, endDate: period.endDate },
    summary: {
      mostConsistent: summaryBuckets.mostConsistent,
      needsAttention: summaryBuckets.needsAttention,
      limitedDataCount: summaryBuckets.limitedDataCount,
      macroConsistency,
    },
    macros,
    micronutrients: allCards.filter((card) =>
      DEFAULT_NUTRIENT_SET.has(card.nutrient)
    ),
    moreNutrients: allCards.filter((card) =>
      MORE_NUTRIENT_SET.has(card.nutrient)
    ),
    educationCards: [
      {
        id: 'vitamin_d',
        titleKey: 'nutrition.education.vitaminD.title',
        bodyKey: 'nutrition.education.vitaminD.body',
      },
    ],
  };
}
```

Create these private helpers in `overview-mapper.ts` above `mapOverviewRowsToDto`:

- `buildMacroPatterns(rows, safeLoggedDays, profile)` returns `MacroPattern[]`, using profile targets: `calorieTarget`, `proteinTargetG`, `carbsTargetG`, and `fatTargetG`; fiber has no consistency target in v1.
- `getSodiumSourceStats(rows, totalCalories)` returns `{ confidence, faoVietnamCalorieShare, faoVietnamConfidence, missingSodiumCondimentItems }` using `sourceCode === 'FAO_VN_2007'` and condiment labels `Condiments, traditional sauces` / `Gia vị, nước chấm`.
- `toSummaryItem(card, target)` copies `applicability` from `MicronutrientTarget` before `bucketNutrients`.

Fill `macros`, `micronutrients`, `moreNutrients`, and `summary` from rows in the implementation. Keep sodium source-breakdown logic in this mapper, not in the server action.

Create `lib/nutrition/actions/trend-query.ts` with `fetchTrendRows({ userId, nutrient, startDate, endDate, timezoneOffset })`. It must select only the requested nutrient column plus calories and local date, scoped by `eq(meals.userId, userId)`.

- [ ] **Step 5: Implement overview and trend actions**

Create `lib/nutrition/actions/overview.ts` and `trend.ts` with thin action orchestration. Every branch must return real data or throw a surfaced error.

Required overview implementation details:

- Parse `nutritionOverviewInputSchema`.
- Authenticate with `requireAuthAndProfile()`.
- Count logged calorie-bearing days in the last 30 local days.
- Use `getNutritionPeriod({ range: '30d', timezoneOffset })` plus UTC timestamp bounds derived from that period to pass explicit `startDate`/`endDate` and indexed `startAt`/`endAt` into `countLoggedDaysLast30`; do not use database `current_date`.
- Resolve `range: 'auto'` with `resolveInitialRange(loggedDaysLast30)`.
- Build inclusive period with `getNutritionPeriod`.
- Call `fetchOverviewRows({ userId: user.id, startDate, endDate, startAt, endAt, timezoneOffset })`.
- Call `mapOverviewRowsToDto(...)`; the action should not contain aggregation loops.
- Return `NutritionOverview` with aggregate card data only; no nutrient card may include `trend`.

Required trend implementation details:

- Parse `nutrientTrendInputSchema`.
- Authenticate with `requireAuthAndProfile()`.
- Query only the requested nutrient for the selected range via `fetchTrendRows`.
- Scope all meals by `user.id` in `fetchTrendRows`.
- Bucket values by local date using `timezoneOffset`.
- Compute per-day confidence using total day calories as denominator.
- Return `displayMode: 'line'` for confidence `>= 40`, `points` for `>= 20` and `< 40`, and `insufficient_data` for `< 20`.

Use this DTO assertion inside the overview action before returning:

```ts
for (const card of [...overview.micronutrients, ...overview.moreNutrients]) {
  if ('trend' in card) {
    throw new Error('Nutrition overview must not include trend arrays.');
  }
}
```

- [ ] **Step 6: Add integration-focused action tests**

Add concrete tests:

- Overview rejects invalid range.
- Overview DTO cards do not include `trend`.
- Overview mock data passes the authenticated `user.id` into `fetchOverviewRows`; mocked rows include two local dates in range and one FAO condiment row with null sodium.
- Overview selected `7d` returns `loggedDays: 3` and `trendStatus: 'ready'`; selected `30d` with nine logged days returns `trendStatus: 'too_few_logged_days'`.
- Overview sodium card includes `sourceBreakdown` and `nutrition.caveats.sodium` when a FAO condiment/sauce row is missing sodium.
- Overview macro consistency uses profile fields `calorieTarget`, `proteinTargetG`, `carbsTargetG`, and `fatTargetG`; fixture daily values should make calorie consistency exact-match fail for a one-kcal mismatch and protein/carbs/fat follow their planned thresholds.
- Trend rejects hidden nutrient keys.
- Trend passes only the requested nutrient into `fetchTrendRows` and returns `points` for exactly one nutrient.
- Candidate action authenticates and returns curated rows only for supported nutrients.

- Mock strategy:

- mock `@/lib/auth` to return `{ user: { id: 'user-1' }, profile: baseProfile }`
- mock `./overview-query` and `./trend-query`; do not hit the database in action tests
- add one mapper test in `overview-mapper.test.ts` that feeds raw rows directly and verifies unmatched calories lower confidence

- [ ] **Step 7: Run server action tests**

```bash
bun run test lib/nutrition/actions/
```

Expected: PASS.

- [ ] **Step 8: Commit server actions**

```bash
git add lib/nutrition/actions lib/nutrition/actions/*.test.ts
git commit -m "feat: add nutrition server actions" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 4: Nutrition Page UI and i18n

### Task 4.1: Update sidebar navigation

**Files:**
- Modify: `components/app/main-sidebar.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`
- Test: `components/app/main-sidebar.test.tsx`

- [ ] **Step 1: Add failing navigation expectation**

Create `components/app/main-sidebar.test.tsx` and render the real `MainSidebar`.
Mock `next-intl` so `useTranslations('app.mainSidebar')` returns these labels:
`dashboard -> Dashboard`, `logging -> Log`, `nutrition -> Nutrition`, and any
unchanged existing labels needed by the component.

Assert:

- sidebar renders Nutrition label
- Nutrition link points to `/nutrition`
- no `/tracking` nav link remains

- [ ] **Step 2: Run navigation test**

```bash
bun run test components/app/main-sidebar.test.tsx
```

Expected: FAIL because sidebar still contains `/tracking`.

- [ ] **Step 3: Update sidebar**

In `components/app/main-sidebar.tsx`:

- replace `Activity` item id `tracking` with `nutrition`
- label `t('nutrition')`
- href `/nutrition`
- keep `Activity` icon or switch to a lucide nutrition-appropriate icon if already imported from `lucide-react`

- [ ] **Step 4: Add message keys**

Add to `messages/en.json`:

```json
{
  "metadata": {
    "nutrition": {
      "title": "Nutrition — Kallo"
    }
  },
  "app": {
    "mainSidebar": {
      "nutrition": "Nutrition"
    }
  }
}
```

Add Vietnamese equivalents:

```json
{
  "metadata": {
    "nutrition": {
      "title": "Dinh dưỡng — Kallo"
    }
  },
  "app": {
    "mainSidebar": {
      "nutrition": "Dinh dưỡng"
    }
  }
}
```

Preserve existing JSON structure; do not duplicate top-level keys.

- [ ] **Step 5: Run navigation test**

```bash
bun run test components/app/main-sidebar.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit sidebar navigation**

```bash
git add components/app/main-sidebar.tsx components/app/main-sidebar.test.tsx messages/en.json messages/vi.json
git commit -m "feat: add nutrition sidebar navigation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.2: Add nutrition shell and overview state UI

**Files:**
- Create: `app/[locale]/(app)/nutrition/page.tsx`
- Create: `components/nutrition/nutrition-shell.tsx`
- Create: `components/nutrition/range-selector.tsx`
- Create: `components/nutrition/summary-strip.tsx`
- Create: `components/nutrition/macro-pattern-section.tsx`
- Create: `components/nutrition/nutrition-skeleton.tsx`
- Test: `components/nutrition/nutrition-shell.test.tsx`

- [ ] **Step 1: Write failing shell tests**

Create tests that mock nutrition actions and assert:

- initial query calls overview with `range: 'auto'`
- query key includes `timezoneOffset ?? 'utc'`
- range selector updates to explicit `7d`, `30d`, `90d`
- no trend action fires on initial render
- summary cards render `mostConsistent`, `needsAttention`, `limitedDataCount`, and macro consistency
- macro section renders period average calories/protein/carbs/fat without dashboard-style daily bars

- [ ] **Step 2: Run shell test to verify it fails**

```bash
bun run test components/nutrition/nutrition-shell.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `NutritionShell`**

Use a client component:

```tsx
'use client';

import { useQuery } from '@tanstack/react-query';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import { getNutritionOverview } from '@/lib/nutrition/actions';
import type { NutritionRange, NutritionRangeInput } from '@/lib/nutrition/types';
import { MacroPatternSection } from './macro-pattern-section';
import { NutritionSkeleton } from './nutrition-skeleton';
import { RangeSelector } from './range-selector';
import { SummaryStrip } from './summary-strip';

function getTimezoneOffset(): number | null {
  if (typeof window === 'undefined') return null;
  return new Date().getTimezoneOffset();
}

export function NutritionShell() {
  const t = useTranslations('nutrition');
  const timezoneOffset = useMemo(() => getTimezoneOffset(), []);
  const [range, setRange] = useState<NutritionRangeInput>('auto');

  const overviewQuery = useQuery({
    queryKey: ['nutrition', 'overview', range, timezoneOffset ?? 'utc'],
    queryFn: () => getNutritionOverview({ range, timezoneOffset }),
    staleTime: 60_000,
  });

  const resolvedRange = overviewQuery.data?.resolvedRange ?? '30d';

  if (overviewQuery.isLoading) return <NutritionSkeleton />;

  if (overviewQuery.isError || !overviewQuery.data) {
    return <div role="alert">{t('errors.overview')}</div>;
  }

  return (
    <main className="flex-1 overflow-y-auto px-5 py-4 sm:px-8">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="font-bold text-2xl">{t('title')}</h1>
          <p className="text-muted-foreground text-sm">{t('subtitle')}</p>
        </div>
        <RangeSelector
          value={resolvedRange}
          onChange={(next) => setRange(next)}
        />
      </header>
      <SummaryStrip summary={overviewQuery.data.summary} />
      <MacroPatternSection macros={overviewQuery.data.macros} />
    </main>
  );
}
```

- [ ] **Step 4: Add nutrition route after shell exists**

Create `app/[locale]/(app)/nutrition/page.tsx`:

```tsx
import type { Metadata } from 'next';
import { getTranslations } from 'next-intl/server';
import { NutritionShell } from '@/components/nutrition/nutrition-shell';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('metadata.nutrition');

  return {
    title: t('title'),
  };
}

export default function NutritionPage() {
  return <NutritionShell />;
}
```

- [ ] **Step 5: Implement range, summary, macro, skeleton components**

Keep each component focused:

- `RangeSelector`: buttons only
- `SummaryStrip`: four summary cards only
- `MacroPatternSection`: period averages/consistency only
- `NutritionSkeleton`: loading skeleton blocks

- [ ] **Step 6: Add i18n keys and remove temporary text**

Add these keys in both locale files:

- `nutrition.title`
- `nutrition.subtitle`
- `nutrition.range.7d`
- `nutrition.range.30d`
- `nutrition.range.90d`
- `nutrition.summary.mostConsistent`
- `nutrition.summary.needsAttention`
- `nutrition.summary.limitedData`
- `nutrition.summary.macroConsistency`
- `nutrition.macros.calories`
- `nutrition.macros.protein`
- `nutrition.macros.carbohydrate`
- `nutrition.macros.fat`
- `nutrition.macros.fiber`
- `nutrition.macros.averagePerDay`
- `nutrition.macros.consistency`
- `nutrition.macros.weakest`
- `nutrition.errors.overview`
- `nutrition.empty.title`
- `nutrition.empty.description`
- `nutrition.empty.logMeal`

- [ ] **Step 7: Run shell tests**

```bash
bun run test components/nutrition/nutrition-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit shell UI and route**

```bash
git add 'app/[locale]/(app)/nutrition/page.tsx' components/nutrition messages/en.json messages/vi.json
git commit -m "feat: add nutrition overview shell" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.3: Add nutrient cards, lazy trend loading, and education card

**Files:**
- Create: `components/nutrition/nutrient-grid.tsx`
- Create: `components/nutrition/nutrient-card.tsx`
- Create: `components/nutrition/nutrient-trend.tsx`
- Create: `components/nutrition/vitamin-d-card.tsx`
- Test: `components/nutrition/nutrient-card.test.tsx`

- [ ] **Step 1: Write failing lazy trend tests**

Test expectations:

- rendering a nutrient card does not call `getNutrientTrend`
- expanding/opening the card calls `getNutrientTrend` for that nutrient only
- hidden `moreNutrients` cards do not mount or call `getNutrientTrend` until the more section is expanded
- card renders average intake, unit, percent target, and target source label
- card renders confidence label for `normal`, `limited_data`, `warning_points`, and `insufficient_data`
- insufficient data card renders the limited-data explanation instead of a target claim
- sodium caveat key renders localized caveat copy
- `displayState: 'warning_points'` renders point-mode language, not a line trend claim
- Vitamin D card renders education copy from i18n keys

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test components/nutrition/nutrient-card.test.tsx
```

Expected: FAIL because components do not exist.

- [ ] **Step 3: Implement `NutrientCard` with lazy trend query**

Use `useQuery({ enabled: expanded })`:

```tsx
const trendQuery = useQuery({
  queryKey: [
    'nutrition',
    'trend',
    card.nutrient,
    resolvedRange,
    timezoneOffset ?? 'utc',
  ],
  queryFn: () =>
    getNutrientTrend({
      nutrient: card.nutrient,
      range: resolvedRange,
      timezoneOffset,
    }),
  enabled: expanded,
});
```

Pass `resolvedRange` into `NutrientCard`; do not pass the shell's raw `range` because it may still be `'auto'`. Do not fetch trend data for collapsed cards.

Render these required fields in `NutrientCard`:

- `card.labelKey`
- `card.averagePerDay` with `card.unit`
- `card.percentOfTarget` when non-null
- `card.target` and `card.targetSourceLabelKey`
- `card.displayState` localized label
- `card.caveatKey` when present
- `card.contextMetrics` for Vitamin A beta-carotene context
- insufficient-data copy when `card.displayState === 'insufficient_data'`

- [ ] **Step 4: Implement grid sections**

`NutrientGrid` renders:

- default `micronutrients`
- expandable `moreNutrients`
- `VitaminDCard` from `educationCards`

Hidden `moreNutrients` cards must not mount their trend queries until the section is expanded.

- [ ] **Step 5: Add Vitamin D and caveat i18n**

Add keys:

- `nutrition.education.vitaminD.title`
- `nutrition.education.vitaminD.body`
- `nutrition.caveats.sodium`
- `nutrition.caveats.vitaminABetaCarotene`
- `nutrition.confidence.normal`
- `nutrition.confidence.limitedData`
- `nutrition.confidence.warningPoints`
- `nutrition.confidence.insufficientData`
- `nutrition.targetSources.vietnamRda`
- `nutrition.targetSources.whoFao`
- `nutrition.targetSources.unsupported`
- `nutrition.nutrients.calcium`
- `nutrition.nutrients.iron`
- `nutrition.nutrients.vitaminC`
- `nutrition.nutrients.phosphorus`
- `nutrition.nutrients.vitaminB1`
- `nutrition.nutrients.vitaminB2`
- `nutrition.nutrients.vitaminPp`
- `nutrition.nutrients.vitaminA`
- `nutrition.nutrients.sodium`
- `nutrition.nutrients.magnesium`
- `nutrition.nutrients.potassium`
- `nutrition.nutrients.zinc`
- `nutrition.nutrients.copper`
- `nutrition.nutrients.manganese`
- `nutrition.nutrients.vitaminB12`
- `nutrition.nutrients.vitaminB9`
- `nutrition.nutrients.vitaminB5`
- `nutrition.nutrients.vitaminB6`
- `nutrition.nutrients.vitaminE`
- `nutrition.nutrients.vitaminK`
- `nutrition.nutrients.betaCarotene`
- `nutrition.trend.pointMode`
- `nutrition.trend.insufficientData`

- [ ] **Step 6: Run nutrient UI tests**

```bash
bun run test components/nutrition/nutrient-card.test.tsx
```

Expected: PASS.

- [ ] **Step 7: Commit nutrient UI**

```bash
git add components/nutrition messages/en.json messages/vi.json
git commit -m "feat: add nutrition nutrient insights" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 4.4: Add lazy food-source candidates panel

**Files:**
- Create: `components/nutrition/food-source-candidates-panel.tsx`
- Test: `components/nutrition/food-source-candidates-panel.test.tsx`
- Modify: `components/nutrition/nutrient-card.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`

- [ ] **Step 1: Write failing candidate panel tests**

Test expectations:

- no candidate query fires before panel opens
- query fires for a supported below-target nutrient with confidence `>= 40%`
- panel is hidden for unsupported nutrient or confidence `< 40%`
- copy says “foods to consider,” not prescriptions
- panel title and description come from `nutrition.candidates.title` and `nutrition.candidates.description`

- [ ] **Step 2: Run test to verify it fails**

```bash
bun run test components/nutrition/food-source-candidates-panel.test.tsx
```

Expected: FAIL because panel does not exist.

- [ ] **Step 3: Implement candidate panel**

Use:

```tsx
const canShowCandidates =
  card.supportsCandidates &&
  card.confidence >= 40 &&
  card.percentOfTarget != null &&
  card.percentOfTarget < 90;

const candidateNutrient = SUPPORTED_CANDIDATE_NUTRIENTS.includes(
  card.nutrient as SupportedCandidateNutrient
)
  ? (card.nutrient as SupportedCandidateNutrient)
  : null;

const candidatesQuery = useQuery({
  queryKey: ['nutrition', 'candidates', candidateNutrient],
  queryFn: () => {
    if (!candidateNutrient) {
      throw new Error('Unsupported nutrition candidate nutrient.');
    }
    return getFoodSourceCandidates({ nutrient: candidateNutrient });
  },
  enabled: open && canShowCandidates && candidateNutrient !== null,
});
```

Render:

- panel title from `nutrition.candidates.title`
- panel description from `nutrition.candidates.description`
- candidate name
- serving note
- rationale
- optional caution

Do not render supplement recommendations.

- [ ] **Step 4: Add complete candidate i18n content**

For every candidate id in `CURATED_FOOD_SOURCE_CANDIDATES`, add English and Vietnamese
keys for `name`, `serving`, `rationale`, and optional `caution`. Use this checklist
when editing `messages/en.json` and `messages/vi.json`:

```json
"nutrition": {
  "candidates": {
    "ironMg": {
      "leanBeef": {
        "name": "Lean beef",
        "serving": "Try a palm-sized cooked portion.",
        "rationale": "Adds heme iron that is easier to absorb than plant iron."
      }
    }
  }
}
```

Required candidate ids by nutrient:

| Nutrient | Candidate ids |
|----------|---------------|
| `calciumMg` | `tofu`, `smallFishWithBones`, `yogurt`, `mustardGreens`, `soyMilk` |
| `ironMg` | `clams`, `leanBeef`, `porkLiver`, `waterSpinach`, `mungBeans` |
| `vitaminCMg` | `guava`, `pomelo`, `papaya`, `mustardGreens`, `freshHerbs` |
| `phosphorusMg` | `fish`, `eggs`, `tofu`, `chicken`, `peanuts` |
| `vitaminB1Mg` | `pork`, `mungBeans`, `brownRice`, `peanuts`, `soybeans` |
| `vitaminB2Mg` | `eggs`, `yogurt`, `porkLiver`, `fish`, `mushrooms` |
| `vitaminPpMg` | `chicken`, `fish`, `peanuts`, `leanPork`, `mushrooms` |
| `vitaminAMcg` | `carrots`, `pumpkin`, `sweetPotato`, `eggYolk`, `darkLeafyGreens` |

Add `caution` copy for `ironMg.porkLiver` and `vitaminB2Mg.porkLiver`.
Also add these panel-level keys:

- `nutrition.candidates.title`
- `nutrition.candidates.description`

Preserve JSON structure and include all keys in both locale files.
After editing messages, add/extend the candidate panel test to iterate over
`CURATED_FOOD_SOURCE_CANDIDATES` and assert every `nameKey`, `servingKey`,
`rationaleKey`, and optional `cautionKey` resolves to a non-empty localized string
for both English and Vietnamese test message fixtures.

- [ ] **Step 5: Run panel tests**

```bash
bun run test components/nutrition/food-source-candidates-panel.test.tsx
```

Expected: PASS.

- [ ] **Step 6: Commit candidates UI**

```bash
git add components/nutrition/food-source-candidates-panel.tsx components/nutrition/food-source-candidates-panel.test.tsx components/nutrition/nutrient-card.tsx messages/en.json messages/vi.json
git commit -m "feat: add nutrition food candidate panel" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

## Chunk 5: Integration, Polish, and Verification

### Task 5.1: Wire complete page composition and empty/error states

**Files:**
- Modify: `components/nutrition/nutrition-shell.tsx`
- Modify: `components/nutrition/nutrient-grid.tsx`
- Create: `components/nutrition/empty-state.tsx`
- Create: `components/nutrition/inline-error.tsx`
- Modify: `messages/en.json`
- Modify: `messages/vi.json`
- Test: `components/nutrition/nutrition-shell.test.tsx`

- [ ] **Step 1: Add tests for no-meals and too-few-days states**

Assert:

- no meals links to `/logging`
- `trendStatus: 'too_few_logged_days'` avoids trend-claim copy
- `trendStatus: 'too_few_logged_days'` still renders average macro values and nutrient cards
- shell renders `NutrientGrid` with default micronutrients, expandable more nutrients, `VitaminDCard`, and candidate-capable cards from overview data
- `NutrientCard` receives `resolvedRange`, not raw `range: 'auto'`, for trend loading
- action errors render localized inline error and retry button
- action errors trigger `sonner` toast with localized copy

- [ ] **Step 2: Run tests to verify they fail if states are missing**

```bash
bun run test components/nutrition/nutrition-shell.test.tsx
```

Expected: FAIL until states are implemented.

- [ ] **Step 3: Wire final page composition and states**

Use existing UI patterns:

- `sonner` toast for query errors using `nutrition.errors.overview`
- `components/nutrition/inline-error.tsx` renders localized error text and a retry button that calls `overviewQuery.refetch()`
- no native `alert()`, `confirm()`, or `prompt()`
- link to `/logging` for no meals
- render `NutrientGrid` below `MacroPatternSection`
- pass `overviewQuery.data.micronutrients`, `moreNutrients`, and `educationCards` into `NutrientGrid`
- pass `resolvedRange` and `timezoneOffset` through `NutritionShell -> NutrientGrid -> NutrientCard`
- ensure too-few-days copy is informational only; do not hide averages, macro cards, or nutrient cards
- ensure candidate affordances remain controlled by each `NutrientCard`'s `supportsCandidates`, confidence, and percent-of-target gating

Add these keys in both locale files:

- `nutrition.errors.overview`
- `nutrition.errors.retry`
- `nutrition.empty.title`
- `nutrition.empty.description`
- `nutrition.empty.logMeal`
- `nutrition.trends.tooFewDays`

- [ ] **Step 4: Run shell tests**

```bash
bun run test components/nutrition/nutrition-shell.test.tsx
```

Expected: PASS.

- [ ] **Step 5: Commit state handling**

```bash
git add components/nutrition messages/en.json messages/vi.json
git commit -m "feat: add nutrition empty and error states" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

---

### Task 5.2: Run targeted and full validation

**Files:** Potential formatting-only updates from Biome.

- [ ] **Step 1: Run focused nutrition tests**

```bash
bun run test lib/nutrition components/nutrition
```

Expected: all nutrition domain and component tests pass.

- [ ] **Step 2: Run impacted existing tests**

```bash
bun run test components/app/main-sidebar.test.tsx
```

Expected: sidebar/navigation tests pass.

- [ ] **Step 3: Run full Vitest suite**

```bash
bun run test
```

Expected: all tests pass.

- [ ] **Step 4: Run Biome autofix**

```bash
bunx @biomejs/biome check --write .
```

Expected: formatting/lint fixes applied or no changes needed.

- [ ] **Step 5: Run final Biome check**

```bash
bunx @biomejs/biome check .
```

Expected: no diagnostics.

- [ ] **Step 6: Re-run tests if Biome wrote changes**

If Step 4 changed any files, run:

```bash
bun run test lib/nutrition components/nutrition components/app/main-sidebar.test.tsx
bun run test
```

Expected: all tests still pass after formatting/lint fixes.

- [ ] **Step 7: Commit validation fixes if any**

```bash
git status --short
git add .
git commit -m "chore: format nutrition page implementation" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Only commit if Step 4 created changes.

---

### Task 5.3: Manual implementation review

**Files:** None unless review finds defects.

- [ ] **Step 1: Check no out-of-scope features landed**

Verify:

- no supplement recommendations
- no diagnosis/disease claims
- no precomputed rollup table or migration
- no live inverse food ranking
- no hardcoded user-facing strings in components
- no daily trend arrays in `getNutritionOverview`

- [ ] **Step 2: Inspect git diff**

```bash
git --no-pager diff main...HEAD --stat
git --no-pager diff main...HEAD -- lib/nutrition components/nutrition 'app/[locale]/(app)/nutrition/page.tsx' components/app/main-sidebar.tsx messages/en.json messages/vi.json | sed -n '1,260p'
```

Expected: changes align with this plan and approved spec.

- [ ] **Step 3: Final implementation commit if review fixes were needed**

```bash
git add .
git commit -m "fix: address nutrition page review findings" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
```

Only commit if review fixes were needed.

---

## Execution Notes

- Do not edit `components/ui/*`; use existing shadcn/ui components as-is.
- Do not add dependencies unless absolutely necessary.
- Do not add database migrations for v1.
- Do not run `bun dev`, `bun run build`, or `bun start` unless explicitly requested.
- Always use aliases like `@/lib/nutrition/...`, not deep relative imports across feature boundaries.
- Keep user-facing text in `messages/en.json` and `messages/vi.json`.
- Server-side Drizzle queries must be scoped by `user_id`; do not rely on RLS for app code.
