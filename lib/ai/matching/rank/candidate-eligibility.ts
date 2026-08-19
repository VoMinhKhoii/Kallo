import type { FuzzyMatchRow } from '@/lib/ai/matching/match-constants';

const VI_WORD_EDGE = '[\\p{L}\\p{M}\\p{N}]';
const BARE_CHICKEN = new RegExp(
  `(?<!${VI_WORD_EDGE})gà(?!${VI_WORD_EDGE})`,
  'iu'
);
const QUALIFIED_NON_CHICKEN_SPECIES = [
  new RegExp(
    `(?<!${VI_WORD_EDGE})gà\\s+(?:tây|lôi|rừng)(?!${VI_WORD_EDGE})`,
    'iu'
  ),
  /\b(?:turkey|pheasant|grouse|jungle\s+fowl)\b/iu,
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

function candidateIdentityText(candidate: FuzzyMatchRow): string {
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
  candidate: FuzzyMatchRow
): boolean {
  const candidateText = candidateIdentityText(candidate);
  const isBareChickenQuery =
    BARE_CHICKEN.test(ingredientName) &&
    !matchesAny(ingredientName, QUALIFIED_NON_CHICKEN_SPECIES);
  if (
    isBareChickenQuery &&
    matchesAny(candidateText, QUALIFIED_NON_CHICKEN_SPECIES)
  ) {
    return false;
  }

  if (
    !matchesAny(ingredientName, SKIN_INTENT) &&
    matchesAny(candidateText, SKIN_ONLY_ROW)
  ) {
    return false;
  }
  if (
    !matchesAny(ingredientName, FAT_INTENT) &&
    matchesAny(candidateText, FAT_ONLY_ROW)
  ) {
    return false;
  }
  return true;
}

/**
 * The live `đùi gà` pool contains eight saturated lexical ties. Fetch enough
 * rows for the categorical species filter above to see past those ties; the
 * public top-K remains unchanged. Explicit species queries keep the normal
 * limit because no negative species filter applies to them.
 */
export function sourceLimitForIngredient(
  ingredientName: string,
  configuredLimit: number
): number {
  const needsSpeciesGuard =
    BARE_CHICKEN.test(ingredientName) &&
    !matchesAny(ingredientName, QUALIFIED_NON_CHICKEN_SPECIES);
  return needsSpeciesGuard ? Math.max(configuredLimit, 8) : configuredLimit;
}
