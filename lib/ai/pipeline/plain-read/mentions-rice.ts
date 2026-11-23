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
 * "com" is cơm typed without accents ("com tam"). Romanised "bap" is left
 * out: without accents it is also bắp, corn. So is "jasmine" (jasmine tea).
 */
const RICE_WORD = wholeWords(
  'rice|cơm|com|gạo|nasi|arroz|riz|riso|reis|kanin|chawal|bhaat|bhat|gohan|basmati|bibimbap'
);

/**
 * Scripts written without spaces: any rice character counts, inside any run
 * (공깃밥, 卤肉饭, カレーライス, ข้าวสวย). This leans to firing on purpose. The
 * same letters also write "a meal" (早饭, 朝ごはん, ข้าวเช้า), kebab (케밥),
 * slice (スライス) and corn (ข้าวโพด), and listing those out only traded
 * missed rice dishes for missed exceptions. A needless sentence moved the
 * read within its own run-to-run noise (2026-11-24); a missing one brings
 * back the 160–200 g bowl.
 */
const RICE_IN_RUN = /밥|飯|饭|ごはん|ライス|ข้าว/u;

export function mentionsRice(mealText: string): boolean {
  const text = mealText.normalize('NFC');
  return RICE_WORD.test(text) || RICE_IN_RUN.test(text);
}
