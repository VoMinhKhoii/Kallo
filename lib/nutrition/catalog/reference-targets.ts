import type {
  NutrientType,
  NutritionNutrientKey,
  TargetSource,
} from '../types';
import { NUTRIENT_META } from './nutrients';
import {
  type AgeBand,
  type BiologicalSex,
  NASEM_DRI,
  REFERENCE_SOURCES,
  TARGET_KEYS,
  type TargetEntry,
  type TargetRow,
  VIETNAM_RDA,
  WHO_FAO,
} from './reference-target-tables';

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
  nutrientType: NutrientType;
}

function isAgeBanded(entry: TargetEntry): entry is { ageBands: AgeBand[] } {
  return 'ageBands' in entry;
}

function resolveAgeBand(
  entry: { ageBands: AgeBand[] },
  age: number | null
): TargetRow {
  // When age is unknown, default to the youngest adult band (last in list,
  // since bands are sorted DESC). This matches existing behavior for iron:
  // we only require a known age when crossing thresholds materially changes
  // the recommendation. Callers that need stricter handling can short-circuit.
  if (age === null || !Number.isFinite(age)) {
    return entry.ageBands[entry.ageBands.length - 1].row;
  }
  for (const band of entry.ageBands) {
    if (age >= band.minAge) return band.row;
  }
  return entry.ageBands[entry.ageBands.length - 1].row;
}

// Nutrient direction:
// 'floor' = should hit/exceed target (RDAs for vitamins, minerals, protein, fiber).
// 'ceiling' = should stay under (sodium, sat-fat caps).
// 'range' = exceeding in either direction is bad (e.g. calories on maintenance).
// Default for any unlisted nutrient is 'floor' (the safe assumption for RDA-type targets).
const NUTRIENT_TYPE_OVERRIDES: Partial<
  Record<NutritionNutrientKey, NutrientType>
> = {
  sodiumMg: 'ceiling',
};

function getNutrientType(key: NutritionNutrientKey): NutrientType {
  return NUTRIENT_TYPE_OVERRIDES[key] ?? 'floor';
}

export { getNutrientType };

function isVietnameseContext(profile: NutritionProfileForTargets): boolean {
  const vietnamValues = new Set(['VN', 'VIETNAM', 'VIET NAM']);

  return [profile.countryOfOrigin, profile.countryOfResidence]
    .filter(Boolean)
    .some((country) => {
      if (!country) return false;
      const stripped = country
        .normalize('NFD')
        .replace(/\p{M}/gu, '')
        .trim()
        .toUpperCase();
      return vietnamValues.has(stripped);
    });
}

function resolveBiologicalSex(value: string | null): BiologicalSex | null {
  if (value === 'male' || value === 'female') {
    return value;
  }

  return null;
}

/// Round a derived (averaged) target to a sensible precision: whole numbers at
/// scale, one decimal for small values like vitamin B6 (~2.1 mg).
function roundTarget(value: number): number {
  return value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
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
    nutrientType: getNutrientType(key),
  };
}

export function resolveMicronutrientTargets(
  profile: NutritionProfileForTargets
): Record<NutritionNutrientKey, MicronutrientTarget> {
  const vietnameseContext = isVietnameseContext(profile);
  const sex = resolveBiologicalSex(profile.biologicalSex);
  const targets = Object.fromEntries(
    Object.keys(NUTRIENT_META).map((key) => [
      key,
      createUnsupportedTarget(key as NutritionNutrientKey),
    ])
  ) as Record<NutritionNutrientKey, MicronutrientTarget>;

  for (const key of TARGET_KEYS) {
    if (key === 'vitaminHMcg') {
      targets[key] = {
        key,
        value: null,
        unit: 'mcg',
        source: 'unsupported',
        sourceLabelKey: 'nutrition.targetSources.unsupported',
        applicability: 'hidden',
        nutrientType: getNutrientType(key),
      };
      continue;
    }

    // Resolve the source map + entry. VN context uses VIETNAM_RDA only;
    // non-VN context tries WHO/FAO first then falls back to NASEM/IOM
    // for the nutrients WHO does not publish (Cu, Mn, Na, K, P).
    let source: Exclude<TargetSource, 'unsupported'>;
    let entry: TargetEntry | undefined;
    if (vietnameseContext) {
      entry = VIETNAM_RDA[key];
      source = 'vietnam_rda';
    } else if (WHO_FAO[key]) {
      entry = WHO_FAO[key];
      source = 'who_fao';
    } else {
      entry = NASEM_DRI[key];
      source = 'nasem';
    }

    if (!entry) {
      targets[key] = createUnsupportedTarget(key);
      continue;
    }

    const targetRow = isAgeBanded(entry)
      ? resolveAgeBand(entry, profile.age)
      : entry;

    // When biological sex is unknown we still give a usable target instead of
    // "no target": the sex-neutral mean of the male/female RDA. For
    // sex-independent nutrients the mean equals either value, so this is a
    // no-op there.
    let value: number | null;
    let unit: (typeof targetRow.male)['unit'];
    if (sex) {
      const target = targetRow[sex];
      value = target.value;
      unit = target.unit;
    } else {
      value = roundTarget((targetRow.male.value + targetRow.female.value) / 2);
      unit = targetRow.male.unit;
    }

    targets[key] = {
      key,
      value,
      unit,
      source,
      sourceLabelKey: REFERENCE_SOURCES[source].labelKey,
      applicability: 'scored',
      nutrientType: getNutrientType(key),
    };
  }

  return targets;
}
