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
 * Scripts written without spaces: a rice word inside a longer run still
 * counts (공깃밥, 一碗米饭, ข้าวสวย), minus the runs where the same letters are
 * something else: スライス / プライス (slice, price), 케밥 (kebab), ข้าวโพด
 * (corn) and the other grains, and the meal-time words 朝ごはん / 早饭 /
 * 아침밥 (breakfast, any food). Bare 饭 / 飯 also means "a meal" (吃饭), so
 * only the rice compounds count.
 */
const RICE_IN_RUN = new RegExp(
  [
    '(?<!케|아침|점심|저녁)밥',
    '(?<![朝昼晩夕])(?:ご飯|ごはん)',
    '(?<![スプ])ライス',
    '(?:米|白|碗|炒)[饭飯]',
    'ข้าว(?!โพด|โอ๊ต|สาลี|บาร์เลย์|ฟ่าง|ไรย์)',
  ].join('|'),
  'u'
);

export function mentionsRice(mealText: string): boolean {
  const text = mealText.normalize('NFC');
  return RICE_WORD.test(text) || RICE_IN_RUN.test(text);
}
