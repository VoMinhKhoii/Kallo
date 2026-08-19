/**
 * Parse a user-entered numeric string into a number, tolerating the comma
 * decimal separator that iOS/EU keyboards emit (e.g. "65,3" → 65.3).
 * Returns NaN for blank input so Zod number validation rejects it.
 */
export function parseDecimalInput(value: string | number): number {
  if (typeof value === 'number') return value;
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}
