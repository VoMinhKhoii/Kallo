/**
 * Unit lexicon: language-tagged unit tokens → a semantic unit TYPE.
 *
 * GLOBAL-CORRECTNESS RULE: a unit type is NOT grams. "lát"/"slice"/"tô"/"bowl"
 * only say HOW something was measured (a discrete count, a slice, a container,
 * a volume). Turning a unit into grams REQUIRES a concept-scoped prior
 * (`priors.ts`). This table is intentionally free of any gram value.
 *
 * Seeded with the Vietnamese counters that appear in the dogfood logs plus the
 * obvious global units. Locale is a tag, not a hard filter — lookup is
 * normalized (NFC + lowercase + trim) and locale-agnostic; the tag lets a
 * later phase reason about per-locale coverage.
 */

import type { Locale, UnitLexiconEntry, UnitType } from './types';

function normalize(token: string): string {
  return token.normalize('NFC').toLowerCase().trim();
}

const ENTRIES: UnitLexiconEntry[] = [
  // -- Vietnamese count/piece counters -----------------------------------
  { token: 'cái', locale: 'vi', unitType: 'count' },
  { token: 'chiếc', locale: 'vi', unitType: 'count' },
  { token: 'quả', locale: 'vi', unitType: 'count' },
  { token: 'trái', locale: 'vi', unitType: 'count' },
  { token: 'con', locale: 'vi', unitType: 'count' },
  { token: 'viên', locale: 'vi', unitType: 'count' },
  { token: 'cây', locale: 'vi', unitType: 'count' },
  { token: 'xiên', locale: 'vi', unitType: 'count' },
  { token: 'ổ', locale: 'vi', unitType: 'count' },
  { token: 'bánh bao', locale: 'vi', unitType: 'count' }, // the item IS its own counter
  { token: 'cuốn', locale: 'vi', unitType: 'count' },
  { token: 'chả', locale: 'vi', unitType: 'count' },
  // -- Vietnamese slice / piece-of ---------------------------------------
  { token: 'lát', locale: 'vi', unitType: 'slice' },
  { token: 'miếng', locale: 'vi', unitType: 'slice' },
  { token: 'khúc', locale: 'vi', unitType: 'slice' },
  // -- Vietnamese containers ---------------------------------------------
  { token: 'tô', locale: 'vi', unitType: 'container' },
  { token: 'bát', locale: 'vi', unitType: 'container' },
  { token: 'chén', locale: 'vi', unitType: 'container' },
  { token: 'đĩa', locale: 'vi', unitType: 'container' },
  { token: 'dĩa', locale: 'vi', unitType: 'container' },
  { token: 'ly', locale: 'vi', unitType: 'volume' },
  { token: 'cốc', locale: 'vi', unitType: 'volume' },
  { token: 'muỗng', locale: 'vi', unitType: 'volume' },
  { token: 'thìa', locale: 'vi', unitType: 'volume' },
  // -- English / global count --------------------------------------------
  { token: 'piece', locale: 'en', unitType: 'count' },
  { token: 'pieces', locale: 'en', unitType: 'count' },
  { token: 'egg', locale: 'en', unitType: 'count' },
  { token: 'bun', locale: 'en', unitType: 'count' },
  { token: 'skewer', locale: 'en', unitType: 'count' },
  { token: 'roll', locale: 'en', unitType: 'count' },
  // -- English / global slice --------------------------------------------
  { token: 'slice', locale: 'en', unitType: 'slice' },
  { token: 'slices', locale: 'en', unitType: 'slice' },
  // -- English / global containers + volume ------------------------------
  { token: 'bowl', locale: 'en', unitType: 'container' },
  { token: 'plate', locale: 'en', unitType: 'container' },
  { token: 'cup', locale: 'en', unitType: 'volume' },
  { token: 'glass', locale: 'en', unitType: 'volume' },
  { token: 'scoop', locale: 'en', unitType: 'volume' },
  { token: 'tbsp', locale: 'en', unitType: 'volume' },
  { token: 'tsp', locale: 'en', unitType: 'volume' },
  // -- Mass units (literal weight) ---------------------------------------
  { token: 'g', locale: 'global', unitType: 'mass' },
  { token: 'gr', locale: 'global', unitType: 'mass' },
  { token: 'gram', locale: 'global', unitType: 'mass' },
  { token: 'grams', locale: 'global', unitType: 'mass' },
  { token: 'kg', locale: 'global', unitType: 'mass' },
  { token: 'oz', locale: 'global', unitType: 'mass' },
];

const LEXICON = new Map<string, UnitLexiconEntry>();
for (const e of ENTRIES) LEXICON.set(normalize(e.token), e);

/**
 * Resolve a verbatim unit token to a semantic unit type. Returns null for
 * unknown tokens (the resolver treats an unknown unit as "no unit type" and
 * falls through to null/clarify rather than guessing).
 */
export function resolveUnitType(token: string | undefined): UnitType | null {
  if (!token) return null;
  return LEXICON.get(normalize(token))?.unitType ?? null;
}

/** Full lexicon entry (type + locale) for a token, or null. */
export function lookupUnit(token: string | undefined): UnitLexiconEntry | null {
  if (!token) return null;
  return LEXICON.get(normalize(token)) ?? null;
}

/** All entries for a locale — used by tests / coverage reporting. */
export function unitsForLocale(locale: Locale): UnitLexiconEntry[] {
  return ENTRIES.filter((e) => e.locale === locale);
}
