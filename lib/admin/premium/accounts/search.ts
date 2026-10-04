import 'server-only';
import { sql } from 'drizzle-orm';
import {
  type AccountPlan,
  planSql,
  promoEndsSql,
} from '@/lib/admin/premium/targets/plan-sql';
import type { AppDb } from '@/lib/infra/db/client';

export interface AccountMatch {
  id: string;
  email: string;
  name: string | null;
  joinedAt: Date;
  plan: AccountPlan;
  freeUntil: Date | null;
}

export const SEARCH_LIMIT = 8;

/** Escapes LIKE wildcards so a typed `%` or `_` matches itself. */
function likePattern(query: string): string {
  return `%${query.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
}

/**
 * Accounts whose email, display name or handle contains `query`
 * (case-insensitive), with their plan, for the admin account picker.
 */
export async function searchAccounts(
  db: AppDb,
  query: string
): Promise<AccountMatch[]> {
  const pattern = likePattern(query.trim());
  const rows = (await db.execute(sql`
    SELECT u.id::text AS id, u.email, p.display_name AS name,
           u.created_at AS joined_at,
           ${planSql(sql`u.id`)} AS plan,
           ${promoEndsSql(sql`u.id`)} AS free_until
    FROM auth.users AS u
    LEFT JOIN public.public_profiles AS p ON p.user_id = u.id
    WHERE u.email ILIKE ${pattern}
       OR p.display_name ILIKE ${pattern}
       OR p.handle ILIKE ${pattern}
    ORDER BY (lower(u.email) = lower(${query.trim()})) DESC, u.created_at DESC
    LIMIT ${SEARCH_LIMIT}
  `)) as unknown as {
    id: string;
    email: string;
    name: string | null;
    joined_at: string;
    plan: AccountPlan;
    free_until: string | null;
  }[];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    name: row.name,
    joinedAt: new Date(row.joined_at),
    plan: row.plan,
    freeUntil: row.free_until ? new Date(row.free_until) : null,
  }));
}
