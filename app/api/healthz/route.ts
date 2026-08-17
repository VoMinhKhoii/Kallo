import { sql } from 'drizzle-orm';
import { NextResponse } from 'next/server';

import { db } from '@/lib/infra/db';

export const runtime = 'nodejs';

interface SharedDatabaseHealthRow extends Record<string, unknown> {
  has_user_profiles: number;
  has_food_table: number;
  has_food_source_id: number;
  has_new_user_trigger: number;
  seeded_food_rows: number;
  orphaned_auth_users: number;
}

async function getSharedDatabaseHealth() {
  const rows = await db.execute<SharedDatabaseHealthRow>(sql`
    WITH checks AS (
      SELECT
        (to_regclass('public.user_profiles') IS NOT NULL)::int AS has_user_profiles,
        (to_regclass('public.vietnamese_food_composition') IS NOT NULL)::int AS has_food_table,
        EXISTS (
          SELECT 1
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'vietnamese_food_composition'
            AND column_name = 'source_id'
        )::int AS has_food_source_id,
        EXISTS (
          SELECT 1
          FROM pg_trigger AS trigger
          JOIN pg_class AS relation ON relation.oid = trigger.tgrelid
          JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
          WHERE namespace.nspname = 'auth'
            AND relation.relname = 'users'
            AND trigger.tgname = 'on_auth_user_created'
            AND NOT trigger.tgisinternal
        )::int AS has_new_user_trigger
    ),
    food AS (
      SELECT
        CASE
          WHEN (
            SELECT has_food_table = 1 AND has_food_source_id = 1
            FROM checks
          )
          THEN (
            SELECT COUNT(*)::int
            FROM public.vietnamese_food_composition
            WHERE source_id = 1
          )
          ELSE 0
        END AS seeded_food_rows
    ),
    orphans AS (
      SELECT
        CASE
          WHEN (SELECT has_user_profiles = 1 FROM checks)
          THEN (
            SELECT COUNT(*)::int
            FROM auth.users AS auth_user
            LEFT JOIN public.user_profiles AS profile
              ON profile.user_id = auth_user.id
            WHERE profile.user_id IS NULL
          )
          ELSE (
            SELECT COUNT(*)::int
            FROM auth.users
          )
        END AS orphaned_auth_users
    )
    SELECT
      has_user_profiles,
      has_food_table,
      has_food_source_id,
      has_new_user_trigger,
      seeded_food_rows,
      orphaned_auth_users
    FROM checks, food, orphans;
  `);
  const [row] = rows;

  if (!row) {
    throw new Error('Shared database health query returned no rows.');
  }

  return {
    hasUserProfiles: row.has_user_profiles === 1,
    hasFoodTable: row.has_food_table === 1,
    hasFoodSourceId: row.has_food_source_id === 1,
    hasNewUserTrigger: row.has_new_user_trigger === 1,
    seededFoodRows: row.seeded_food_rows,
    orphanedAuthUsers: row.orphaned_auth_users,
  };
}

export async function GET() {
  try {
    const checks = await getSharedDatabaseHealth();
    const ok =
      checks.hasUserProfiles &&
      checks.hasFoodTable &&
      checks.hasFoodSourceId &&
      checks.hasNewUserTrigger &&
      checks.seededFoodRows > 0 &&
      checks.orphanedAuthUsers === 0;

    return NextResponse.json(
      { ok, service: 'kallo', checks },
      { status: ok ? 200 : 503 }
    );
  } catch (error) {
    console.error('Shared database health check failed.', error);

    return NextResponse.json(
      {
        ok: false,
        service: 'kallo',
        error: 'Shared database health check failed.',
      },
      { status: 503 }
    );
  }
}
