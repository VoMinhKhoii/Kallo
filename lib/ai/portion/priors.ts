/**
 * Prior lookup: pick the right row out of `data/priors.ts` for a
 * (concept, unitType, locale, form) query, and pick a point out of its band.
 * The table itself is data and lives in `data/priors.ts`.
 */

import { PORTION_PRIORS } from '@/lib/ai/portion/data/priors';
import type {
  ConceptId,
  GramsBand,
  PortionPrior,
  SizeModifier,
} from '@/lib/ai/portion/types';

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
