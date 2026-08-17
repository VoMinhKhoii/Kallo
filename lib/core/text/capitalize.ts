/**
 * Capitalize the first letter of a string, preserving the rest.
 * Handles Vietnamese diacritics correctly (e.g., "gạo tẻ" → "Gạo tẻ").
 */
export function capitalizeFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
