// Shared SQL fragments for the two relog candidate queries (dishes and whole
// meals). Kept in one module so the matching rules, the ranking expression and
// the tenancy/window predicates cannot drift between them — the two queries are
// the same search at different granularities.
import { type SQL, sql } from 'drizzle-orm';
import {
  escapeLikeToken,
  RELOG_LOOKBACK_DAYS,
} from '@/lib/domain/logging/relog/relog';

/** The only capability the candidate queries need. Typed structurally rather
 *  than as `AppDb | AppTransaction` so a pooled handle, a transaction, and a
 *  test-owned client all satisfy it — the queries are raw SQL and never touch
 *  the schema generic.
 *
 *  The result is a row array rather than `unknown`: that is what every Drizzle
 *  handle already returns from `execute()` (postgres-js resolves it to a
 *  `RowList`), and declaring it here is what lets the two candidate queries map
 *  their rows without a double cast at each call site. Column *values* stay
 *  `unknown` — the per-query readers name and coerce them. */
export interface RelogExecutor {
  execute: (query: SQL) => Promise<Record<string, unknown>[]>;
}

/**
 * Matching is SUBSTRING, not Postgres full-text search.
 *
 * FTS is word-boundary based and needs a language configuration; Postgres has
 * no Vietnamese one, so it would fall back to `simple` — no stemming, whole
 * tokens only — and "pho" would fail to match "Phở bò" while partial-word
 * typing ("s" → "sữa") would not work at all. A typeahead needs incremental
 * matching. FTS would also require a tsvector column + GIN index, i.e. a
 * migration; substring over the already-filtered per-user set needs neither.
 *
 * Trigram is likewise deliberately absent: `word_similarity` saturates (see the
 * long note in app/api/v1/ingredients/search/route.ts) and short Vietnamese
 * words need a 0.15 threshold. Over one user's ~200 dishes it would buy nothing
 * but noisier ordering.
 *
 * Diacritics: a query CONTAINING diacritics matches the accented column; a
 * pure-ASCII query matches the unaccented one (so "pho bo" finds "Phở bò" from
 * a laptop keyboard). Never both sides unaccented — diacritics are semantically
 * load-bearing (bò=beef, bơ=butter, bổ=nutritious). The has-diacritics decision
 * is made in SQL using the DB's own `unaccent`, so the fold used to test the
 * query and the fold used on the data cannot drift.
 */
export function matchesQuery(column: SQL | SQL.Aliased): SQL {
  return sql`(
    q.is_empty
    OR (
      q.has_diacritics
      AND lower(${column}) LIKE '%' || q.accented || '%' ESCAPE '\\'
    )
    OR (
      NOT q.has_diacritics
      AND lower(extensions.unaccent(${column}))
        LIKE '%' || q.ascii || '%' ESCAPE '\\'
    )
  )`;
}

/** The `q` CTE every candidate query cross-joins: the normalized query text in
 *  both folds plus the two flags the predicates branch on. LIKE metacharacters
 *  are escaped in TS (a lone `%` would otherwise match every row). */
export function queryCte(rawQuery: string): SQL {
  const escaped = escapeLikeToken(rawQuery.trim());
  return sql`
    q AS (
      SELECT
        lower(${escaped})                        AS accented,
        lower(extensions.unaccent(${escaped}))   AS ascii,
        ${escaped} <> extensions.unaccent(${escaped}) AS has_diacritics,
        ${escaped} = ''                          AS is_empty
    )
  `;
}

/**
 * Ranking: frequency damped by recency, so a staple outranks a one-off eaten
 * more recently.
 *
 *   score = ln(1 + occurrences) / (1 + days_since_last / 14)
 *
 * Sanity: 30× eaten, last 10d ago → 3.43/1.71 = 2.01; eaten once yesterday →
 * 0.69/1.07 = 0.64; 5× but 3 months ago → 1.79/6.43 = 0.28. Staples beat
 * one-offs beat stale. The 14-day constant is the "how often do I eat this"
 * window. An empty query uses the same expression — there is no separate
 * "recents" branch to keep in sync.
 */
export function scoreExpr(
  occurrenceCount: SQL | SQL.Aliased,
  lastLoggedAt: SQL | SQL.Aliased
): SQL {
  return sql`(
    ln(1 + ${occurrenceCount})
    / (1 + extract(epoch FROM now() - ${lastLoggedAt}) / 86400 / 14.0)
  )`;
}

/** Prefix matches sort above mid-string ones. Always folded to ASCII on both
 *  sides here: this is a display-ordering boost, not a filter, so over-matching
 *  can only reorder rows the filter already admitted — it can never surface a
 *  "bơ" dish for a "bò" query. */
export function prefixBoost(column: SQL | SQL.Aliased): SQL {
  return sql`(
    NOT q.is_empty
    AND lower(extensions.unaccent(${column})) LIKE q.ascii || '%' ESCAPE '\\'
  )`;
}

/**
 * Which source meals a relog may draw from. Shared by both queries AND
 * re-asserted by the writer, so the picker and the commit agree on eligibility.
 *
 * - `user_id` — the real tenant boundary. Drizzle runs on the owner connection
 *   and BYPASSES RLS, so this predicate is not belt-and-braces.
 * - `portion_factor = 1` — a split meal ("chia đôi") has ALREADY-HALVED item
 *   rows, because copyMealVerbatim wrote them scaled. Copying those verbatim
 *   under the full dish name would silently log half a bowl of phở as a full
 *   bowl. Since relog has no scaling UI, excluding them is the honest fix; a
 *   user who only ever ate a dish as a split still has meal-level "log again".
 * - `entry_mode <> 'cheat'` — cheat meals carry zero item rows so they could
 *   not surface anyway; stated for intent and planner clarity.
 * - the window is a scan cap only (the score already decays recency), which is
 *   why it is a year rather than the 90 days "recent foods" uses.
 */
export function eligibleSourceMeal(userId: string): SQL {
  return sql`
    m.user_id = ${userId}
    AND m.logged_at > now() - (${RELOG_LOOKBACK_DAYS} || ' days')::interval
    AND m.entry_mode <> 'cheat'
    AND m.portion_factor = 1
  `;
}

/** postgres.js returns `numeric` as a string and `SUM(numeric)` always does,
 *  even through Drizzle's `mode: 'number'` columns (raw sql`` wrappers drop
 *  that). Coerce with a finite guard; null stays null — unknown is not zero. */
export function toNullableNumber(value: unknown): number | null {
  if (value == null) return null;
  const parsed = typeof value === 'number' ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

/** Timestamps arrive as Date from postgres.js. Normalize to ISO for the wire. */
export function toIsoString(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}
