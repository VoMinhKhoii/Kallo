/**
 * The amounts a meal text states, read by code: every weight and calorie
 * figure typed with a digit, the shares and multiples of them the text
 * allows, and the food named beside one. `text-checks.ts` holds Call 1's
 * answer to these.
 */
import { fold } from '@/lib/core/text/fold';
import { nameKey } from '@/lib/core/text/name-key';

/** Grams in one of each unit a weight is typed in (a millilitre counts as a gram). */
const UNIT_G: Record<string, number> = {
  g: 1,
  gr: 1,
  gm: 1,
  gms: 1,
  gram: 1,
  grams: 1,
  gam: 1,
  ml: 1,
  cc: 1,
  cl: 10,
  lạng: 100,
  kg: 1000,
  kilo: 1000,
  kilos: 1000,
  kilogram: 1000,
  kilograms: 1000,
  ký: 1000,
  kí: 1000,
  cân: 1000,
  l: 1000,
  lít: 1000,
  lit: 1000,
  liter: 1000,
  liters: 1000,
  litre: 1000,
  litres: 1000,
  oz: 28.35,
  ounce: 28.35,
  ounces: 28.35,
  lb: 453.6,
  lbs: 453.6,
  pound: 453.6,
  pounds: 453.6,
};
/** Longest first, so "gram" is not read as "g" + "ram". */
const UNITS = Object.keys(UNIT_G)
  .sort((a, b) => b.length - a.length)
  .join('|');
/** "150g", "1,5 kg", "1/2 lb", "2 lạng rưỡi" (two and a half). */
const TYPED_WEIGHT = new RegExp(
  `(\\d+(?:[.,]\\d+)?)(?:\\s*/\\s*(\\d+))?\\s*(${UNITS})(?![\\p{L}\\p{N}])(\\s+rưỡi(?!\\p{L}))?`,
  'giu'
);
/**
 * A weight whose number is a word ("nửa ký", "half a pound", "six oz"): a
 * unit with no digit before it. Single letters and "cân" (also the verb "to
 * weigh") are words on their own, so only "nửa cân" counts for them.
 */
const WORD_WEIGHT = new RegExp(
  `(?<![\\p{L}\\p{N}])(?:${Object.keys(UNIT_G)
    .filter((u) => u.length > 1 && u !== 'cân' && u !== 'gr' && u !== 'lit')
    .join('|')})(?![\\p{L}\\p{N}])|nửa\\s+cân(?!\\p{L})`,
  'iu'
);

export interface TypedWeight {
  grams: number;
  /** Where the weight starts and ends in the normalized text. */
  start: number;
  end: number;
}

/**
 * Every weight typed with a digit, in grams. `null` when the text also holds a
 * weight written in words, which is not read here: nothing can then be checked.
 */
export function typedWeights(mealText: string): TypedWeight[] | null {
  const text = mealText.normalize('NFC');
  const found: TypedWeight[] = [];
  for (const m of text.matchAll(TYPED_WEIGHT)) {
    const [whole, number, divisor, unit, andAHalf] = m;
    const perUnit = UNIT_G[unit.toLowerCase()];
    // "1.200g" is a thousands separator, "1.2kg" and "0.250g" a decimal.
    const thousands = perUnit === 1 && /^[1-9]\d{0,2}[.,]\d{3}$/.test(number);
    const n =
      Number(number.replace(/[.,]/, thousands ? '' : '.')) /
      (divisor ? Number(divisor) : 1);
    const grams = (n + (andAHalf ? 0.5 : 0)) * perUnit;
    if (grams > 0)
      found.push({ grams, start: m.index, end: m.index + whole.length });
  }
  const rest = found.reduceRight(
    (t, w) =>
      t.slice(0, w.start) + ' '.repeat(w.end - w.start) + t.slice(w.end),
    text
  );
  return WORD_WEIGHT.test(rest) ? null : found;
}

/** The user's share of a typed weight: half, a third, "split between the 4 of us". */
const SHARES = [
  1,
  ...[2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => 1 / n),
  2 / 3,
  3 / 4,
];
/** Counts written as words, for "two 150g chicken breasts". */
const COUNT_WORDS: Record<string, number> = {
  two: 2,
  both: 2,
  double: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  hai: 2,
  ba: 3,
  bốn: 4,
  năm: 5,
  sáu: 6,
};
const COUNT_WORD = new RegExp(
  `(?<!\\p{L})(?:${Object.keys(COUNT_WORDS).join('|')})(?!\\p{L})`,
  'giu'
);
/**
 * How many of a typed weight the text can mean ("2 x 150g", "3 quả trứng 60g
 * mỗi quả"): only a count the text itself holds, so a weight Call 1 made up
 * is not passed as some multiple of a typed one.
 */
function typedCounts(text: string): number[] {
  const counts = new Set<number>();
  for (const m of text.matchAll(/(?<![\d.,/])\d{1,2}(?![\d.,/]*\d)/g))
    counts.add(Number(m[0]));
  for (const m of text.matchAll(COUNT_WORD))
    counts.add(COUNT_WORDS[m[0].toLowerCase()]);
  return [...counts].filter((n) => n >= 2 && n <= 12);
}
/** Shares typed as a percentage ("ate 60% of it"), allowed only when the text has one. */
const PERCENT_FACTORS = [2, 3, 4, 6, 7, 8, 9].map((n) => n / 10);
const PERCENT = /%|phần trăm|percent/iu;
/** Rounding room: "6 oz" is 170.1 g and Call 1 is told 1 oz ≈ 28 g. */
export const near = (a: number, b: number) =>
  Math.abs(a - b) <= Math.max(2, 0.02 * Math.max(a, b));

/** Every sum of two or more of the typed weights (a plate of weighed parts). */
function sums(weights: number[]): number[] {
  if (weights.length < 2 || weights.length > 8) return [];
  const out: number[] = [];
  for (let mask = 3; mask < 1 << weights.length; mask++) {
    if ((mask & (mask - 1)) === 0) continue;
    out.push(weights.reduce((s, w, i) => (mask & (1 << i) ? s + w : s), 0));
  }
  return out;
}

/** True when `value` is a typed amount, a share or multiple of one, or a sum of several. */
export function isTypedAmount(
  value: number,
  amounts: number[],
  mealText: string,
  same: (a: number, b: number) => boolean = near
): boolean {
  const factors = [
    ...SHARES,
    ...typedCounts(mealText),
    ...(PERCENT.test(mealText) ? PERCENT_FACTORS : []),
  ];
  return (
    amounts.some((a) => factors.some((f) => same(value, a * f))) ||
    sums(amounts).some((s) => same(value, s))
  );
}

/** True when `grams` is a typed weight, a share or multiple of one, or a sum of several. */
export function isTypedWeight(
  grams: number,
  typed: TypedWeight[],
  mealText = ''
): boolean {
  return isTypedAmount(
    grams,
    typed.map((t) => t.grams),
    mealText
  );
}

const KCAL_WORD = 'kilocalories?|kcals?|calo|calories?|cals?';
/**
 * "160kcal", "90 calo", "285 cal", "1.200 kcal"; and the word first when no
 * number stands before it ("calories: 300", "kcal 285").
 */
const TYPED_KCAL = new RegExp(
  `(\\d+(?:[.,]\\d+)?)\\s*(?:${KCAL_WORD})(?![\\p{L}\\p{N}])|(?<![\\p{L}\\p{N}])(?<!\\d\\s{0,3})(?:${KCAL_WORD})\\s*[:=]?\\s*(\\d+(?:[.,]\\d+)?)(?![\\p{L}\\p{N}])`,
  'giu'
);

export interface TypedKcal {
  kcal: number;
  start: number;
  end: number;
}

export function typedKcals(text: string): TypedKcal[] {
  return [...text.matchAll(TYPED_KCAL)]
    .map((m) => {
      const number = m[1] ?? m[2];
      return {
        kcal: Number(
          number.replace(
            /[.,]/,
            /^[1-9]\d{0,2}[.,]\d{3}$/.test(number) ? '' : '.'
          )
        ),
        start: m.index,
        end: m.index + m[0].length,
      };
    })
    .filter((t) => t.kcal > 0);
}

/** Every calorie figure the user typed. */
export function typedCalories(mealText: string): number[] {
  return typedKcals(mealText.normalize('NFC')).map((t) => t.kcal);
}

/** Where a weighed food's name stops: a joiner, punctuation or another number. */
const PHRASE_END =
  /[,.;:+&()\d]|(?<!\p{L})(?:with|and|plus|kèm|với|và|thêm)(?!\p{L})/iu;
const LEADING_WORDS = /^(?:\s|of|an?|the|của)+/iu;

/** The food named right after a weight ("300g ribeye steak with fries" → "ribeye steak"). */
export function foodAfter(text: string, weight: TypedWeight): string {
  const rest = text.slice(weight.end).replace(LEADING_WORDS, '');
  const end = rest.search(PHRASE_END);
  return nameKey(end < 0 ? rest : rest.slice(0, end));
}

/** The food named right before a weight ("ức gà 200g với rau xào" → "ức gà"). */
export function foodBefore(text: string, weight: TypedWeight): string {
  const before = text.slice(0, weight.start);
  let cut = 0;
  for (const m of before.matchAll(new RegExp(PHRASE_END.source, 'giu')))
    cut = m.index + m[0].length;
  return nameKey(before.slice(cut));
}

export const wordsOf = (name: string) =>
  fold(name)
    .split(/[^\p{L}\p{N}]+/u)
    .filter(Boolean);
