/**
 * Capitalize the first letter of a string, preserving the rest.
 * Handles Vietnamese diacritics correctly (e.g., "gạo tẻ" → "Gạo tẻ").
 *
 * A string whose FIRST WORD already carries an upper-case letter is returned
 * untouched: barcode and OCR products arrive with the brand's own casing
 * ("belVita cookies (30g)", "iPro shake"), and upper-casing the first
 * character rewrites a brand name the user never typed. Only an all-lowercase
 * first word is something a person plausibly typed into the composer.
 *
 * Mirrors mobile `capitalizeFirst`
 * (`apps/mobile-flutter/lib/shared/logic/display_format.dart`), brand rule
 * included — keep the two in sync.
 */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  const first = s.split(' ')[0];
  if (first !== first.toLowerCase()) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
