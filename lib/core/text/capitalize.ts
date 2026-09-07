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
 * The first-word check stands in for provenance the meal model does not
 * carry — typed, scanned, or OCR'd. A `source` on the meal would replace it.
 *
 * Mirrors mobile `capitalizeFirst`
 * (`apps/mobile-flutter/lib/shared/logic/display_format.dart`), brand rule
 * included — keep the two in sync.
 */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  const space = s.indexOf(' ');
  const first = space === -1 ? s : s.slice(0, space);
  if (first !== first.toLowerCase()) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
