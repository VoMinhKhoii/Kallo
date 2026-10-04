import 'server-only';
import { sql } from 'drizzle-orm';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import { recordAudit } from '@/lib/admin/premium/activity/audit';
import type { ParsedGiveInput } from '@/lib/admin/premium/grants/grant-input';
import { promoEndsSql } from '@/lib/admin/premium/targets/plan-sql';
import { whoCondition } from '@/lib/admin/premium/targets/resolve-who';
import { Errors } from '@/lib/core/errors/catalog';
import type { AppDb } from '@/lib/infra/db/client';

// Free Premium from /admin/premium. Each grant is an ordinary
// `entitlement_grants` row (source 'promo'), so it reads as real Premium and
// a purchase never deletes it. Paying accounts are never selected. Rows are
// written for both billing environments: prod and non-prod share one
// database and each reads only its own environment.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface ActionResult {
  auditId: string;
  userCount: number;
}

export interface GiveResult extends ActionResult {
  expiresAt: Date | null;
}

export interface ActionDeps {
  db: AppDb;
  now?: () => Date;
}

function untilEnd(input: ParsedGiveInput, now: Date): Date | null {
  if (input.length.unit !== 'until') return null;
  const end = new Date(`${input.length.until}T23:59:59.999Z`);
  if (end.getTime() <= now.getTime()) {
    throw Errors.validationFailed('Pick a date in the future.');
  }
  if (end.getTime() - now.getTime() > 366 * DAY_MS) {
    throw Errors.validationFailed('Pick a date within a year.');
  }
  return end;
}

/** Give free Premium and record it, in one transaction. */
export async function givePremium(
  admin: AdminUser,
  input: ParsedGiveInput,
  deps: ActionDeps
): Promise<GiveResult> {
  const now = deps.now?.() ?? new Date();
  const until = untilEnd(input, now);
  const auditId = crypto.randomUUID();
  const nowIso = now.toISOString();
  const days = input.length.unit === 'days' ? input.length.days : null;

  // extend: from whichever is later, now or the end of their free time.
  const base =
    input.mode === 'extend'
      ? sql`GREATEST(${nowIso}::timestamptz, COALESCE(${promoEndsSql(sql`u.id`)}, ${nowIso}::timestamptz))`
      : sql`${nowIso}::timestamptz`;
  const expires = until
    ? sql`${until.toISOString()}::timestamptz`
    : sql`${base} + make_interval(days => ${days}::int)`;

  return deps.db.transaction(async (tx) => {
    const db = tx as unknown as AppDb;
    const inserted = (await db.execute(sql`
      INSERT INTO public.entitlement_grants (
        user_id, entitlement_key, source, environment, product_id,
        starts_at, expires_at, status, will_renew, external_ref
      )
      SELECT
        u.id, 'premium', 'promo', env.name, 'admin_grant',
        ${nowIso}::timestamptz, ${expires}, 'active', false,
        'admin:' || ${auditId} || ':' || u.id::text
      FROM auth.users AS u
      CROSS JOIN (VALUES ('production'), ('sandbox')) AS env(name)
      WHERE ${whoCondition(input.who)}
      RETURNING user_id::text AS user_id, expires_at
    `)) as unknown as { user_id: string; expires_at: string }[];

    const userCount = new Set(inserted.map((row) => row.user_id)).size;
    const latest = inserted.reduce<Date | null>((max, row) => {
      const at = new Date(row.expires_at);
      return max === null || at > max ? at : max;
    }, null);

    await recordAudit(
      db,
      admin,
      {
        id: auditId,
        action: 'grant',
        scope: input.who.kind,
        mode: input.mode,
        days,
        userCount,
        expiresAt: latest,
        reason: input.reason,
        targetUserIds: input.who.kind === 'users' ? input.who.userIds : null,
        details: { who: input.who, length: input.length },
      },
      now
    );
    return { auditId, userCount, expiresAt: latest };
  });
}
