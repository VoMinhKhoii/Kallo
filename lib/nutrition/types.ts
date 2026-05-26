export type NutritionRange = '7d' | '30d' | '90d';
export type NutritionRangeInput = 'auto' | NutritionRange;
export type BucketTimezone = 'local' | 'utc';
export type TargetSource = 'vietnam_rda' | 'who_fao' | 'nasem' | 'unsupported';
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
export type NutrientType = 'floor' | 'ceiling' | 'range';

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
export type MacroGoal = 'cutting' | 'bulking' | 'maintaining';

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
  nutrientType: NutrientType;
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
  nutrientType: NutrientType;
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
  nutrientType: NutrientType;
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
  /** Logged days deemed complete enough to count toward long-span metrics. */
  completeDays: number;
  /** Logged days set aside as partial (under-logged) — surfaced, not counted. */
  partialDays: number;
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
  /** Subset of `micronutrients` chosen for headline focus (max 2). */
  spotlight: NutrientCardData[];
  /** `micronutrients` minus `spotlight`. */
  steady: NutrientCardData[];
  moreNutrients: NutrientCardData[];
  educationCards: EducationCardData[];
}
