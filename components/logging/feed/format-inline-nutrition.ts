export function formatMacroValue(value: number): string {
  return `${Math.round(value)}g`;
}

export function formatCaloriesValue(value: number): string {
  return `${Math.round(value)} kcal`;
}

/** Nullable macro formatter for persisted cards — renders `N/A` when absent. */
export function formatMacroOrNA(value: number | null): string {
  return value == null ? 'N/A' : formatMacroValue(value);
}

/** Nullable calorie formatter for persisted cards — renders `N/A` when absent. */
export function formatCaloriesOrNA(value: number | null): string {
  return value == null ? 'N/A' : formatCaloriesValue(value);
}
