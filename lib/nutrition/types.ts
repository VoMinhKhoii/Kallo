export type NutritionRange = '1d' | '7d' | '30d' | '90d';
export type NutritionRangeInput = 'auto' | NutritionRange;
/** Which day set the overview averages/series are scoped to. */
export type NutritionDayScope = 'all' | 'complete';
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

/**
 * A metric the per-day time axis can chart: the macros plus the default
 * micronutrients (the ones rendered as cards). Keyed off the same identifiers
 * the rest of the DTO uses so the UI can join a series to its card.
 */
export type DaySeriesMetricKey =
  | 'calories'
  | 'protein'
  | 'carbohydrate'
  | 'fat'
  | NutritionNutrientKey;

/** Whether the time axis buckets by day (7d/30d) or by week (90d). */
export type DaySeriesBucketUnit = 'day' | 'week';

export interface DaySeriesBucket {
  /** Inclusive local-date start of the bucket. */
  startDate: string;
  /** Inclusive local-date end of the bucket (same as start for day buckets). */
  endDate: string;
  /** Per-day average of the metric across the bucket's in-scope days. */
  value: number | null;
  /** Value as a fraction of the metric's target, or null when no target. */
  ratioOfTarget: number | null;
  /**
   * The bucket holds logged days but none the current day scope averages over,
   * so `value` covers its logged days instead and it is NOT part of the
   * headline above it. Clients draw it in the muted pigment: the day was
   * eaten, it just isn't being counted. Always false under the `all` scope.
   */
  excluded: boolean;
}

export interface NutrientDaySeries {
  metric: DaySeriesMetricKey;
  labelKey: string;
  unit: string;
  target: number | null;
  buckets: DaySeriesBucket[];
  /** Min/max of non-null bucket values, for the whisker band. Null if empty. */
  min: number | null;
  max: number | null;
}

export interface NutritionDaySeries {
  unit: DaySeriesBucketUnit;
  series: NutrientDaySeries[];
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
}

export interface EducationCardData {
  id: 'vitamin_d';
  titleKey: string;
  bodyKey: string;
}

/** One day-scope's calorie average and the day-count backing it. */
export interface CalorieScopeAverage {
  /** Average calories per day over this scope's days; null when it has none. */
  averagePerDay: number | null;
  /** Number of days backing the average (its denominator). */
  days: number;
}

/** Both scopes' calorie averages, shipped together for the client's swap UI. */
export interface CalorieAverages {
  all: CalorieScopeAverage;
  complete: CalorieScopeAverage;
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
  /**
   * Both day-scope calorie averages, always present regardless of the requested
   * `days` scope, so the client can show one as the hero figure and the other as
   * a subtle secondary and swap them without a refetch. `complete` is strict
   * (no all-partial safety valve), so `averagePerDay` is null when there are no
   * complete days.
   */
  calorieAverages: CalorieAverages;
  /**
   * The same two averages for the window of equal length immediately before
   * this one — 7d against the previous seven days, 30d the previous thirty.
   * Both scopes read null when nothing was logged back then.
   */
  previousCalorieAverages: CalorieAverages;
  macros: MacroPattern[];
  /**
   * Per-bucket time series for the macros and default micronutrients. Days for
   * the 7d/30d ranges, weeks for 90d. Empty when there are no complete days.
   */
  daySeries: NutritionDaySeries;
  micronutrients: NutrientCardData[];
  /** Subset of `micronutrients` chosen for headline focus (max 2). */
  spotlight: NutrientCardData[];
  /** `micronutrients` minus `spotlight`. */
  steady: NutrientCardData[];
  moreNutrients: NutrientCardData[];
  educationCards: EducationCardData[];
}
