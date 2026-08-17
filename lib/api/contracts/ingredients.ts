/**
 * Contract for `GET /api/v1/ingredients/search`. Zod schemas only — response
 * types live in `@/lib/domain/logging/manual-logging` (the single import path).
 */
import { z } from 'zod';

/**
 * Query params for the deterministic ingredient search. An empty `q` switches
 * to "recent foods" mode: the user's most recently logged ingredients, for
 * instant suggestions before they type.
 */
export const ingredientSearchQuerySchema = z.object({
  q: z.string().trim().max(120).default(''),
  limit: z.coerce.number().int().min(1).max(20).default(10),
});
