import type {
  MacroConsistencySummary,
  MacroKey,
  NutrientSummaryItem,
  NutritionRange,
} from './types';

interface MacroConsistencyInput {
  macro: MacroKey;
  target: number | null;
  values: number[];
}

const MINIMUM_LOGGED_DAYS: Record<NutritionRange, number> = {
  '7d': 3,
  '30d': 10,
  '90d': 30,
};

const PERCENT_EPSILON = 1e-9;

interface NutrientBuckets {
  mostConsistent: NutrientSummaryItem[];
  needsAttention: NutrientSummaryItem[];
  limitedDataCount: number;
}

export function resolveInitialRange(loggedDaysLast30: number): NutritionRange {
  return loggedDaysLast30 < 14 ? '7d' : '30d';
}

export function getTrendStatus(
  range: NutritionRange,
  loggedDays: number
): 'ready' | 'too_few_logged_days' {
  return loggedDays >= MINIMUM_LOGGED_DAYS[range]
    ? 'ready'
    : 'too_few_logged_days';
}

function isMacroMatch({
  macro,
  target,
  value,
}: {
  macro: MacroKey;
  target: number;
  value: number;
}): boolean {
  if (macro === 'calories') {
    return Math.round(value) === target;
  }

  const percentOfTarget = value / target;

  if (macro === 'protein') {
    return percentOfTarget >= 0.9 - PERCENT_EPSILON;
  }

  return (
    percentOfTarget >= 0.85 - PERCENT_EPSILON &&
    percentOfTarget <= 1.15 + PERCENT_EPSILON
  );
}

export function getMacroConsistency({
  macro,
  target,
  values,
}: MacroConsistencyInput): number | null {
  if (target === null || values.length === 0) {
    return null;
  }

  const matches = values.filter((value) =>
    isMacroMatch({ macro, target, value })
  ).length;

  return Math.round((matches / values.length) * 100);
}

export function getMacroConsistencySummary(
  values: Record<MacroKey, number | null>
): MacroConsistencySummary {
  const entries = (
    Object.entries(values) as [MacroKey, number | null][]
  ).filter(([, value]) => value !== null) as [MacroKey, number][];

  if (entries.length === 0) {
    return {
      averageConsistencyPct: 0,
      weakestMacro: null,
    };
  }

  const total = entries.reduce((sum, [, value]) => sum + value, 0);
  const weakestMacro = entries.reduce(
    (weakest, [macro, value]) =>
      weakest === null || value < weakest.value ? { macro, value } : weakest,
    null as { macro: MacroKey; value: number } | null
  );

  return {
    averageConsistencyPct: Math.round(total / entries.length),
    weakestMacro: weakestMacro?.macro ?? null,
  };
}

export function bucketNutrients(items: NutrientSummaryItem[]): NutrientBuckets {
  const buckets: NutrientBuckets = {
    mostConsistent: [],
    needsAttention: [],
    limitedDataCount: 0,
  };

  for (const item of items) {
    if (item.applicability && item.applicability !== 'scored') {
      continue;
    }

    if (item.confidence < 40 || item.status === 'limited_data') {
      buckets.limitedDataCount += 1;
      continue;
    }

    if (item.status === 'below_target') {
      buckets.needsAttention.push(item);
      continue;
    }

    if (item.status === 'adequate' || item.status === 'above_target') {
      buckets.mostConsistent.push(item);
    }
  }

  return buckets;
}
