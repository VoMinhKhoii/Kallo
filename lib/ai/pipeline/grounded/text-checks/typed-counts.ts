/**
 * The counts a meal text states, read by code: digits, fractions ("1/2",
 * "½", "1 1/2"), halves ("nửa", "rưỡi") and number words in Vietnamese and
 * English. `dish-count.ts` holds Call 1's dish counts to these.
 */

const NUMBER_WORDS: Record<string, number> = {
  a: 1,
  an: 1,
  one: 1,
  một: 1,
  two: 2,
  couple: 2,
  pair: 2,
  double: 2,
  hai: 2,
  đôi: 2,
  three: 3,
  ba: 3,
  four: 4,
  bốn: 4,
  tư: 4,
  five: 5,
  năm: 5,
  six: 6,
  sáu: 6,
  seven: 7,
  bảy: 7,
  eight: 8,
  tám: 8,
  nine: 9,
  chín: 9,
  ten: 10,
  mười: 10,
  dozen: 12,
  zero: 0,
  half: 0.5,
  nửa: 0.5,
  nua: 0.5,
  quarter: 0.25,
  third: 1 / 3,
};
/** "three quarters", "two thirds", "3 quarters". */
const PARTS_OF = new RegExp(
  `(?<![\\p{L}\\p{M}\\d])(\\d+|${Object.keys(NUMBER_WORDS).join('|')})[\\s-]+(quarters|thirds)(?![\\p{L}\\p{M}])`,
  'giu'
);
const VULGAR: Record<string, number> = {
  '½': 0.5,
  '¼': 0.25,
  '¾': 0.75,
  '⅓': 1 / 3,
  '⅔': 2 / 3,
};
const WORD = new RegExp(
  `(?<![\\p{L}\\p{M}])(?:${Object.keys(NUMBER_WORDS).join('|')})(?![\\p{L}\\p{M}])`,
  'giu'
);
const DIGITS = /(\d+(?:[.,]\d+)?)(?:\s*\/\s*(\d+))?/g;
/** "1 1/2", "2 ½": a whole number and a fraction. */
const MIXED = /(\d+)\s+(\d+)\s*\/\s*(\d+)|(\d+)\s*([½¼¾⅓⅔])/gu;
/** "tô rưỡi" (one and a half bowls), "2 tô rưỡi", "two and a half". */
const AND_A_HALF =
  /(?<![\p{L}\p{M}])(?:rưỡi|ruoi|and a half)(?![\p{L}\p{M}])/iu;

/** Every count the text can mean: its digits, fractions and number words. */
function countsIn(text: string): number[] {
  const counts: number[] = [];
  for (const m of text.matchAll(DIGITS)) {
    const n = Number(m[1].replace(',', '.'));
    counts.push(m[2] ? n / Number(m[2]) : n);
  }
  for (const m of text.matchAll(MIXED))
    counts.push(
      m[1]
        ? Number(m[1]) + Number(m[2]) / Number(m[3])
        : Number(m[4]) + VULGAR[m[5]]
    );
  for (const m of text.matchAll(WORD))
    counts.push(NUMBER_WORDS[m[0].toLowerCase()]);
  for (const m of text.matchAll(PARTS_OF)) {
    const n = Number(m[1]) || NUMBER_WORDS[m[1].toLowerCase()];
    counts.push(n / (m[2].toLowerCase() === 'quarters' ? 4 : 3));
  }
  for (const [sign, n] of Object.entries(VULGAR))
    if (text.includes(sign)) counts.push(n);
  if (AND_A_HALF.test(text)) {
    // "2 tô rưỡi" is 2.5; a bare "tô rưỡi" is one and a half.
    const halves = counts.map((n) => n + 0.5);
    counts.push(...(halves.includes(1.5) ? halves : [...halves, 1.5]));
  }
  return counts;
}

/** Whether the text states `count` anywhere. */
export function isTypedCount(count: number, text: string): boolean {
  return countsIn(text).some((n) => Math.abs(n - count) < 0.01);
}
