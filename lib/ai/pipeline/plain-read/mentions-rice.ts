/**
 * Does the meal text name rice? The read is told the person's bowl of rice
 * only then: on meals without rice the extra sentence only moved the read
 * (sourced-range eval, 2026-11-24: English single foods drifted with it).
 */

/** Whole words, in any script that spaces its words: `\b` is ASCII-only, so
 *  it would split "cơm" at the ơ. */
const wholeWords = (alternatives: string) =>
  new RegExp(`(?<!\\p{L})(?:${alternatives})(?!\\p{L})`, 'iu');

/**
 * "com" and "gao" are cơm and gạo typed without accents ("com tam", "gao
 * lut"). Romanised "bap" counts only at the end of a longer word (gonggibap,
 * bokkeumbap) and not in kebap: alone and without accents it is also bắp,
 * corn. German writes rice at the end of compounds (Basmatireis, Fertigreis,
 * Wokreis), but not after P (Preis, a price on a receipt). "jasmine" alone is
 * left out (jasmine tea).
 */
const RICE_WORD = wholeWords(
  'rice|cơm|com|gạo|gao|nasi|arroz|riz|riso|kanin|chawal|bhaat|bhat|gohan|basmati|\\p{L}+(?<!k[ea])bap|\\p{L}*(?<!p)reis'
);

/**
 * Scripts written without spaces: any rice character counts, inside any run
 * (공깃밥, 卤肉饭, 玄米, カレーライス, ข้าวสวย, បាយស). This leans to firing on
 * purpose. The same letters also write "a meal" (早饭, 朝ごはん, ข้าวเช้า),
 * kebab (케밥), slice (スライス) and corn (ข้าวโพด, 玉米), and listing those
 * out only traded missed rice dishes for missed exceptions. A needless
 * sentence moved the read within its own run-to-run noise (2026-11-24); a
 * missing one brings back the 160–200 g bowl.
 */
const RICE_IN_RUN = /밥|飯|饭|米|ごはん|ライス|ข้าว|បាយ/u;

export function mentionsRice(mealText: string): boolean {
  const text = mealText.normalize('NFC');
  return RICE_WORD.test(text) || RICE_IN_RUN.test(text);
}
