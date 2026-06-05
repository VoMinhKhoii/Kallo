/**
 * Number/date helpers for the dashboard surface.
 *
 * `parseDecimalInput` is vendored verbatim from lib/utils.ts — keep in sync. It
 * cannot be imported from `@/lib` because lib/utils.ts also imports
 * clsx/tailwind-merge, which must never enter the React Native bundle. It
 * tolerates the comma decimal separator iOS / VN keyboards emit; like the web,
 * it replaces only the FIRST comma.
 */
export function parseDecimalInput(value: string | number): number {
  if (typeof value === 'number') return value;
  const normalized = value.trim().replace(',', '.');
  if (normalized === '') return Number.NaN;
  return Number(normalized);
}
