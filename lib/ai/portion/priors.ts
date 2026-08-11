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
 * Every grams band declares its physical basis. Legacy priors are EDIBLE mass;
 * refuse-bearing head-portion priors are GROSS as served so they compose with
 * user-weighed portions and the portion picker. Gross→edible conversion occurs
 * once, downstream in `refuse-mass.ts`. Nutrition-row selection is independent:
 * a concept prior remains usable even when matching chooses the wrong row.
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
    massBasis: 'edible',
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
    massBasis: 'edible',
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
    promptLabel: 'lát bánh mì',
    perUnit: band(25, 30, 35),
    massBasis: 'edible',
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
    promptLabel: 'ổ bánh mì',
    perUnit: band(90, 105, 120),
    massBasis: 'edible',
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
    massBasis: 'edible',
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
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'Single chicken-breast fillet ~150–200g cooked (USDA portion refs).',
  },
  {
    conceptId: 'rib-piece',
    unitType: 'slice',
    locale: 'vi',
    form: 'any',
    promptLabel: 'miếng sườn (cả xương)',
    perUnit: band(70, 85, 100),
    massBasis: 'gross_as_served',
    confidence: 'high',
    source:
      'GROSS as served, including bone: VN table-cut rib 70–100g/piece; production measured-evidence tranche (2026-08-10). Expected refuse 40–60%.',
  },
  {
    conceptId: 'chicken-wing',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'cánh gà (cả xương)',
    perUnit: band(70, 85, 100),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including bone: whole chicken-wing household weights, VN table-size calibration (2026-08-10). Expected refuse 30–50%.',
  },
  {
    conceptId: 'chicken-thigh',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'đùi gà (cả xương)',
    perUnit: band(120, 150, 180),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including bone: bone-in thigh/drumstick household weights, USDA/VN table-size review (2026-08-10). Expected refuse 25–35%.',
  },
  {
    conceptId: 'whole-fish',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'con cá nguyên (cả đầu/xương)',
    perUnit: band(250, 325, 400),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including head/bone: small-to-medium whole table fish; production calibration plus FAO edible-yield review (2026-08-10). Expected refuse 35–50%; size cue selects band edge.',
  },
  {
    conceptId: 'fish-section',
    unitType: 'slice',
    locale: 'vi',
    form: 'any',
    promptLabel: 'khúc/khoanh cá (còn xương)',
    perUnit: band(70, 90, 110),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including central bone: VN fish steak/section household portion review (2026-08-10). Expected refuse 15–30%.',
  },
  {
    conceptId: 'fish-fillet',
    unitType: 'slice',
    locale: 'vi',
    form: 'any',
    promptLabel: 'miếng cá phi lê (không xương)',
    perUnit: band(70, 90, 110),
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'EDIBLE boneless fillet: VN fish-fillet household portion review (2026-08-10). Expected refuse 0%.',
  },
  {
    conceptId: 'shell-on-shrimp',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'con tôm nguyên vỏ',
    perUnit: band(18, 24, 30),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including shell/head: medium-large shrimp count-weight review (2026-08-10). Expected refuse 35–55%.',
  },
  {
    conceptId: 'peeled-shrimp',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'con tôm đã bóc vỏ',
    perUnit: band(12, 16, 20),
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'EDIBLE peeled shrimp: peeled shrimp count-weight review (2026-08-10). Expected refuse 0%.',
  },
  {
    conceptId: 'whole-crab',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'con cua/ghẹ nguyên (cả vỏ)',
    perUnit: band(150, 200, 250),
    massBasis: 'gross_as_served',
    confidence: 'medium',
    source:
      'GROSS as served, including shell: small-to-medium whole crab/ghẹ market-weight review and production evidence (2026-08-10). Expected refuse 55–75%.',
  },
  {
    conceptId: 'picked-crab-meat',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'phần thịt cua/ghẹ đã gỡ',
    perUnit: band(50, 65, 80),
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'EDIBLE picked crab meat: picked-meat serving review (2026-08-10). Expected refuse 0%.',
  },
  {
    conceptId: 'egg-in-shell',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'quả trứng còn vỏ',
    perUnit: band(50, 58, 65),
    massBasis: 'gross_as_served',
    confidence: 'high',
    source:
      'GROSS as served, including shell: standard chicken-egg weight classes (FAO/USDA household-weight review, 2026-08-10). Expected refuse 10–15%.',
  },
  {
    conceptId: 'peeled-egg',
    unitType: 'count',
    locale: 'vi',
    form: 'any',
    promptLabel: 'quả trứng luộc đã bóc vỏ',
    perUnit: band(45, 50, 55),
    massBasis: 'edible',
    confidence: 'high',
    source:
      'EDIBLE after peeling: boiled chicken-egg household weight (FAO/USDA review, 2026-08-10). Expected refuse 0%; never reuse the DB shell value.',
  },
  {
    // 1 cây nem lụi ≈ 22–28g cooked.
    conceptId: 'nem-lui',
    unitType: 'count',
    locale: 'vi',
    form: 'cooked',
    perUnit: band(22, 25, 28),
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'Vietnamese nem lụi skewer ~22–28g cooked (recipe-yield review, 2026).',
  },
  {
    // 1 phần protein áp chảo ≈ 140–160g cooked.
    conceptId: 'pan-seared-protein-serving',
    unitType: 'count',
    locale: 'global',
    form: 'cooked',
    perUnit: band(140, 150, 160),
    massBasis: 'edible',
    confidence: 'medium',
    source:
      'Single pan-seared protein serving ~140–160g cooked (restaurant portion review, 2026).',
  },
  {
    // 1 gói mì ≈ 70–90g of DRY noodle block + seasoning sachets. VN retail
    // packets cluster at 65–75g (Hảo Hảo, Omachi) with 85–100g "lớn"/ly
    // variants, so the band spans both and `applySizeModifier` picks the end.
    //
    // `form: 'raw'` is load-bearing. This is the weight of the PACKET, not of
    // the prepared bowl — noodles roughly triple in mass once cooked. The
    // prior must therefore only ever pair with a raw-state composition row;
    // pairing it with a prepared-basis row would undercount by ~3x, and using
    // it as a bowl's weight would overcount by the same factor.
    conceptId: 'instant-noodle-pack',
    unitType: 'count',
    locale: 'vi',
    form: 'raw',
    promptLabel: 'gói mì',
    perUnit: band(70, 80, 90),
    massBasis: 'edible',
    confidence: 'high',
    source:
      'VN instant-noodle retail packets ~65–100g dry (Hảo Hảo 75g, Omachi 80g, 3 Miền 65g; label survey 2026). Dry packet weight, NOT prepared mass.',
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
  pieceLikeUnit?: boolean;
}): PortionPrior | null {
  const { conceptId, unitType, locale, form, pieceLikeUnit = false } = args;
  const exactUnitPool = PORTION_PRIORS.filter(
    (p) => p.conceptId === conceptId && p.unitType === unitType
  );
  // Only a real cut/piece token may loosen slice↔count, and only after the
  // exact unit-type lookup misses. Never loosen into mass/volume/container.
  const alternateUnitType =
    unitType === 'slice' ? 'count' : unitType === 'count' ? 'slice' : null;
  const pool =
    exactUnitPool.length > 0 || !pieceLikeUnit || !alternateUnitType
      ? exactUnitPool
      : PORTION_PRIORS.filter(
          (p) => p.conceptId === conceptId && p.unitType === alternateUnitType
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
