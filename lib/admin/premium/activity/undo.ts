import 'server-only';
import { and, eq, isNull, sql } from 'drizzle-orm';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import { recordAudit } from '@/lib/admin/premium/activity/audit';
import { writeWelcomeOffer } from '@/lib/admin/premium/offer/offer';
import { Errors } from '@/lib/core/errors/catalog';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumGrantAudit } from '@/lib/infra/db/schema';

interface OfferSnapshot {
  enabled: boolean;
  days: number;
  autoOffAt: string | null;
}

/**
 * Reverses exactly what one action did, and logs the undo:
 *  - grant: cancels the grants it created that are still active;
 *  - end:   restores the grants it canceled (any past their end date simply
 *           stay expired by the clock);
 *  - offer: puts the welcome offer back to its settings before the change.
 * An action can be undone once; an undo itself cannot be undone.
 */
export async function undoAction(
  admin: AdminUser,
  actionId: string,
  reason: string,
  deps: { db: AppDb; now?: () => Date }
): Promise<{ userCount: number }> {
  const now = deps.now?.() ?? new Date();
  const undoId = crypto.randomUUID();
  const nowIso = now.toISOString();

  return deps.db.transaction(async (tx) => {
    const db = tx as unknown as AppDb;
    // Claim the action first: a concurrent second undo finds nothing left.
    const [action] = await db
      .update(premiumGrantAudit)
      .set({ undoneAt: now, undoneByEmail: admin.email })
      .where(
        and(
          eq(premiumGrantAudit.id, actionId),
          isNull(premiumGrantAudit.undoneAt),
          sql`${premiumGrantAudit.action} <> 'undo'`
        )
      )
      .returning();
    if (!action) {
      throw Errors.validationFailed(
        'That action was already undone or cannot be undone.'
      );
    }

    let userCount = 0;
    if (action.action === 'grant') {
      const rows = (await db.execute(sql`
        UPDATE public.entitlement_grants
        SET status = 'canceled', canceled_by_action = ${undoId}::uuid,
            updated_at = ${nowIso}::timestamptz
        WHERE source = 'promo' AND status = 'active'
          AND external_ref LIKE ${`admin:${actionId}:%`}
        RETURNING user_id::text AS user_id
      `)) as unknown as { user_id: string }[];
      userCount = new Set(rows.map((row) => row.user_id)).size;
    } else if (action.action === 'end') {
      const rows = (await db.execute(sql`
        UPDATE public.entitlement_grants
        SET status = 'active', canceled_by_action = NULL,
            updated_at = ${nowIso}::timestamptz
        WHERE status = 'canceled' AND canceled_by_action = ${actionId}::uuid
        RETURNING user_id::text AS user_id
      `)) as unknown as { user_id: string }[];
      userCount = new Set(rows.map((row) => row.user_id)).size;
    } else if (action.action === 'offer') {
      const before = (action.details as { before?: OfferSnapshot } | null)
        ?.before;
      if (!before) throw Errors.validationFailed('Nothing to restore.');
      await writeWelcomeOffer(
        db,
        {
          enabled: before.enabled,
          days: before.days,
          autoOffAt: before.autoOffAt ? new Date(before.autoOffAt) : null,
        },
        admin.email,
        now
      );
    }

    await recordAudit(
      db,
      admin,
      {
        id: undoId,
        action: 'undo',
        scope: action.scope as 'users' | 'group' | 'everyone' | 'offer',
        userCount,
        reason,
        details: { undid: actionId, undidAction: action.action },
      },
      now
    );
    return { userCount };
  });
}
