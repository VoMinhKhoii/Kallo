/**
 * The card catalog query, shared by the runtime catalog (`catalog.ts`) and the
 * deploy-time search artifact builder (`scripts/data/food-cards/
 * search-artifact/`), so the artifact always holds exactly the rows and columns
 * the runtime reads. Plain SQL text with the matchable source codes inlined as
 * literals (they are code constants, not input), so both a Drizzle
 * transaction and a bare postgres.js script can run it.
 */
import { MATCHABLE_SOURCE_CODES } from '@/lib/ai/matching/match-constants';

export type CatalogQueryRow = {
  id: string;
  source_code: string;
  state: string;
  name_en: string | null;
  name_primary: string;
  food: string | null;
  aliases_en: string[] | null;
  names_vi: string[] | null;
  part_cut: string | null;
  form_processing: string | null;
  cooking_method: string | null;
  fat_level: string | null;
  brand: string | null;
};

const literal = (s: string) => `'${s.replaceAll("'", "''")}'`;

/** Every card's composition row from a matchable source. */
export const CATALOG_ROWS_SQL = `SELECT v.id, s.code AS source_code, v.state, v.name_en, v.name_primary,
       c.food, c.aliases_en, c.names_vi, c.part_cut, c.form_processing,
       c.cooking_method, c.fat_level, c.brand
FROM vietnamese_food_composition v
JOIN ingredient_sources s ON s.id = v.source_id
JOIN food_cards c ON c.food_composition_id = v.id
WHERE s.code IN (${MATCHABLE_SOURCE_CODES.map(literal).join(', ')})`;
