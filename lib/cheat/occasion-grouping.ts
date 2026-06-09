/**
 * Grouping for the "log it again" chips. A user types the same occasion slightly
 * differently each time ("korean bbq", "Korean BBQ buffet", "bbq korean"), so we
 * group near-duplicates instead of deduping on exact text — otherwise the same
 * place shows up as several chips.
 *
 * Pure + framework-agnostic so it can be unit-tested without the DB.
 */

/** Lowercased, NFC, punctuation-split word tokens (Vietnamese diacritics kept). */
export function tokenizeOccasion(text: string): string[] {
  return text
    .normalize('NFC')
    .toLowerCase()
    .split(/[^\p{L}\p{N}]+/u)
    .filter((token) => token.length > 0);
}

const JACCARD_THRESHOLD = 0.6;

/**
 * Whether two occasion descriptions refer to the same outing. True when one's
 * words are a subset of the other's (the "korean bbq" ⊂ "korean bbq buffet"
 * case), or when their word sets overlap heavily (reordered / minor wording).
 */
export function areSameOccasion(a: string, b: string): boolean {
  const aTokens = new Set(tokenizeOccasion(a));
  const bTokens = new Set(tokenizeOccasion(b));

  // No usable words (emoji-only, punctuation) — fall back to exact text match.
  if (aTokens.size === 0 || bTokens.size === 0) {
    return a.trim().toLowerCase() === b.trim().toLowerCase();
  }

  let intersection = 0;
  for (const token of aTokens) {
    if (bTokens.has(token)) {
      intersection += 1;
    }
  }
  const smaller = Math.min(aTokens.size, bTokens.size);
  const union = aTokens.size + bTokens.size - intersection;

  // Subset (containment === 1) or strong overlap.
  return intersection === smaller || intersection / union >= JACCARD_THRESHOLD;
}

/**
 * Collapse rows (assumed newest-first) into at most `limit` representatives,
 * keeping the most recent wording of each grouped occasion.
 */
export function groupOccasions<T extends { rawInput: string }>(
  rows: T[],
  limit: number
): T[] {
  const reps: T[] = [];
  for (const row of rows) {
    if (reps.some((rep) => areSameOccasion(rep.rawInput, row.rawInput))) {
      continue;
    }
    reps.push(row);
    if (reps.length >= limit) {
      break;
    }
  }
  return reps;
}
