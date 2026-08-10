'use server';

import { relogCandidatesQuerySchema } from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth';
import { db } from '@/lib/db';
import { loadRelogDishCandidates } from '@/lib/logging/relog/dish-query';
import { loadRelogMealCandidates } from '@/lib/logging/relog/meal-query';
import type { RelogCandidatesResponse } from '@/lib/logging/relog/relog';
import { withRelogGuard } from '@/lib/rate-limit/relog-guard';

// `relogCandidatesQuerySchema` lives in the meals contract so the route can
// reuse it; imported here since this 'use server' module may only export async
// functions.

/**
 * Candidates for the composer's `/` picker: the user's past dishes (MÓN) and
 * past meals (BỮA ĂN), matched and ranked entirely in SQL.
 *
 * Deterministic by construction — no embeddings, no LLM, no AI spend on this
 * path. That is not only a cost decision: `meals`/`meal_items` store
 * goal-adjusted macros with no goal/aggression snapshot, so a past dish's
 * accepted numbers cannot be re-derived. The picker therefore points at stored
 * rows and the writer copies them verbatim.
 *
 * An empty `q` is not a special case — the frequency×recency score already
 * surfaces the user's staples, so there is no separate "recents" query to keep
 * in sync (unlike the ingredient-catalog search, which needs one).
 *
 * The two arms are independent, so they run in parallel: the round-trip is one
 * query deep, not two.
 */
export async function loadRelogCandidatesAction(input: {
  q?: string;
  limit?: number;
}): Promise<RelogCandidatesResponse> {
  const { q, limit } = relogCandidatesQuerySchema.parse({
    q: input.q ?? undefined,
    limit: input.limit ?? undefined,
  });
  const { user } = await requireAuthAndProfile();

  // Throttled HERE, not at the route: the web composer calls this action
  // directly, so a route-level guard would leave that caller unlimited. The
  // scan is `lower(unaccent(col)) LIKE '%…%'` — no index applies — and both
  // arms run in parallel against a pool that defaults to 2 connections.
  return withRelogGuard(
    'candidates',
    'meals-relog-candidates',
    user.id,
    async () => {
      const [dishes, meals] = await Promise.all([
        loadRelogDishCandidates(db, { userId: user.id, query: q, limit }),
        loadRelogMealCandidates(db, { userId: user.id, query: q, limit }),
      ]);
      return { dishes, meals };
    }
  );
}
