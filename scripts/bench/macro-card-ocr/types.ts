export interface BenchmarkFixture {
  readonly id: string;
  readonly filename: string;
  readonly code: string;
  readonly category: string;
  readonly dishName: string;
  readonly ingredients: string;
  readonly expected: {
    readonly calories: number | null;
    readonly proteinGrams: number | null;
    readonly carbsGrams: number | null;
    readonly fatGrams: number | null;
  };
}

export type PreprocessMode = 'raw' | '1280px';
export type ThinkingMode = 'low' | 'minimal' | 'off';

export interface ModelSpec {
  /** Human-readable config id, e.g. `gemini-3.1-flash-lite:low` or `claude-haiku-5-5`. */
  readonly id: string;
  readonly provider: 'gemini' | 'claude';
  readonly model: string;
  readonly thinking: ThinkingMode;
}

export interface TokenUsage {
  readonly inputTokens: number;
  readonly cachedTokens: number;
  readonly cacheWriteTokens: number;
  readonly outputTokens: number;
  readonly thoughtTokens: number;
}

export interface FieldScores {
  readonly calories: boolean;
  readonly proteinGrams: boolean;
  readonly carbsGrams: boolean;
  readonly fatGrams: boolean;
  readonly allMatch: boolean;
  readonly nullPreserved: boolean;
}

export interface CardRunResult {
  readonly fixtureId: string;
  readonly code: string;
  readonly category: string;
  readonly dishName: string;
  readonly modelId: string;
  readonly preprocess: PreprocessMode;
  readonly status: 'ok' | 'no_label' | 'error';
  readonly errorMessage: string | null;
  readonly latencyMs: number;
  readonly costUsd: number | null;
  readonly tokens: TokenUsage;
  readonly expected: BenchmarkFixture['expected'];
  readonly actual: {
    readonly calories: number | null;
    readonly proteinGrams: number | null;
    readonly carbsGrams: number | null;
    readonly fatGrams: number | null;
    readonly productName: string | null;
    readonly confidence: string | null;
  } | null;
  readonly scores: FieldScores;
}

export interface ModelSummary {
  readonly modelId: string;
  readonly preprocess: PreprocessMode;
  readonly total: number;
  readonly strictPass: number;
  readonly strictRatePct: number;
  readonly caloriesPct: number;
  readonly proteinPct: number;
  readonly carbsPct: number;
  readonly fatPct: number;
  readonly nullPreservedPct: number;
  readonly errorCount: number;
  readonly noLabelCount: number;
  readonly p50Ms: number;
  readonly p90Ms: number;
  readonly p95Ms: number;
  readonly totalCostUsd: number | null;
  readonly costPer1kUsd: number | null;
  readonly byCategory: Record<
    string,
    { total: number; strictPass: number; strictRatePct: number }
  >;
}

export interface BenchmarkReport {
  readonly label: string;
  readonly tier: 'preflight' | 'core' | 'full';
  readonly preprocess: PreprocessMode;
  readonly createdAt: string;
  readonly summaries: readonly ModelSummary[];
  readonly results: readonly CardRunResult[];
}
