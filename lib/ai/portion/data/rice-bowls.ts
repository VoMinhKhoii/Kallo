/**
 * One everyday bowl of plain cooked rice, by the user's country. Client-safe
 * data: the AI's grams hint and guard band, and the portion picker's small
 * bowl of rice, all read the same number.
 *
 * A hint, never a pin: Call 2 is told the size and kept inside its band, but
 * no grams are fixed on the server (owner ruling 2026-10-22).
 */

import type { GramsBand } from '@/lib/ai/portion/types';

/**
 * Grams of cooked rice in one everyday bowl (or the cup / plate portion where
 * rice is not eaten from bowls), keyed by the profile's country value
 * (`lib/domain/onboarding/data/countries.ts`). Researched 2026-10-23; "est."
 * marks countries whose guideline gives only a smaller nutrition serving, so
 * the figure is the usual portion worked out from it.
 */
const RICE_BOWL_MID_G: Record<string, number> = {
  // Owner ruling 2026-10-22; NIN's pyramid puts a bowl at 110 g.
  Vietnam: 120,
  // Hetbahn's standard pack and the restaurant 공깃밥.
  'South Korea': 210,
  // MAFF 食事バランスガイド: a medium 茶碗 is 150 g.
  Japan: 150,
  // HPA exchange table: a 250 ml bowl, 1/4 bowl = 40 g.
  Taiwan: 160,
  // est.: the same 250–300 ml bowl as Taiwan.
  China: 160,
  'Hong Kong': 160,
  // USDA FoodData Central: 1 cup cooked long-grain = 158 g.
  'United States': 160,
  // Pinggang Pinoy: 1 cup per meal.
  Philippines: 160,
  // est.: a meal is about 1 cup (2 serves).
  Australia: 160,
  // BNF portion: 65–75 g dry, about 180 g cooked.
  'United Kingdom': 180,
  // NIPH food-based dietary guideline: 1 small bowl = 140 g.
  Cambodia: 140,
  // est.: a plate of 2–3 ladles (Thailand), 2 scoops (Malaysia), above the
  // 100 g porsi (Indonesia) and the 100 g serving (Singapore); a katori (India).
  Thailand: 150,
  Malaysia: 150,
  Indonesia: 150,
  Singapore: 150,
  India: 150,
};

/** No country on the profile, or a country with no researched figure: about
 *  one cup of cooked rice, between the Japanese bowl and the US cup. */
const DEFAULT_RICE_BOWL_MID_G = 150;

/** A small or part-filled bowl is a third less; a full or heaped one, a third
 *  more (80 / 120 / 160 for a Vietnamese chén, 140 / 210 / 280 for a Korean
 *  공깃밥). */
function bandAround(mid: number): GramsBand {
  return {
    low: Math.round((mid * 2) / 3 / 10) * 10,
    mid,
    high: Math.round((mid * 4) / 3 / 10) * 10,
  };
}

/** The user's bowl of rice: country of origin first, then residence. */
export function riceBowlFor(profile: {
  countryOfOrigin?: string | null;
  countryOfResidence?: string | null;
}): GramsBand {
  const mid =
    RICE_BOWL_MID_G[profile.countryOfOrigin ?? ''] ??
    RICE_BOWL_MID_G[profile.countryOfResidence ?? ''] ??
    DEFAULT_RICE_BOWL_MID_G;
  return bandAround(mid);
}

/** Whole words only, in any script: `\b` is ASCII-only, so a bare
 *  substring would let "rang" (cơm rang) match "orange". */
const words = (alternatives: string) =>
  new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, 'iu');

const RICE_WORD = words('rice');
/** The only words an English name of plain cooked rice may carry besides
 *  "rice" — what Call 1's `queryEn` and the food cards write ("steamed white
 *  rice, cooked"; "long-grain white rice, cooked without salt, unenriched").
 *  An allowlist, not a blocklist: any other word (pasta, cereal, fried,
 *  pudding…) makes it a different food, so a new rice product cannot slip in. */
const PLAIN_RICE_WORDS = new Set([
  'rice',
  'white',
  'brown',
  'steamed',
  'cooked',
  'boiled',
  'plain',
  'jasmine',
  'basmati',
  'japonica',
  'calrose',
  'fragrant',
  'long',
  'medium',
  'short',
  'grain',
  'regular',
  'enriched',
  'unenriched',
  'parboiled',
  'salted',
  'unsalted',
  'with',
  'without',
  'salt',
  'added',
  'no',
  'of',
  'a',
  'broken',
  'hot',
  'warm',
  'cold',
  'leftover',
  // Portion notes Call 1 sometimes leaves in queryEn ("plain cooked white
  // rice, half bowl", "…, second helping"): they never change the food.
  'bowl',
  'bowls',
  'cup',
  'cups',
  'box',
  'serving',
  'portion',
  'helping',
  'half',
  'third',
  'thirds',
  'one',
  'two',
  'second',
  'seconds',
  'extra',
  'plus',
  'heaped',
  'full',
  'small',
  'large',
  'big',
  'about',
  'eaten',
  'the',
  'and',
]);
/** Local names count only as the WHOLE name: "cơm" is plain rice, but "cơm
 *  gà" is chicken rice and "dal bhat" is lentils with rice. */
const LOCAL_PLAIN_RICE = new Set(
  [
    'cơm',
    'cơm trắng',
    'cơm tẻ',
    'bhaat',
    'bhat',
    'chawal',
    'kanin',
    'nasi putih',
    'ข้าวสวย',
    '밥',
    '공깃밥',
    '흰밥',
    'ご飯',
    'ごはん',
    '白飯',
    '白饭',
    '米饭',
    '米飯',
  ].map((name) => name.normalize('NFC'))
);
/** Vietnamese words that make a cơm something else, for rows whose English
 *  name is missing. */
const NOT_PLAIN_COM = words('chiên|rang|cháo|nếp|xôi');

/** What one name says: plain rice, another food made with rice, or nothing
 *  about rice (a name in a script we do not read, a Vietnamese row name). */
function riceVerdict(name: string): 'plain' | 'other' | null {
  if (LOCAL_PLAIN_RICE.has(name.toLowerCase())) return 'plain';
  if (NOT_PLAIN_COM.test(name)) return 'other';
  if (!RICE_WORD.test(name)) return null;
  const extra = name
    .toLowerCase()
    .split(/[^\p{L}]+/u)
    .filter((word) => word && !PLAIN_RICE_WORDS.has(word));
  return extra.length === 0 ? 'plain' : 'other';
}

/** Plain cooked rice, named in any language: at least one name says plain
 *  rice and none says another rice food. Call 1 always writes an English
 *  `queryEn` ("steamed white rice, cooked"), so English carries most cases;
 *  the local names cover rows without it. */
export function isPlainRice(names: Array<string | null | undefined>): boolean {
  const verdicts = names
    .filter((name): name is string => !!name)
    .map((name) => riceVerdict(name.normalize('NFC').trim()));
  return verdicts.includes('plain') && !verdicts.includes('other');
}
