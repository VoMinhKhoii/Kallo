export function formatMacroValue(value: number): string {
  return `${Math.round(value)}g`;
}

export function formatCaloriesValue(value: number): string {
  return `${Math.round(value)} kcal`;
}
