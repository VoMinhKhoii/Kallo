import { NUTRIENT_META } from './nutrients';
import type { NutritionNutrientKey, TargetSource } from './types';

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

function resolveBiologicalSex(value: string | null): BiologicalSex | null {
  if (value === 'male' || value === 'female') {
    return value;
  }

  return null;
}

function isSexIndependentTarget(targetRow: TargetRow): boolean {
  return (
    targetRow.male.value === targetRow.female.value &&
    targetRow.male.unit === targetRow.female.unit
  );
}

function getDefaultUnit(key: NutritionNutrientKey): 'mg' | 'mcg' {
  return NUTRIENT_META[key].unit === 'mcg' ? 'mcg' : 'mg';
}

function createUnsupportedTarget(
  key: NutritionNutrientKey
): MicronutrientTarget {
  return {
    key,
    value: null,
    unit: getDefaultUnit(key),
    source: 'unsupported',
    sourceLabelKey: 'nutrition.targetSources.unsupported',
    applicability: 'unsupported',
  };
}

export function resolveMicronutrientTargets(
  profile: NutritionProfileForTargets
): Record<NutritionNutrientKey, MicronutrientTarget> {
  const vietnameseContext = isVietnameseContext(profile);
  const sourceTable = vietnameseContext ? VIETNAM_RDA : WHO_FAO;
  const source: Exclude<TargetSource, 'unsupported'> = vietnameseContext
    ? 'vietnam_rda'
    : 'who_fao';
  const sex = resolveBiologicalSex(profile.biologicalSex);
  const targets = Object.fromEntries(
    Object.keys(NUTRIENT_META).map((key) => [
      key,
      createUnsupportedTarget(key as NutritionNutrientKey),
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

    const targetRow = sourceTable[key];
    if (!targetRow) {
      targets[key] = createUnsupportedTarget(key);
      continue;
    }

    if (!sex && !isSexIndependentTarget(targetRow)) {
      targets[key] = createUnsupportedTarget(key);
      continue;
    }

    const target = targetRow[sex ?? 'male'];
    if (
      key === 'ironMg' &&
      source === 'vietnam_rda' &&
      sex === 'female' &&
      (profile.age === null || !Number.isFinite(profile.age))
    ) {
      targets[key] = createUnsupportedTarget(key);
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
