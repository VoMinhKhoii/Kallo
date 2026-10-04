import 'server-only';
import { sql } from 'drizzle-orm';
import type { AccountMatch } from '@/lib/admin/premium/accounts/search';
import {
  type AccountPlan,
  planSql,
  promoEndsSql,
} from '@/lib/admin/premium/targets/plan-sql';
import type { AppDb } from '@/lib/infra/db/client';

export interface AccountGrant {
  id: string;
  /** welcome | admin | revenuecat (store) | other promo */
  kind: 'welcome' | 'admin' | 'store' | 'promo';
  store: string | null;
  startsAt: Date;
  expiresAt: Date | null;
  status: string;
  active: boolean;
  /** The admin action that created or ended it, when there is one. */
  actionId: string | null;
}

export interface AccountDetail extends AccountMatch {
  grants: AccountGrant[];
}

function kindOf(source: string, externalRef: string): AccountGrant['kind'] {
  if (source !== 'promo') return 'store';
  if (externalRef.startsWith('welcome:')) return 'welcome';
  if (externalRef.startsWith('admin:')) return 'admin';
  return 'promo';
}

/** One account and its Premium grants (production environment), newest first. */
export async function getAccount(
  db: AppDb,
  userId: string
): Promise<AccountDetail | null> {
  const [user] = (await db.execute(sql`
    SELECT u.id::text AS id, u.email, p.display_name AS name,
           u.created_at AS joined_at,
           ${planSql(sql`u.id`)} AS plan,
           ${promoEndsSql(sql`u.id`)} AS free_until
    FROM auth.users AS u
    LEFT JOIN public.public_profiles AS p ON p.user_id = u.id
    WHERE u.id = ${userId}::uuid
  `)) as unknown as {
    id: string;
    email: string;
    name: string | null;
    joined_at: string;
    plan: AccountPlan;
    free_until: string | null;
  }[];
  if (!user) return null;

  const grants = (await db.execute(sql`
    SELECT id::text AS id, source, external_ref, store, starts_at, expires_at,
           status, canceled_by_action::text AS canceled_by,
           (status = 'active' AND starts_at <= now()
             AND (expires_at IS NULL OR expires_at > now())) AS active
    FROM public.entitlement_grants
    WHERE user_id = ${userId}::uuid
      AND environment = 'production'
      AND entitlement_key = 'premium'
    ORDER BY starts_at DESC
    LIMIT 50
  `)) as unknown as {
    id: string;
    source: string;
    external_ref: string;
    store: string | null;
    starts_at: string;
    expires_at: string | null;
    status: string;
    canceled_by: string | null;
    active: boolean;
  }[];

  return {
    id: user.id,
    email: user.email,
    name: user.name,
    joinedAt: new Date(user.joined_at),
    plan: user.plan,
    freeUntil: user.free_until ? new Date(user.free_until) : null,
    grants: grants.map((g) => ({
      id: g.id,
      kind: kindOf(g.source, g.external_ref),
      store: g.store,
      startsAt: new Date(g.starts_at),
      expiresAt: g.expires_at ? new Date(g.expires_at) : null,
      status: g.status,
      active: g.active,
      actionId:
        g.canceled_by ??
        (g.external_ref.startsWith('admin:')
          ? (g.external_ref.split(':')[1] ?? null)
          : null),
    })),
  };
}
