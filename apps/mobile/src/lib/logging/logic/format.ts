/** Inline nutrition formatting — matches the web's display conventions. */
export const fmtG = (n: number | null | undefined): string =>
  n == null ? 'N/A' : `${Math.round(n)}g`;

export const fmtKcal = (n: number | null | undefined): string =>
  n == null ? 'N/A' : `${Math.round(n)} kcal`;

export const round0 = (n: number | null | undefined): number =>
  n == null ? 0 : Math.round(n);
