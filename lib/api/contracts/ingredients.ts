/**
 * Contract for `GET /api/v1/ingredients/search`.
 *
 * Imported by mobile clients, so this file must NEVER value-import a server
 * action or any 'server-only'/db/supabase module — zod schemas and pure types
 * only.
 */
import { z } from 'zod';

export type {
  IngredientSearchResponse,
  IngredientSearchResult,
} from '@/lib/logging/manual-logging';

/**
 * Query params for the deterministic ingredient search. An empty `q` switches
 * to "recent foods" mode: the user's most recently logged ingredients, for
 * instant suggestions before they type.
 */
export const ingredientSearchQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});

export type IngredientSearchQuery = z.infer<typeof ingredientSearchQuerySchema>;
