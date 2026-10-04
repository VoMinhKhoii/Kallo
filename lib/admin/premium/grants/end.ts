import 'server-only';
import { sql } from 'drizzle-orm';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import { recordAudit } from '@/lib/admin/premium/activity/audit';
import type { ActionDeps, ActionResult } from '@/lib/admin/premium/grants/give';
import type { ParsedEndInput } from '@/lib/admin/premium/grants/grant-input';
import { whoCondition } from '@/lib/admin/premium/targets/resolve-who';
import type { AppDb } from '@/lib/infra/db/client';

/**
 * End free Premium now. Cancels only active promo grants (welcome and admin);
 * paid grants are never touched, and paying accounts are never selected.
 * Each canceled grant records this action's id, so Undo restores exactly
 * these grants.
 */
export async function endFreePremium(
  admin: AdminUser,
  input: ParsedEndInput,
  deps: ActionDeps
): Promise<ActionResult> {
  const now = deps.now?.() ?? new Date();
  const auditId = crypto.randomUUID();

  return deps.db.transaction(async (tx) => {
    const db = tx as unknown as AppDb;
    const ended = (await db.execute(sql`
      UPDATE public.entitlement_grants AS g
      SET status = 'canceled',
          canceled_by_action = ${auditId}::uuid,
          updated_at = ${now.toISOString()}::timestamptz
      FROM auth.users AS u
      WHERE g.user_id = u.id
        AND g.source = 'promo'
        AND g.status = 'active'
        AND (g.expires_at IS NULL OR g.expires_at > now())
        AND ${whoCondition(input.who)}
      RETURNING g.user_id::text AS user_id
    `)) as unknown as { user_id: string }[];

    const userCount = new Set(ended.map((row) => row.user_id)).size;
    await recordAudit(
      db,
      admin,
      {
        id: auditId,
        action: 'end',
        scope: input.who.kind,
        userCount,
        reason: input.reason,
        targetUserIds: input.who.kind === 'users' ? input.who.userIds : null,
        details: { who: input.who },
      },
      now
    );
    return { auditId, userCount };
  });
}
