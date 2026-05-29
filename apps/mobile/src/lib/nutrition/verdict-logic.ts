/**
 * Pure verdict helpers extracted from web `components/nutrition/sections/
 * verdict-hero.tsx` (keep in sync). The headline branch selection stays in the
 * component (it needs the translator); these are the locale/data-only pieces.
 */
import type {
  NutrientSummaryItem,
  NutritionOverview,
  NutritionRange,
} from '@/lib/nutrition/types';

export const PERIOD_KEYS: Record<NutritionRange, string> = {
  '7d': 'verdict.period7d',
  '30d': 'verdict.period30d',
  '90d': 'verdict.period90d',
};

/** Translator shape — matches use-intl's `useTranslations()` call signature. */
type Translator = (key: string) => string;

export function takeNames(
  items: NutrientSummaryItem[],
  tRoot: Translator,
  limit = 2
): string[] {
  return items
    .slice(0, limit)
    .map((item) => tRoot(item.labelKey).toLowerCase());
}

export function joinNames(names: string[], locale: string): string {
  if (names.length === 0) return '';
  try {
    return new Intl.ListFormat(locale, {
      style: 'long',
      type: 'conjunction',
    }).format(names);
  } catch {
    // Hermes builds without Intl.ListFormat fall back to a plain join.
    return names.join(', ');
  }
}

export function getAverageConfidence(overview: NutritionOverview): number | null {
  const items = [
    ...overview.summary.mostConsistent,
    ...overview.summary.needsAttention,
  ];
  if (items.length === 0) return null;
  return (
    items.reduce((total, item) => total + item.confidence, 0) / items.length
  );
}
