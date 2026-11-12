import type {
  NutrientType,
  NutritionNutrientKey,
  TargetSource,
} from '../types';
import { NUTRIENT_META } from './nutrients';
import {
  type AgeBand,
  type BiologicalSex,
  ENERGY_SCALED_TARGETS,
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
  calorieTarget?: number | null;
}

export interface MicronutrientTarget {
  key: NutritionNutrientKey;
  value: number | null;
  unit: 'g' | 'mg' | 'mcg';
  source: TargetSource;
  sourceLabelKey: string;
  applicability: 'scored' | 'educational' | 'hidden' | 'unsupported';
  nutrientType: NutrientType;
}

function isAgeBanded(entry: TargetEntry): entry is { ageBands: AgeBand[] } {
  return 'ageBands' in entry;
}

/** The age an unknown age scores as. We only require a known age when crossing
 * a threshold materially changes the recommendation, so a profile without one
 * is read as a young adult — the population every published table centres on.
 * 20, not 19: the VN 2016 tables put 19 in their 15–19 teen band. */
const ASSUMED_ADULT_AGE = 20;

function resolveAgeBand(
  entry: { ageBands: AgeBand[] },
  age: number | null
): TargetRow {
  // An unknown age resolves the SAME way a 20-year-old does, said out loud.
  // This used to be "take the last band", which was only ever young-adult by
  // coincidence: it holds for a two-band [50+, 0] table, where the catch-all IS
  // the adult row, and breaks the moment a table publishes child bands below it
  // — fiber had to carry a duplicate adult row at `minAge: 0` to survive it.
  if (age === null || !Number.isFinite(age)) {
    return resolveAgeBand(entry, ASSUMED_ADULT_AGE);
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

/// A target its source states per 1000 kcal (ENERGY_SCALED_TARGETS) rises with
/// the user's calorie target. The table value stays the floor: it already
/// assumed an ordinary intake, and a cut should not lower a vitamin target.
function applyEnergyRate(
  value: number,
  key: NutritionNutrientKey,
  source: Exclude<TargetSource, 'unsupported'>,
  calorieTarget: number | null | undefined
): number {
  const rate = ENERGY_SCALED_TARGETS[source]?.[key];
  if (rate === undefined || !calorieTarget || calorieTarget <= 0) {
    return value;
  }
  return Math.max(value, roundTarget((rate * calorieTarget) / 1000));
}

function getDefaultUnit(key: NutritionNutrientKey): 'g' | 'mg' | 'mcg' {
  // Mirror the catalog unit when it is one a target can be expressed in
  // (fiber's card unit is 'g'); 'kcal' has no target unit, so fall back to mg.
  const unit = NUTRIENT_META[key].unit;
  return unit === 'g' || unit === 'mcg' ? unit : 'mg';
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

    // Resolve the source map + entry. VN context prefers VIETNAM_RDA; every
    // other context tries WHO/FAO first, then falls back to NASEM/IOM for the
    // nutrients WHO does not publish (Cu, Mn, Na, K, P).
    // A VN key missing from VIETNAM_RDA falls through the same chain: today
    // only fiber takes that VN → NASEM path (every other target key is in
    // VIETNAM_RDA), so Vietnamese users get a NASEM-sourced fiber target
    // rather than none.
    let source: Exclude<TargetSource, 'unsupported'>;
    let entry: TargetEntry | undefined;
    if (vietnameseContext && VIETNAM_RDA[key]) {
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
      value: applyEnergyRate(value, key, source, profile.calorieTarget),
      unit,
      source,
      sourceLabelKey: REFERENCE_SOURCES[source].labelKey,
      applicability: 'scored',
      nutrientType: getNutrientType(key),
    };
  }

  return targets;
}
