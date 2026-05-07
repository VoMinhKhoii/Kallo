export type SupportedOutputLanguage = 'en' | 'vi';
export type MealInputLanguage = SupportedOutputLanguage | 'mixed' | 'unknown';

export type LanguageDetectionReason =
  | 'vietnamese_diacritics'
  | 'vietnamese_food_word'
  | 'english_ascii'
  | 'locale_fallback'
  | 'default_fallback';

export interface LanguageDecision {
  inputLanguage: MealInputLanguage;
  outputLanguage: SupportedOutputLanguage;
  reason: LanguageDetectionReason;
}

export interface LanguageDecisionOptions {
  localeFallback?: SupportedOutputLanguage | null;
}

const DEFAULT_OUTPUT_LANGUAGE = 'en' satisfies SupportedOutputLanguage;

const vietnameseDiacriticPattern =
  /[ăâđêôơưáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵ]/iu;
const letterPattern = /\p{L}/gu;
const latinLetterPattern = /\p{Script=Latin}/u;
const markPattern = /\p{Mark}/gu;
const tokenPattern = /\p{L}+/gu;

const vietnameseFoodTokens = new Set([
  'banh',
  'bo',
  'bun',
  'ca',
  'canh',
  'cha',
  'chao',
  'com',
  'ga',
  'goi',
  'heo',
  'kho',
  'mam',
  'mien',
  'muc',
  'nem',
  'nuong',
  'pho',
  'rau',
  'suon',
  'tam',
  'thit',
  'tom',
  'xao',
  'xoi',
]);

const vietnameseFoodPhrases = [
  'banh mi',
  'banh xeo',
  'bun bo',
  'bun cha',
  'bun thit',
  'ca kho',
  'canh chua',
  'com tam',
  'goi cuon',
  'nuoc mam',
  'pho bo',
  'thit kho',
];

const englishMealTokens = new Set([
  'and',
  'beef',
  'burger',
  'chicken',
  'egg',
  'eggs',
  'extra',
  'fish',
  'fried',
  'grilled',
  'kfc',
  'noodle',
  'noodles',
  'pork',
  'rice',
  'salad',
  'salmon',
  'soup',
  'steak',
  'the',
  'with',
  'zinger',
]);

function normalizeAscii(value: string): string {
  return value
    .normalize('NFD')
    .replace(markPattern, '')
    .replace(/đ/giu, 'd')
    .toLowerCase();
}

function tokenize(value: string): string[] {
  return normalizeAscii(value).match(tokenPattern) ?? [];
}

function hasOnlyLatinLetters(value: string): boolean {
  const letters = value.match(letterPattern);
  if (!letters) return false;

  return letters.every((letter) => latinLetterPattern.test(letter));
}

function countSetMatches(tokens: string[], values: Set<string>): number {
  let count = 0;
  for (const token of tokens) {
    if (values.has(token)) count += 1;
  }
  return count;
}

function countPhraseMatches(normalizedText: string): number {
  let count = 0;
  for (const phrase of vietnameseFoodPhrases) {
    if (normalizedText.includes(phrase)) count += 1;
  }
  return count;
}

export function detectMealInputLanguage(rawInput: string): MealInputLanguage {
  const trimmed = rawInput.trim();
  if (!trimmed) return 'unknown';

  const hasVietnameseDiacritics = vietnameseDiacriticPattern.test(trimmed);
  const tokens = tokenize(trimmed);
  const englishSignals = countSetMatches(tokens, englishMealTokens);

  if (hasVietnameseDiacritics) {
    return englishSignals > 0 ? 'mixed' : 'vi';
  }

  if (!hasOnlyLatinLetters(trimmed)) {
    return 'unknown';
  }

  const normalizedText = normalizeAscii(trimmed);
  const vietnameseSignals =
    countSetMatches(tokens, vietnameseFoodTokens) +
    countPhraseMatches(normalizedText);

  if (vietnameseSignals > 0 && englishSignals > 0) {
    return 'mixed';
  }

  if (vietnameseSignals >= 2) {
    return 'vi';
  }

  if (vietnameseSignals === 1 && tokens.length <= 4) {
    return 'vi';
  }

  return 'en';
}

function hasVietnameseFoodSignal(rawInput: string): boolean {
  const tokens = tokenize(rawInput);
  const normalizedText = normalizeAscii(rawInput);

  return (
    countSetMatches(tokens, vietnameseFoodTokens) +
      countPhraseMatches(normalizedText) >
    0
  );
}

export function decideMealLanguage(
  rawInput: string,
  options: LanguageDecisionOptions = {}
): LanguageDecision {
  const inputLanguage = detectMealInputLanguage(rawInput);

  if (inputLanguage === 'vi') {
    return {
      inputLanguage,
      outputLanguage: 'vi',
      reason: vietnameseDiacriticPattern.test(rawInput)
        ? 'vietnamese_diacritics'
        : 'vietnamese_food_word',
    };
  }

  if (inputLanguage === 'en') {
    return {
      inputLanguage,
      outputLanguage: 'en',
      reason: hasVietnameseFoodSignal(rawInput)
        ? 'vietnamese_food_word'
        : 'english_ascii',
    };
  }

  if (options.localeFallback) {
    return {
      inputLanguage,
      outputLanguage: options.localeFallback,
      reason: 'locale_fallback',
    };
  }

  return {
    inputLanguage,
    outputLanguage: DEFAULT_OUTPUT_LANGUAGE,
    reason: 'default_fallback',
  };
}
