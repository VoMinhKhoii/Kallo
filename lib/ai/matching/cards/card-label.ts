import type { CatalogRow } from './card-catalog';

/**
 * The label Call 2 reads for a card candidate: the curated food and its facets,
 * the Vietnamese display name, and the source row's own English name. Siblings
 * can share a card label (the curator folds grade into facets), so the row name
 * keeps "choice" vs "select" visible to the chooser in every locale.
 */
export function cardLabel(row: CatalogRow): string {
  if (!row.card) return row.namePrimary;
  const { food, facets, namesVi } = row.card;
  const base = `${food}${facets.length ? `, ${facets.join(', ')}` : ''} / ${namesVi[0] ?? ''}`;
  return row.nameEn ? `${base} [row: ${row.nameEn}]` : base;
}
