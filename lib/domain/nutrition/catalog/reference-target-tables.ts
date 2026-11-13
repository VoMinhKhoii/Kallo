/**
 * Published micronutrient reference tables — Vietnam MoH RDA, WHO/FAO RNI and
 * NASEM/IOM DRI — plus the shapes that describe them. Data only, every row
 * carrying its citation; the profile→target resolution logic that reads these
 * lives in `reference-targets.ts`.
 */
import type { NutritionNutrientKey, TargetSource } from '../types';

export type BiologicalSex = 'male' | 'female';

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

export type TargetRow = Record<
  BiologicalSex,
  {
    value: number;
    unit: 'g' | 'mg' | 'mcg';
  }
>;

// An age-banded entry resolves the right TargetRow based on profile.age.
// Bands are evaluated in order; the first whose `minAge` is <= age wins.
// Always include a band with `minAge: 0` as the catch-all, so an age below
// everything the source publishes still resolves rather than dropping to
// `unsupported`. It is the LOWEST published band that carries that floor — an
// unknown age no longer lands here at all: `resolveAgeBand` scores it as a
// young adult explicitly (ASSUMED_ADULT_AGE), so no table needs a duplicate
// adult row at the bottom to be read correctly.
// Bands must be listed in DESCENDING `minAge` order.
export interface AgeBand<Row = TargetRow> {
  minAge: number;
  row: Row;
}
export type TargetEntry = TargetRow | { ageBands: AgeBand[] };

/** One published row: the male and female value in the same unit. */
function perSex(
  male: number,
  female: number,
  unit: 'g' | 'mg' | 'mcg'
): TargetRow {
  return { male: { value: male, unit }, female: { value: female, unit } };
}

/** Age bands in the descending `[minAge, row]` order `AgeBand` needs. */
function bands(...entries: [number, TargetRow][]): { ageBands: AgeBand[] } {
  return { ageBands: entries.map(([minAge, row]) => ({ minAge, row })) };
}

// Vietnam Ministry of Health / National Institute of Nutrition, "Nhu cầu dinh
// dưỡng khuyến nghị cho người Việt Nam" (2016). Every value below is the RDA or
// AI the book prints for that table and age band, copied as printed. Onboarding
// starts at 13 (`bodyMetricsSchema`), so each entry's `minAge: 0` catch-all is
// the book's 12–14 row, the youngest band Kallo serves.
export const VIETNAM_RDA: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  // Bảng 16, RDA.
  calciumMg: bands(
    [70, perSex(1000, 1000, 'mg')],
    [50, perSex(800, 900, 'mg')],
    [20, perSex(800, 800, 'mg')],
    [0, perSex(1000, 1000, 'mg')]
  ),
  // Bảng 19, RDA for a diet of medium iron bioavailability (~10% absorbed:
  // 30–90 g meat or fish, or 25–75 mg vitamin C a day), the same middle tier
  // zinc uses. Women 50–69 take the post-menopause row; girls 12–14 the
  // menstruating row, since onboarding starts at 13.
  ironMg: bands(
    [70, perSex(11.0, 9.4, 'mg')],
    [50, perSex(11.9, 10.0, 'mg')],
    [20, perSex(11.9, 26.1, 'mg')],
    [15, perSex(17.5, 29.7, 'mg')],
    [0, perSex(15.3, 32.6, 'mg')]
  ),
  // Bảng 18, RDA.
  magnesiumMg: bands(
    [70, perSex(320, 260, 'mg')],
    [50, perSex(350, 290, 'mg')],
    [30, perSex(370, 290, 'mg')],
    [20, perSex(340, 270, 'mg')],
    [15, perSex(350, 300, 'mg')],
    [0, perSex(290, 280, 'mg')]
  ),
  // Bảng 17, RDA.
  phosphorusMg: bands(
    [20, perSex(700, 700, 'mg')],
    [0, perSex(1250, 1250, 'mg')]
  ),
  // Bảng 47, AI.
  potassiumMg: bands(
    [20, perSex(2500, 2000, 'mg')],
    [15, perSex(2800, 2100, 'mg')],
    [0, perSex(2400, 2200, 'mg')]
  ),
  // Bảng 46, "Mục tiêu chế độ ăn (DG)" <2000 mg/day from 12 years up — VN
  // adopts the WHO Guideline 2012 ceiling. Treated as ceiling target.
  sodiumMg: perSex(2000, 2000, 'mg'),
  // Bảng 20, RDA, medium-absorption tier (mixed VN diet).
  zincMg: bands(
    [70, perSex(9.0, 7.0, 'mg')],
    [15, perSex(10.0, 8.0, 'mg')],
    [0, perSex(9.0, 8.0, 'mg')]
  ),
  // Bảng 23, RDA.
  copperMcg: bands(
    [20, perSex(900, 900, 'mcg')],
    [15, perSex(890, 890, 'mcg')],
    [0, perSex(700, 700, 'mcg')]
  ),
  // Bảng 25, AI.
  manganeseMg: bands(
    [20, perSex(2.3, 1.8, 'mg')],
    [15, perSex(2.2, 1.6, 'mg')],
    [0, perSex(1.9, 1.6, 'mg')]
  ),
  // Vitamins
  // Bảng 27, RDA (µg RAE).
  vitaminAMcg: bands(
    [70, perSex(800, 650, 'mcg')],
    [50, perSex(850, 700, 'mcg')],
    [30, perSex(900, 700, 'mcg')],
    [18, perSex(850, 650, 'mcg')],
    [15, perSex(900, 650, 'mcg')],
    [0, perSex(800, 700, 'mcg')]
  ),
  // Bảng 28, RDA.
  vitaminDMcg: bands([50, perSex(20, 20, 'mcg')], [0, perSex(15, 15, 'mcg')]),
  // Bảng 29, AI for α-tocopherol.
  vitaminEMg: bands([18, perSex(6.5, 6.0, 'mg')], [0, perSex(7.5, 6.0, 'mg')]),
  // Bảng 30, AI.
  vitaminKMcg: bands(
    [18, perSex(150, 150, 'mcg')],
    [15, perSex(160, 160, 'mcg')],
    [0, perSex(150, 150, 'mcg')]
  ),
  // Bảng 41, RDA.
  vitaminCMg: bands([15, perSex(100, 100, 'mg')], [0, perSex(95, 95, 'mg')]),
  // Bảng 31, RDA. Bảng 32 sets these for moderate activity at 0.5 mg per
  // 1000 kcal eaten; ENERGY_SCALED_TARGETS applies that rate above them.
  vitaminB1Mg: bands(
    [70, perSex(1.1, 1.0, 'mg')],
    [30, perSex(1.2, 1.0, 'mg')],
    [20, perSex(1.3, 1.1, 'mg')],
    [15, perSex(1.4, 1.2, 'mg')],
    [0, perSex(1.4, 1.3, 'mg')]
  ),
  // Bảng 33, RDA. Bảng 34: 0.6 mg per 1000 kcal eaten (ENERGY_SCALED_TARGETS).
  vitaminB2Mg: bands(
    [70, perSex(1.3, 1.1, 'mg')],
    [30, perSex(1.4, 1.2, 'mg')],
    [20, perSex(1.5, 1.2, 'mg')],
    [15, perSex(1.7, 1.4, 'mg')],
    [0, perSex(1.6, 1.4, 'mg')]
  ),
  // Bảng 35, RDA.
  vitaminPpMg: bands([15, perSex(16, 14, 'mg')], [0, perSex(12, 12, 'mg')]),
  // Bảng 36, RDA — sex-independent.
  vitaminB5Mg: bands([15, perSex(5, 5, 'mg')], [0, perSex(4, 4, 'mg')]),
  // Bảng 37, RDA.
  vitaminB6Mg: bands(
    [50, perSex(1.7, 1.5, 'mg')],
    [20, perSex(1.3, 1.3, 'mg')],
    [15, perSex(1.3, 1.2, 'mg')],
    [0, perSex(1.2, 1.1, 'mg')]
  ),
  // Bảng 38, RDA (µg DFE). The book prints 300 for boys 15–19 beside an EAR of
  // 320; an RDA cannot sit below its EAR, so that cell is read as the 400 the
  // adult and female rows carry.
  vitaminB9Mcg: bands(
    [15, perSex(400, 400, 'mcg')],
    [0, perSex(300, 400, 'mcg')]
  ),
  // Bảng 39, RDA.
  vitaminB12Mcg: perSex(2.4, 2.4, 'mcg'),
};

export const WHO_FAO: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  calciumMg: {
    male: { value: 1000, unit: 'mg' },
    female: { value: 1000, unit: 'mg' },
  },
  // Table 13.5, 15% bioavailability column. The book's bands are 11–14, 15–17
  // and 18+, plus postmenopausal women at 7.5 mg, read here as 51+.
  ironMg: bands(
    [51, perSex(9.1, 7.5, 'mg')],
    [18, perSex(9.1, 19.6, 'mg')],
    [15, perSex(12.5, 20.7, 'mg')],
    [0, perSex(9.7, 21.8, 'mg')]
  ),
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
export const NASEM_DRI: Partial<Record<NutritionNutrientKey, TargetEntry>> = {
  // NASEM 2005 Macronutrients DRI — total fiber, Adequate Intake by sex and
  // age (the 14 g / 1,000 kcal basis tabulated). WHO/FAO 2004 publishes no
  // fiber figure, and VN MoH 2016 Bảng 15 reprints this NASEM table, so every
  // context resolves it here.
  // Onboarding accepts ages from 13 up (`bodyMetricsSchema` in
  // `lib/domain/onboarding/schemas.ts`), so a profile CAN be a minor and the
  // adult AI would over-target them; the child bands below are the rest of the
  // published table, kept whole rather than truncated at 13.
  fiberG: {
    ageBands: [
      {
        minAge: 51,
        row: {
          male: { value: 30, unit: 'g' },
          female: { value: 21, unit: 'g' },
        },
      },
      {
        minAge: 19,
        row: {
          male: { value: 38, unit: 'g' },
          female: { value: 25, unit: 'g' },
        },
      },
      {
        minAge: 14,
        row: {
          male: { value: 38, unit: 'g' },
          female: { value: 26, unit: 'g' },
        },
      },
      {
        minAge: 9,
        row: {
          male: { value: 31, unit: 'g' },
          female: { value: 26, unit: 'g' },
        },
      },
      {
        minAge: 4,
        row: {
          male: { value: 25, unit: 'g' },
          female: { value: 25, unit: 'g' },
        },
      },
      {
        // The 1–3 y AI, doubling as this file's `minAge: 0` catch-all. NASEM
        // publishes nothing below 1 y (infants have an AI for total fat, not
        // fiber), so the youngest published band is the honest floor — there
        // is no separate infant row to lose. An age-unknown profile does NOT
        // land here: it resolves as a 20-year-old (see resolveAgeBand), which
        // is why the duplicate adult row that used to sit at the bottom of
        // this table is gone.
        minAge: 0,
        row: {
          male: { value: 19, unit: 'g' },
          female: { value: 19, unit: 'g' },
        },
      },
    ],
  },
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

/** EFSA states its energy-based values per MJ; 1 MJ is 1000/4.184 kcal. */
const PER_MJ_TO_PER_1000_KCAL = 4.184;

/**
 * Targets stated per 1000 kcal eaten, keyed by the table they sit on top of.
 * The table value stays the floor; a calorie target above the one the table
 * assumed raises it at this rate (`reference-targets.ts`).
 * - VN 2016 Bảng 32 and 34: B1 0.5 mg and B2 0.6 mg per 1000 kcal.
 * - EFSA, for the nutrients a table has no rate for: thiamin 0.1 mg/MJ (EFSA
 *   Journal 2016;14(12):4653) and niacin 1.6 mg NE/MJ (2014;12(7):3759). EFSA
 *   sets riboflavin as a flat 1.6 mg/day (2017;15(8):4919), so B2 has no rate
 *   outside Vietnam's table. WHO/FAO 2004 states none of the three per energy.
 * - NASEM's fiber AI, which is 14 g per 1000 kcal by definition.
 */
export const ENERGY_SCALED_TARGETS: Partial<
  Record<
    Exclude<TargetSource, 'unsupported'>,
    Partial<Record<NutritionNutrientKey, number>>
  >
> = {
  vietnam_rda: {
    vitaminB1Mg: 0.5,
    vitaminB2Mg: 0.6,
    vitaminPpMg: 1.6 * PER_MJ_TO_PER_1000_KCAL,
  },
  who_fao: {
    vitaminB1Mg: 0.1 * PER_MJ_TO_PER_1000_KCAL,
    vitaminPpMg: 1.6 * PER_MJ_TO_PER_1000_KCAL,
  },
  nasem: { fiberG: 14 },
};

/**
 * Iron is the one target its tables derive from body weight. Basal iron loss
 * is about 14 µg per kg per day (WHO/FAO 2004 §13.2.1; IOM 2001 eq. 1), and it
 * is an adult man's whole requirement, so his row divided by the reference
 * weight it assumes gives the dietary iron per kg at that table's
 * bioavailability. A person heavier or lighter than the reference loses that
 * much more or less, added to every row: menstrual losses do not depend on
 * weight. Capped at the 45 mg upper limit (IOM 2001, cited by VN 2016).
 */
export interface IronWeightRule {
  perKg: number;
  /** Reference body weight in kg, in the descending `minAge` order. */
  referenceWeights: AgeBand<Record<BiologicalSex, number>>[];
}

export const IRON_UPPER_LIMIT_MG = 45;

function weights(
  ...entries: [number, number, number][]
): IronWeightRule['referenceWeights'] {
  return entries.map(([minAge, male, female]) => ({
    minAge,
    row: { male, female },
  }));
}

export const IRON_WEIGHT_RULES: Partial<
  Record<Exclude<TargetSource, 'unsupported'>, IronWeightRule>
> = {
  // Bảng 19 says its iron is adjusted to these Bảng 2 weights; 11.9 mg is the
  // 20–29 man's 10%-bioavailability RDA at 61.1 kg.
  vietnam_rda: {
    perKg: 11.9 / 61.1,
    referenceWeights: weights(
      [70, 60.0, 51.8],
      [50, 61.8, 54.7],
      [30, 60.2, 53.1],
      [20, 61.1, 53.0],
      [15, 59.5, 53.6],
      [0, 47.3, 45.9]
    ),
  },
  // Table 13.5 weights; 9.1 mg is the 18+ man's 15%-bioavailability RNI at
  // 75 kg. Postmenopausal women are tabled at 62 kg, the same as 18+.
  who_fao: {
    perKg: 9.1 / 75,
    referenceWeights: weights([18, 75, 62], [15, 64, 56], [0, 45, 46]),
  },
};

export const TARGET_KEYS: NutritionNutrientKey[] = [
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
  // Fiber scores off the NASEM AI in every context — it is the one target key
  // absent from both VIETNAM_RDA and WHO_FAO (see NASEM_DRI.fiberG).
  'fiberG',
  // Hidden bookkeeping nutrient.
  'vitaminHMcg',
];
