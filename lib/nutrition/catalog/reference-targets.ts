import type {
  NutrientType,
  NutritionNutrientKey,
  TargetSource,
} from '../types';
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
  nutrientType: NutrientType;
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
  nasem: {
    id: 'nasem',
    label: 'NASEM DRI',
    labelKey: 'nutrition.targetSources.nasem',
    citation:
      'National Academies of Sciences, Engineering, and Medicine — Dietary Reference Intakes',
    version: '1997–2019',
  },
};

type TargetRow = Record<
  BiologicalSex,
  {
    value: number;
    unit: 'mg' | 'mcg';
  }
>;

// An age-banded entry resolves the right TargetRow based on profile.age.
// Bands are evaluated in order; the first whose `minAge` is <= age wins.
// Always include a band with `minAge: 0` as the catch-all default (so missing
// ages still resolve to the youngest-adult band rather than dropping to
// `unsupported`). Bands must be listed in DESCENDING `minAge` order.
interface AgeBand {
  minAge: number;
  row: TargetRow;
}
type TargetEntry = TargetRow | { ageBands: AgeBand[] };

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

const VIETNAM_RDA: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  // Macro-minerals & trace minerals (Bộ Y tế / VDD 2016)
  calciumMg: {
    male: { value: 1000, unit: 'mg' },
    female: { value: 1000, unit: 'mg' },
  },
  ironMg: {
    male: { value: 10, unit: 'mg' },
    female: { value: 24, unit: 'mg' },
  },
  magnesiumMg: {
    // Bảng 18, RDA, 20–29 yr.
    male: { value: 340, unit: 'mg' },
    female: { value: 270, unit: 'mg' },
  },
  phosphorusMg: {
    male: { value: 700, unit: 'mg' },
    female: { value: 700, unit: 'mg' },
  },
  potassiumMg: {
    // Bảng 47, AI, 20–29 yr.
    male: { value: 2500, unit: 'mg' },
    female: { value: 2000, unit: 'mg' },
  },
  sodiumMg: {
    // Bảng 46, "Mục tiêu chế độ ăn (DG)" <2000 mg/day for adults — VN
    // adopts the WHO Guideline 2012 ceiling. Treated as ceiling target.
    male: { value: 2000, unit: 'mg' },
    female: { value: 2000, unit: 'mg' },
  },
  zincMg: {
    // Bảng 20, RDA, moderate-absorption tier (mixed VN diet).
    male: { value: 10, unit: 'mg' },
    female: { value: 8, unit: 'mg' },
  },
  copperMcg: {
    // Bảng 23, RDA, 20–29 yr.
    male: { value: 900, unit: 'mcg' },
    female: { value: 900, unit: 'mcg' },
  },
  manganeseMg: {
    // Bảng 25, AI, 20–29 yr (sourced by VN MoH from IOM 2006).
    male: { value: 2.3, unit: 'mg' },
    female: { value: 1.8, unit: 'mg' },
  },
  // Vitamins
  vitaminAMcg: {
    male: { value: 850, unit: 'mcg' },
    female: { value: 700, unit: 'mcg' },
  },
  vitaminDMcg: {
    // Bảng 28, RDA. Age split at 50: 19–49 → 15 µg, ≥50 → 20 µg.
    ageBands: [
      {
        minAge: 50,
        row: {
          male: { value: 20, unit: 'mcg' },
          female: { value: 20, unit: 'mcg' },
        },
      },
      {
        minAge: 0,
        row: {
          male: { value: 15, unit: 'mcg' },
          female: { value: 15, unit: 'mcg' },
        },
      },
    ],
  },
  vitaminEMg: {
    // Bảng 29, AI for α-tocopherol, 20–29 yr.
    male: { value: 6.5, unit: 'mg' },
    female: { value: 6.0, unit: 'mg' },
  },
  vitaminKMcg: {
    // Bảng 30, AI, 20–29 yr.
    male: { value: 150, unit: 'mcg' },
    female: { value: 150, unit: 'mcg' },
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
  vitaminB5Mg: {
    // Bảng 36, RDA — sex-independent.
    male: { value: 5, unit: 'mg' },
    female: { value: 5, unit: 'mg' },
  },
  vitaminB6Mg: {
    // Bảng 37, RDA. Age split at 50.
    ageBands: [
      {
        minAge: 50,
        row: {
          male: { value: 1.7, unit: 'mg' },
          female: { value: 1.5, unit: 'mg' },
        },
      },
      {
        minAge: 0,
        row: {
          male: { value: 1.3, unit: 'mg' },
          female: { value: 1.3, unit: 'mg' },
        },
      },
    ],
  },
  vitaminB9Mcg: {
    // Bảng 38, RDA, 20–29 yr (µg DFE).
    male: { value: 400, unit: 'mcg' },
    female: { value: 400, unit: 'mcg' },
  },
  vitaminB12Mcg: {
    // Bảng 39, RDA.
    male: { value: 2.4, unit: 'mcg' },
    female: { value: 2.4, unit: 'mcg' },
  },
};

const WHO_FAO: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  calciumMg: {
    male: { value: 1000, unit: 'mg' },
    female: { value: 1000, unit: 'mg' },
  },
  ironMg: {
    male: { value: 9, unit: 'mg' },
    female: { value: 18, unit: 'mg' },
  },
  magnesiumMg: {
    // Annex 1, adults 19–65 yr.
    male: { value: 260, unit: 'mg' },
    female: { value: 220, unit: 'mg' },
  },
  // Phosphorus, sodium, potassium, copper, manganese: WHO/FAO 2004 does
  // not publish RNIs. Falls through to NASEM_DRI (see resolver).
  zincMg: {
    // Annex 1, moderate-bioavailability column, adults 19–65 yr.
    male: { value: 7.0, unit: 'mg' },
    female: { value: 4.9, unit: 'mg' },
  },
  vitaminAMcg: {
    // Annex 2 RNI for adults 19–65 y (RE).
    male: { value: 600, unit: 'mcg' },
    female: { value: 500, unit: 'mcg' },
  },
  vitaminDMcg: {
    // Annex 2. WHO publishes 3 bands: 19–50 → 5 µg, 51–65 → 10 µg, 65+ → 15 µg.
    ageBands: [
      {
        minAge: 65,
        row: {
          male: { value: 15, unit: 'mcg' },
          female: { value: 15, unit: 'mcg' },
        },
      },
      {
        minAge: 51,
        row: {
          male: { value: 10, unit: 'mcg' },
          female: { value: 10, unit: 'mcg' },
        },
      },
      {
        minAge: 0,
        row: {
          male: { value: 5, unit: 'mcg' },
          female: { value: 5, unit: 'mcg' },
        },
      },
    ],
  },
  vitaminEMg: {
    // Annex 2, mg α-TE, adults.
    male: { value: 10, unit: 'mg' },
    female: { value: 7.5, unit: 'mg' },
  },
  vitaminKMcg: {
    // Annex 2, adults 19–65 yr.
    male: { value: 65, unit: 'mcg' },
    female: { value: 55, unit: 'mcg' },
  },
  vitaminCMg: {
    male: { value: 45, unit: 'mg' },
    female: { value: 45, unit: 'mg' },
  },
  vitaminB1Mg: {
    male: { value: 1.2, unit: 'mg' },
    female: { value: 1.1, unit: 'mg' },
  },
  vitaminB2Mg: {
    male: { value: 1.3, unit: 'mg' },
    female: { value: 1.1, unit: 'mg' },
  },
  vitaminPpMg: {
    male: { value: 16, unit: 'mg' },
    female: { value: 14, unit: 'mg' },
  },
  vitaminB5Mg: {
    // Annex 2 — sex-independent.
    male: { value: 5, unit: 'mg' },
    female: { value: 5, unit: 'mg' },
  },
  vitaminB6Mg: {
    // Annex 2. Age split at 50.
    ageBands: [
      {
        minAge: 50,
        row: {
          male: { value: 1.7, unit: 'mg' },
          female: { value: 1.5, unit: 'mg' },
        },
      },
      {
        minAge: 0,
        row: {
          male: { value: 1.3, unit: 'mg' },
          female: { value: 1.3, unit: 'mg' },
        },
      },
    ],
  },
  vitaminB9Mcg: {
    // Annex 2 — µg DFE, sex-independent.
    male: { value: 400, unit: 'mcg' },
    female: { value: 400, unit: 'mcg' },
  },
  vitaminB12Mcg: {
    male: { value: 2.4, unit: 'mcg' },
    female: { value: 2.4, unit: 'mcg' },
  },
};

// NASEM/IOM Dietary Reference Intakes — used only as fallback for nutrients
// where WHO/FAO 2004 does not publish a value (copper, manganese, sodium,
// potassium, phosphorus). Adults 19–50 y unless noted.
const NASEM_DRI: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  copperMcg: {
    // IOM 2001 RDA, adults.
    male: { value: 900, unit: 'mcg' },
    female: { value: 900, unit: 'mcg' },
  },
  manganeseMg: {
    // IOM 2001 AI, adults.
    male: { value: 2.3, unit: 'mg' },
    female: { value: 1.8, unit: 'mg' },
  },
  phosphorusMg: {
    // IOM 1997 RDA, adults — same value used by VN.
    male: { value: 700, unit: 'mg' },
    female: { value: 700, unit: 'mg' },
  },
  potassiumMg: {
    // NASEM 2019 AI, adults.
    male: { value: 3400, unit: 'mg' },
    female: { value: 2600, unit: 'mg' },
  },
  sodiumMg: {
    // NASEM 2019 CDRR (Chronic Disease Risk Reduction): reduce intake
    // when above 2300 mg/day. Treated as ceiling.
    male: { value: 2300, unit: 'mg' },
    female: { value: 2300, unit: 'mg' },
  },
};

const TARGET_KEYS: NutritionNutrientKey[] = [
  // Macros & default 8 (already shipped)
  'calciumMg',
  'ironMg',
  'phosphorusMg',
  'vitaminAMcg',
  'vitaminCMg',
  'vitaminB1Mg',
  'vitaminB2Mg',
  'vitaminPpMg',
  // Newly promoted from MORE_NUTRIENTS
  'sodiumMg',
  'magnesiumMg',
  'potassiumMg',
  'zincMg',
  'copperMcg',
  'manganeseMg',
  'vitaminB5Mg',
  'vitaminB6Mg',
  'vitaminB9Mcg',
  'vitaminB12Mcg',
  'vitaminEMg',
  'vitaminKMcg',
  // Promoted from educational pull-quote — pull-quote stays in
  // educationCards, but the row also gets a real scored target.
  'vitaminDMcg',
  // Hidden bookkeeping nutrient.
  'vitaminHMcg',
];

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
      // Iron in VN context for women splits at age 50 (postmenopausal RDA
      // drops 24 → 10 mg). Age-unknown women keep the premenopausal 24.
      value =
        key === 'ironMg' &&
        source === 'vietnam_rda' &&
        sex === 'female' &&
        (profile.age ?? 0) >= 50
          ? 10
          : target.value;
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
