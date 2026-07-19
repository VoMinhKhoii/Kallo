/**
 * Portion priors: (food-concept × unit-type × locale × form) → per-unit grams
 * band + confidence + source.
 *
 * This is the ONLY layer carrying a numeric grams value for count/slice/
 * volume/container units, and every entry is CONCEPT-SCOPED. There is no
 * global "1 slice = Ng" — a slice prior exists only inside a concept (a slice
 * of bánh mì differs from a slice of pizza). The table is deliberately
 * head-of-distribution (the staples in the logs + obvious global units); the
 * fallback ladder handles the tail via null → LLM range.
 *
 * Grams are documented ranges with a source note. Where a concept links to a
 * verified DB row (see concepts.ts), the row supplies nutrition; the prior
 * supplies the WEIGHT.
 */

import type { ConceptId, GramsBand, PortionPrior, SizeModifier } from './types';

const band = (low: number, mid: number, high: number): GramsBand => ({
  low,
  mid,
  high,
});

/**
 * Seeded priors. Keyed for lookup by (conceptId, unitType, locale, form) in
 * `findPrior`. Every entry is head-of-distribution and locale-tagged.
 */
export const PORTION_PRIORS: PortionPrior[] = [
  {
    // 1 bánh bao ≈ 150–180g (composed steamed bun, VN street size). This is
    // the fix for the "2 buns = 390 kcal" bug: the LLM assumed ~90g/bun.
    conceptId: 'banh-bao',
    unitType: 'count',
    locale: 'vi',
    form: 'composed',
    perUnit: band(150, 165, 180),
    confidence: 'high',
    source:
      'VN street-food bánh bao ~150–180g/unit (market survey + recipe yields, 2026 review); DB row Bánh bao nhân thịt.',
  },
  {
    // 1 quail egg ≈ 9–11g (shelled). Composed inside a bánh bao trứng cút.
    conceptId: 'quail-egg',
    unitType: 'count',
    locale: 'vi',
    form: 'cooked',
    perUnit: band(9, 10, 11),
    confidence: 'high',
    source:
      'Quail egg shelled ~9–11g (FAO/USDA egg tables); DB row Trứng chim cút.',
  },
  {
    // 1 lát bánh mì ≈ 25–35g. SLICE prior scoped to the loaf concept ONLY.
    conceptId: 'banh-mi-loaf',
    unitType: 'slice',
    locale: 'vi',
    form: 'raw',
    perUnit: band(25, 30, 35),
    confidence: 'medium',
    source:
      'French-bread slice ~25–35g (loaf-scoped, NOT a global slice value).',
  },
  {
    // whole ổ bánh mì ≈ 90–120g bread (VN sandwich loaf, bread only).
    conceptId: 'banh-mi-loaf',
    unitType: 'count',
    locale: 'vi',
    form: 'raw',
    perUnit: band(90, 105, 120),
    confidence: 'medium',
    source: 'VN bánh mì loaf (bread only) ~90–120g; excludes fillings.',
  },
  {
    // 1 chén/bát cơm ≈ 180–220g cooked. Container prior scoped to rice.
    conceptId: 'cooked-rice',
    unitType: 'container',
    locale: 'vi',
    form: 'cooked',
    perUnit: band(180, 200, 220),
    confidence: 'high',
    source:
      'VN chén/bát cơm ~200g cooked (household survey); rice-concept-scoped.',
  },
  {
    // 1 ức gà ≈ 150–200g cooked (single breast fillet).
    conceptId: 'chicken-breast',
    unitType: 'count',
    locale: 'global',
    form: 'cooked',
    perUnit: band(150, 175, 200),
    confidence: 'medium',
    source:
      'Single chicken-breast fillet ~150–200g cooked (USDA portion refs).',
  },
];

/**
 * Pick the low/mid/high point matching a size modifier. No modifier → mid.
 */
export function applySizeModifier(
  band: GramsBand,
  size: SizeModifier | undefined
): number {
  if (size === 'small') return band.low;
  if (size === 'large') return band.high;
  return band.mid;
}

/**
 * Find the best prior for (concept, unitType, locale, form). Match precedence:
 *   1. exact locale + exact form
 *   2. exact locale, form='any' or 'composed'/'cooked' loosened
 *   3. locale='global' fallback
 *   4. any-locale fallback (locale is a prior, not a filter)
 * Returns null only when the concept×unitType pool is empty (resolver then
 * falls through the ladder).
 */
export function findPrior(args: {
  conceptId: ConceptId;
  unitType: PortionPrior['unitType'];
  locale: PortionPrior['locale'];
  form: PortionPrior['form'];
}): PortionPrior | null {
  const { conceptId, unitType, locale, form } = args;
  const pool = PORTION_PRIORS.filter(
    (p) => p.conceptId === conceptId && p.unitType === unitType
  );
  if (pool.length === 0) return null;

  // 1. exact locale + exact form
  const exact = pool.find((p) => p.locale === locale && p.form === form);
  if (exact) return exact;

  // 2. exact locale, any form (form is a refinement, not a hard filter)
  const localeMatch = pool.find(
    (p) => p.locale === locale && (p.form === 'any' || form === 'any')
  );
  if (localeMatch) return localeMatch;
  const localeAny = pool.find((p) => p.locale === locale);
  if (localeAny) return localeAny;

  // 3. global fallback (a unit prior valid regardless of user locale)
  const globalMatch = pool.find((p) => p.locale === 'global');
  if (globalMatch) return globalMatch;

  // 4. any-locale fallback: locale is a PRIOR, not a filter. Concept +
  //    unitType already scope the lookup tightly — a bánh-bao count prior is
  //    right for a user whose locale resolved to 'en'/'global' too (the food
  //    fixes the portion norm, not the speaker's language). Without this,
  //    every locale-tagged prior is unreachable when inputLanguage is unset,
  //    which silently re-opens the LLM-guess portion bug.
  const formMatch = pool.find((p) => p.form === form || p.form === 'any');
  if (formMatch) return formMatch;
  return pool[0];
}
