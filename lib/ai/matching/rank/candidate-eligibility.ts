import type { FuzzyMatchRow } from '@/lib/ai/matching/match-constants';

const VI_WORD_EDGE = '[\\p{L}\\p{M}\\p{N}]';
const BARE_CHICKEN = new RegExp(
  `(?<!${VI_WORD_EDGE})gà(?!${VI_WORD_EDGE})`,
  'iu'
);
const viWord = (body: string) =>
  new RegExp(`(?<!${VI_WORD_EDGE})${body}(?!${VI_WORD_EDGE})`, 'iu');
/**
 * Birds whose Vietnamese name starts with `gà` but are not chicken. Each
 * species pairs its Vietnamese and English names, so a query in one language
 * recognises its row in the other.
 */
const NON_CHICKEN_SPECIES: RegExp[][] = [
  [viWord('gà\\s+tây'), /\bturkey\b/iu],
  [viWord('gà\\s+lôi'), viWord('chim\\s+trĩ'), /\bpheasant\b/iu],
  [viWord('gà\\s+rừng'), /\bjungle[\s-]*fowl\b/iu],
  [viWord('gà\\s+gô'), /\bgrouse\b/iu],
  [viWord('gà\\s+sao'), /\bguinea[\s-]*(?:fowl|hen)\b/iu],
];
/** A row that names chicken or one of the birds above, in either language. */
const ANY_CHICKEN_LIKE_BIRD = [
  BARE_CHICKEN,
  /\bchicken\b/iu,
  ...NON_CHICKEN_SPECIES.flat(),
];
const SKIN_INTENT = [
  new RegExp(`(?<!${VI_WORD_EDGE})da(?!${VI_WORD_EDGE})`, 'iu'),
  /\bskin\b/iu,
];
const FAT_INTENT = [
  new RegExp(`(?<!${VI_WORD_EDGE})mỡ(?!${VI_WORD_EDGE})`, 'iu'),
  /\b(?:fat|lard|tallow)\b/iu,
];
const SKIN_ONLY_ROW = [
  /(?:^|[,;(]\s*)skin(?:\s*(?:\(|,|;|$))/iu,
  /\bskin\s+only\b/iu,
  /(?:^|[,;(]\s*)da(?:\s+(?:gà|vịt))?(?:\s*(?:\(|,|;|$))/iu,
  /(?:chỉ|chỉ\s+lấy)\s+(?:phần\s+)?da/iu,
];
const FAT_ONLY_ROW = [
  /\b(?:separable\s+fat|fat\s+only)\b/iu,
  /(?:^|[,;(]\s*)mỡ(?:\s+(?:lợn|bò|gà|vịt))?(?:\s*(?:\(|,|;|$))/iu,
  /(?:chỉ|chỉ\s+lấy)\s+(?:phần\s+)?mỡ/iu,
  /\b(?:lard|tallow)\b/iu,
];

function matchesAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function speciesNamed(text: string): RegExp[][] {
  return NON_CHICKEN_SPECIES.filter((names) => matchesAny(text, names));
}

/** The row names the guards read. */
type CandidateNames = Pick<
  FuzzyMatchRow,
  'name_primary' | 'name_en' | 'name_alt'
>;

function candidateIdentityText(candidate: CandidateNames): string {
  return [
    candidate.name_primary,
    candidate.name_en,
    ...(candidate.name_alt ?? []),
  ]
    .filter(Boolean)
    .join('\n');
}

/**
 * Hard identity eligibility rules for candidate classes that cannot represent
 * the queried food. These are deliberately narrow categorical exclusions, not
 * score adjustments: an unmatched ingredient is safer than anchoring a whole
 * cut to a different species or to isolated skin/fat.
 */
export function isCandidateEligibleForIngredient(
  ingredientName: string,
  candidate: CandidateNames
): boolean {
  // Every pattern here is written precomposed. Decomposed (NFD) Vietnamese
  // looks the same and matches none of them, so both sides are composed first.
  const query = ingredientName.normalize('NFC');
  const candidateText = candidateIdentityText(candidate).normalize('NFC');
  const wanted = speciesNamed(query);
  if (wanted.length > 0) {
    // A named species never takes another bird's row: no row is safer than
    // chicken. A row that names no bird ("bread stuffing") stays eligible.
    const namesWanted = wanted.some((names) =>
      matchesAny(candidateText, names)
    );
    if (!namesWanted && matchesAny(candidateText, ANY_CHICKEN_LIKE_BIRD)) {
      return false;
    }
  } else if (
    BARE_CHICKEN.test(query) &&
    speciesNamed(candidateText).length > 0
  ) {
    return false;
  }

  if (
    !matchesAny(query, SKIN_INTENT) &&
    matchesAny(candidateText, SKIN_ONLY_ROW)
  ) {
    return false;
  }
  if (
    !matchesAny(query, FAT_INTENT) &&
    matchesAny(candidateText, FAT_ONLY_ROW)
  ) {
    return false;
  }
  return true;
}

/**
 * The live `đùi gà` pool contains eight saturated lexical ties. Fetch enough
 * rows for the categorical species filter above to see past those ties; the
 * public top-K remains unchanged. A query that names a species is filtered
 * too (ordinary chicken rows are dropped), so it over-fetches as well.
 */
export function sourceLimitForIngredient(
  ingredientName: string,
  configuredLimit: number
): number {
  const query = ingredientName.normalize('NFC');
  const needsSpeciesGuard =
    BARE_CHICKEN.test(query) || speciesNamed(query).length > 0;
  return needsSpeciesGuard ? Math.max(configuredLimit, 8) : configuredLimit;
}
