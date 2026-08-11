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

import type { Locale, UnitLexiconEntry, UnitType } from '../types';
import { collisionsFor, fold, foldedLookupFor } from './fold';

function normalize(token: string): string {
  // Internal runs collapse too, not just the ends: the multi-word entries
  // ("phi lê", "bánh bao") are the only ones whitespace can break, and a
  // double-spaced token is exactly the kind of thing a model emits.
  return token.normalize('NFC').toLowerCase().trim().replace(/\s+/g, ' ');
}

const ENTRIES: UnitLexiconEntry[] = [
  // -- Vietnamese count/piece counters -----------------------------------
  { token: 'cái', locale: 'vi', unitType: 'count' },
  { token: 'chiếc', locale: 'vi', unitType: 'count' },
  { token: 'quả', locale: 'vi', unitType: 'count' },
  { token: 'trái', locale: 'vi', unitType: 'count' },
  { token: 'con', locale: 'vi', unitType: 'count' },
  { token: 'viên', locale: 'vi', unitType: 'count' },
  { token: 'cục', locale: 'vi', unitType: 'count' },
  { token: 'cây', locale: 'vi', unitType: 'count' },
  { token: 'phần', locale: 'vi', unitType: 'count' },
  { token: 'xiên', locale: 'vi', unitType: 'count' },
  { token: 'ổ', locale: 'vi', unitType: 'count' },
  { token: 'bánh bao', locale: 'vi', unitType: 'count' }, // the item IS its own counter
  { token: 'cuốn', locale: 'vi', unitType: 'count' },
  { token: 'chả', locale: 'vi', unitType: 'count' },
  // A packet is the unit instant noodles are actually counted in ("1 gói mì",
  // "2 gói"). Without it the most ordinary phrasing for the food had no unit
  // the resolver could hang a prior on, so the portion stayed unanchored.
  { token: 'gói', locale: 'vi', unitType: 'count' },
  // -- Vietnamese slice / piece-of ---------------------------------------
  { token: 'lát', locale: 'vi', unitType: 'slice' },
  { token: 'miếng', locale: 'vi', unitType: 'slice' },
  { token: 'khúc', locale: 'vi', unitType: 'slice' },
  { token: 'khứa', locale: 'vi', unitType: 'slice' },
  { token: 'khoanh', locale: 'vi', unitType: 'slice' },
  { token: 'phi lê', locale: 'vi', unitType: 'slice' },
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
  { token: 'chunk', locale: 'en', unitType: 'count' },
  { token: 'chunks', locale: 'en', unitType: 'count' },
  { token: 'cut', locale: 'en', unitType: 'count' },
  { token: 'cuts', locale: 'en', unitType: 'count' },
  { token: 'pack', locale: 'en', unitType: 'count' },
  { token: 'packs', locale: 'en', unitType: 'count' },
  { token: 'packet', locale: 'en', unitType: 'count' },
  { token: 'packets', locale: 'en', unitType: 'count' },
  // -- English / global slice --------------------------------------------
  { token: 'slice', locale: 'en', unitType: 'slice' },
  { token: 'slices', locale: 'en', unitType: 'slice' },
  // A steak/fillet is a CUT of a larger piece, so it types like `lát`/`miếng`
  // rather than like a whole countable item. These were reachable by the piece
  // picker (PIECE_UNIT_TOKENS) but invisible here, so "2 steaks" carried a
  // silhouette and no unit the resolver could hang a prior on.
  { token: 'steak', locale: 'en', unitType: 'slice' },
  { token: 'steaks', locale: 'en', unitType: 'slice' },
  { token: 'fillet', locale: 'en', unitType: 'slice' },
  { token: 'fillets', locale: 'en', unitType: 'slice' },
  { token: 'filet', locale: 'en', unitType: 'slice' },
  { token: 'filets', locale: 'en', unitType: 'slice' },
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
 * Diacritic-folded index, tried only after an exact miss.
 *
 * Vietnamese is very often typed without tone marks ("2 lat ca kho", "1 to
 * pho"), and `normalize` above is NFC + lowercase only — so those inputs missed
 * every Vietnamese entry in this table. `PIECE_UNIT_TOKENS` in `piece-vessel.ts`
 * has always folded (it uses `normalizeVesselToken`), which is how a portion
 * could get a piece silhouette from a token this table could not type at all.
 * An unresolvable unit leaves the estimate unanchored, and a too-wide estimate
 * routes the whole meal to clarify.
 *
 * Folding is a FALLBACK, never a replacement: an exact accented match always
 * wins, so nothing that resolved before resolves differently now.
 */
const foldedEntries = ENTRIES.map((entry) => [entry.token, entry] as const);
const FOLDED = foldedLookupFor(foldedEntries, (entry) => entry.unitType, {
  collapseWhitespace: true,
});

/** Entries sharing a folded key but disagreeing on type — must stay empty. */
export function foldCollisions(): string[] {
  return collisionsFor(foldedEntries, (entry) => entry.unitType, {
    collapseWhitespace: true,
  });
}

/**
 * Resolve a verbatim unit token to a semantic unit type. Returns null for
 * unknown tokens (the resolver treats an unknown unit as "no unit type" and
 * falls through to null/clarify rather than guessing).
 */
export function resolveUnitType(token: string | undefined): UnitType | null {
  return lookupUnit(token)?.unitType ?? null;
}

/** Full lexicon entry (type + locale) for a token, or null. */
export function lookupUnit(token: string | undefined): UnitLexiconEntry | null {
  if (!token) return null;
  return (
    LEXICON.get(normalize(token)) ??
    FOLDED.get(fold(token, { collapseWhitespace: true })) ??
    null
  );
}

/** All entries for a locale — used by tests / coverage reporting. */
export function unitsForLocale(locale: Locale): UnitLexiconEntry[] {
  return ENTRIES.filter((e) => e.locale === locale);
}

/** All real surface units registered for an invariant's unit-type coverage. */
export function unitsForType(unitType: UnitType): UnitLexiconEntry[] {
  return ENTRIES.filter((entry) => entry.unitType === unitType);
}

const PIECE_LIKE_FOLDED = new Set([
  'mieng',
  'lat',
  'khuc',
  'khua',
  'khoanh',
  'phi le',
  'cuc',
  'piece',
  'pieces',
  'slice',
  'slices',
  'steak',
  'steaks',
  'fillet',
  'fillets',
  'filet',
  'filets',
  'chunk',
  'chunks',
  'cut',
  'cuts',
]);

/** Whether a token describes a cut/piece eligible for slice↔count loosening. */
export function isPieceLikeUnitToken(token: string | undefined): boolean {
  return token
    ? PIECE_LIKE_FOLDED.has(fold(token, { collapseWhitespace: true }))
    : false;
}
