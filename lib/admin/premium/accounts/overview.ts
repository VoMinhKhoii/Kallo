import 'server-only';
import { sql } from 'drizzle-orm';
import {
  activePromoSql,
  payingSql,
  promoEndsSql,
} from '@/lib/admin/premium/targets/plan-sql';
import type { AppDb } from '@/lib/infra/db/client';

export interface PremiumOverview {
  onFreePremium: number;
  endingSoon: number;
  paying: number;
  /** Paying accounts whose first paid grant started during free Premium. */
  upgradedDuringFree: number;
}

export interface EndingSoonAccount {
  id: string;
  email: string;
  freeUntil: Date;
}

const notPaying = sql`NOT ${payingSql(sql`u.id`)}`;
const onPromo = sql`${activePromoSql(sql`u.id`)} AND ${notPaying}`;

export async function getOverview(db: AppDb): Promise<PremiumOverview> {
  const [row] = (await db.execute(sql`
    SELECT
      count(*) FILTER (WHERE ${onPromo})::int AS on_free,
      count(*) FILTER (WHERE ${onPromo}
        AND ${promoEndsSql(sql`u.id`)} <= now() + interval '3 days')::int
        AS ending_soon,
      count(*) FILTER (WHERE ${payingSql(sql`u.id`)})::int AS paying,
      count(*) FILTER (WHERE EXISTS (
        SELECT 1 FROM public.entitlement_grants AS paid
        JOIN public.entitlement_grants AS promo
          ON promo.user_id = paid.user_id
         AND promo.source = 'promo'
         AND promo.environment = paid.environment
         AND paid.created_at >= promo.starts_at
         AND paid.created_at < COALESCE(promo.expires_at, 'infinity')
        WHERE paid.user_id = u.id AND paid.source <> 'promo'
          AND paid.entitlement_key = 'premium'
      ))::int AS upgraded
    FROM auth.users AS u
  `)) as unknown as {
    on_free: number;
    ending_soon: number;
    paying: number;
    upgraded: number;
  }[];
  return {
    onFreePremium: row?.on_free ?? 0,
    endingSoon: row?.ending_soon ?? 0,
    paying: row?.paying ?? 0,
    upgradedDuringFree: row?.upgraded ?? 0,
  };
}

/** Free-Premium accounts whose access ends soonest. */
export async function listEndingSoon(
  db: AppDb,
  limit = 8
): Promise<EndingSoonAccount[]> {
  const rows = (await db.execute(sql`
    SELECT u.id::text AS id, u.email, ${promoEndsSql(sql`u.id`)} AS free_until
    FROM auth.users AS u
    WHERE ${onPromo}
    ORDER BY free_until ASC
    LIMIT ${limit}
  `)) as unknown as { id: string; email: string; free_until: string }[];
  return rows.map((row) => ({
    id: row.id,
    email: row.email,
    freeUntil: new Date(row.free_until),
  }));
}
