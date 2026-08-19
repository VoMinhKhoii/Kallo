import type { ValidationAnomaly } from './validation';

export interface PipelineMetrics {
  decomposeMs: number;
  matchMs: number;
  nutritionMs: number;
  assemblyMs: number;
  totalMs: number;
  ingredientCount: number;
  matchedCount: number;
  unmatchedCount: number;
  mealItemCount: number;
  anomalies: ValidationAnomaly[];
  /** Phase A substage fire-rate signals (Phase A.4). */
  cacheHitL4: boolean;
  languageRetryCount: number;
  nutritionAnomalyRetry: boolean;
  nutritionEscalated: boolean;
  aliasFallbackFired: boolean;
  /**
   * Per-chunk extractor cost (Phase A.7 / C8). Sums sync regex+JSON-parse
   * time across every stream chunk per stage. Lets us decide whether
   * deferring extraction off the chunk-loop is worth doing.
   */
  decomposeChunkExtractMs: number;
  decomposeChunkCount: number;
  nutritionChunkExtractMs: number;
  nutritionChunkCount: number;
}

export function logMetrics(metrics: PipelineMetrics): void {
  console.info('[pipeline] metrics', JSON.stringify(metrics));
}
