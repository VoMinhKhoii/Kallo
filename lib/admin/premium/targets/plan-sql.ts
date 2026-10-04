import 'server-only';
import { type SQL, sql } from 'drizzle-orm';

// The three plans /admin/premium sorts accounts into, as SQL over
// `entitlement_grants`. "Active" means status active AND inside its window,
// checked against the clock (a stale status alone never counts).
//
//  - paying:        any active NON-promo premium grant or active store
//                   subscription, in any environment (the cautious side:
//                   paying accounts are never changed here).
//  - complimentary: an active promo grant and not paying.
//  - free:          neither.

const active = (alias: string) =>
  sql.raw(`
  ${alias}.status = 'active'
  AND ${alias}.starts_at <= now()
  AND (${alias}.expires_at IS NULL OR ${alias}.expires_at > now())`);

/** True when the account (by id expression) pays for Premium. */
export function payingSql(userId: SQL): SQL {
  return sql`EXISTS (
    SELECT 1 FROM public.entitlement_grants AS pg
    WHERE pg.user_id = ${userId}
      AND pg.source <> 'promo'
      AND pg.entitlement_key IN ('premium', 'billing_subscription')
      AND ${active('pg')}
  )`;
}

/**
 * True when the account holds an active free (promo) Premium grant. Scoped to
 * production like `promoEndsSql`, so "on free Premium" always has an end date.
 */
export function activePromoSql(userId: SQL): SQL {
  return sql`EXISTS (
    SELECT 1 FROM public.entitlement_grants AS cg
    WHERE cg.user_id = ${userId}
      AND cg.source = 'promo'
      AND cg.entitlement_key = 'premium'
      AND cg.environment = 'production'
      AND ${active('cg')}
  )`;
}

/** When the account's free Premium ends (production grants), or NULL. */
export function promoEndsSql(userId: SQL): SQL {
  return sql`(
    SELECT max(eg.expires_at) FROM public.entitlement_grants AS eg
    WHERE eg.user_id = ${userId}
      AND eg.source = 'promo'
      AND eg.entitlement_key = 'premium'
      AND eg.environment = 'production'
      AND ${active('eg')}
  )`;
}

export type AccountPlan = 'paying' | 'complimentary' | 'free';

/** The plan of the account, as a SQL text expression. */
export function planSql(userId: SQL): SQL {
  return sql`CASE
    WHEN ${payingSql(userId)} THEN 'paying'
    WHEN ${activePromoSql(userId)} THEN 'complimentary'
    ELSE 'free'
  END`;
}
