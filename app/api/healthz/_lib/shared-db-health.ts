import { sql } from 'drizzle-orm';

import { db } from '@/lib/infra/db/client';

/**
 * The schema invariants a deploy is allowed to go live on, probed once per
 * instance per window.
 *
 * These are not liveness checks — they are the deploy smoke gate
 * (`scripts/cloud-run/smoke-check.sh`, which promotes the candidate revision
 * only when this route answers `"ok":true`). Each one has cost a real outage:
 * a missing `on_auth_user_created` trigger silently signs users up without a
 * profile, and an unseeded food table makes every meal analysis unmatched.
 *
 * They are `EXISTS`, not `COUNT(*)`: nothing here needs to know HOW MANY
 * seeded rows or orphaned users there are, and on a large table the count is
 * a sequential scan run by an endpoint anyone on the internet may call.
 */

/**
 * The structural probe — table/column/trigger presence and orphaned users. It
 * references the food table ONLY through `to_regclass` / `information_schema`,
 * never by a direct `FROM public.vietnamese_food_composition`. Postgres binds
 * table references at PARSE time, even inside an unreachable `CASE` branch, so a
 * direct reference to an absent table throws before any row is returned. Reading
 * existence out of the catalog instead never errors, so the seeded-row check can
 * be gated on the result rather than parsed alongside it.
 */
interface StructuralHealthRow extends Record<string, unknown> {
  has_user_profiles: boolean;
  has_food_table: boolean;
  has_food_source_id: boolean;
  has_new_user_trigger: boolean;
  has_orphaned_auth_users: boolean;
}

interface SeededFoodRow extends Record<string, unknown> {
  has_seeded_food: boolean;
}

export interface SharedDatabaseHealth {
  hasUserProfiles: boolean;
  hasFoodTable: boolean;
  hasFoodSourceId: boolean;
  hasNewUserTrigger: boolean;
  hasSeededFood: boolean;
  hasOrphanedAuthUsers: boolean;
}

export interface SharedDatabaseHealthResult {
  ok: boolean;
  checks: SharedDatabaseHealth;
}

/** How long a HEALTHY answer is reused. See `probe()` for why only healthy. */
const CACHE_TTL_MS = 30_000;

let inFlight: Promise<SharedDatabaseHealthResult> | null = null;
let cached: { at: number; result: SharedDatabaseHealthResult } | null = null;

/**
 * Whether the food table is seeded — a SEPARATE query, run only once the
 * structural probe has confirmed the table and column exist. Direct references
 * to `public.vietnamese_food_composition` are safe here precisely because we
 * never reach this statement when the table is absent.
 */
async function seededFood(): Promise<boolean> {
  const rows = await db.execute<SeededFoodRow>(sql`
    SELECT EXISTS (
      SELECT 1
      FROM public.vietnamese_food_composition
      WHERE source_id = 1
    ) AS has_seeded_food;
  `);
  return rows[0]?.has_seeded_food ?? false;
}

async function query(): Promise<SharedDatabaseHealthResult> {
  const rows = await db.execute<StructuralHealthRow>(sql`
    WITH checks AS (
      SELECT
        (to_regclass('public.user_profiles') IS NOT NULL) AS has_user_profiles,
        (to_regclass('public.vietnamese_food_composition') IS NOT NULL) AS has_food_table,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'vietnamese_food_composition'
            AND column_name = 'source_id'
        ) AS has_food_source_id,
        EXISTS (
          SELECT 1
          FROM pg_trigger AS trigger
          JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'auth'
            AND relation.relname = 'users'
            AND trigger.tgname = 'on_auth_user_created'
            AND NOT trigger.tgisinternal
        ) AS has_new_user_trigger
    ),
    orphans AS (
      SELECT
        CASE
          WHEN (SELECT has_user_profiles FROM checks)
          THEN EXISTS (
            SELECT 1
            FROM auth.users AS auth_user
            LEFT JOIN public.user_profiles AS profile
              ON profile.user_id = auth_user.id
            WHERE profile.user_id IS NULL
          )
          ELSE EXISTS (SELECT 1 FROM auth.users)
        END AS has_orphaned_auth_users
    )
    SELECT
      has_user_profiles,
      has_food_table,
      has_food_source_id,
      has_new_user_trigger,
      has_orphaned_auth_users
    FROM checks, orphans;
  `);
  const [row] = rows;

  if (!row) {
    throw new Error('Shared database health query returned no rows.');
  }

  // Only probe the seeded row when the table and its column both exist —
  // otherwise the `FROM public.vietnamese_food_composition` inside it would fail
  // to parse. An absent table is `hasSeededFood: false`, reported not thrown.
  const hasSeededFood =
    row.has_food_table && row.has_food_source_id ? await seededFood() : false;

  const checks: SharedDatabaseHealth = {
    hasUserProfiles: row.has_user_profiles,
    hasFoodTable: row.has_food_table,
    hasFoodSourceId: row.has_food_source_id,
    hasNewUserTrigger: row.has_new_user_trigger,
    hasSeededFood,
    hasOrphanedAuthUsers: row.has_orphaned_auth_users,
  };

  return {
    ok:
      checks.hasUserProfiles &&
      checks.hasFoodTable &&
      checks.hasFoodSourceId &&
      checks.hasNewUserTrigger &&
      checks.hasSeededFood &&
      !checks.hasOrphanedAuthUsers,
    checks,
  };
}

/**
 * Probe, at most once at a time and at most once per 30 s per instance.
 *
 * `/api/healthz` is unauthenticated and polled by uptime monitors, the deploy
 * gate, and every mobile cold start, on a pool of TWO connections per
 * instance. Without this, a burst of probes is a self-inflicted denial of
 * service against the database the probe exists to report on. Concurrent
 * callers share the in-flight promise; later ones read the cached result.
 *
 * Only a HEALTHY result is cached. An unhealthy one has to be re-queried,
 * because the deploy smoke gate retries five times over ten seconds expecting
 * the state to change — caching a `false` would make that loop meaningless
 * and turn one badly-timed probe into a failed deploy. A thrown error is not
 * cached for the same reason.
 */
export function probeSharedDatabaseHealth(): Promise<SharedDatabaseHealthResult> {
  if (cached && Date.now() - cached.at < CACHE_TTL_MS) {
    return Promise.resolve(cached.result);
  }

  inFlight ??= query()
    .then((result) => {
      if (result.ok) cached = { at: Date.now(), result };
      return result;
    })
    .finally(() => {
      inFlight = null;
    });

  return inFlight;
}

/** Drops the cached result and any in-flight probe. Tests only. */
export function resetSharedDatabaseHealthForTests() {
  inFlight = null;
  cached = null;
}
