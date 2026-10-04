import 'server-only';
import { sql } from 'drizzle-orm';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import type { ParsedGrantPremiumInput } from '@/lib/admin/premium/grant-input';
import { Errors } from '@/lib/core/errors/catalog';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumGrantAudit } from '@/lib/infra/db/schema';

// Complimentary Premium from /admin/premium. Each grant is an ordinary
// `entitlement_grants` row (source 'promo'), so it reads as real Premium and a
// purchase never deletes it — RevenueCat reconciliation only replaces its own
// rows. A grant runs from now for `days`; the user's furthest-out active grant
// wins, so this never shortens a longer subscription. Rows are written for
// both billing environments because prod and non-prod share one database and
// each reads only its own environment.

const DAY_MS = 24 * 60 * 60 * 1000;

export interface GrantPremiumResult {
  auditId: string;
  userCount: number;
  expiresAt: Date;
}

export interface GrantPremiumDeps {
  db: AppDb;
  now?: () => Date;
}

async function resolveEmails(db: AppDb, emails: string[]): Promise<string[]> {
  const rows = (await db.execute(sql`
    SELECT id::text AS id, lower(email) AS email
    FROM auth.users
    WHERE lower(email) IN (${sql.join(
      emails.map((email) => sql`${email}`),
      sql`, `
    )})
  `)) as unknown as { id: string; email: string }[];

  const found = new Set(rows.map((row) => row.email));
  const unknown = emails.filter((email) => !found.has(email));
  // All or nothing: a typo'd address must be fixed, not silently skipped
  // while the rest of the batch goes through.
  if (unknown.length > 0) {
    throw Errors.validationFailed(`No account for: ${unknown.join(', ')}`);
  }
  return rows.map((row) => row.id);
}

/**
 * Grant Premium and record who did it, in one transaction. Callers MUST have
 * already passed `requireAdmin()` and parsed the input with
 * `grantPremiumInputSchema` — this module trusts both.
 */
export async function grantPremium(
  admin: AdminUser,
  input: ParsedGrantPremiumInput,
  deps: GrantPremiumDeps
): Promise<GrantPremiumResult> {
  const now = deps.now?.() ?? new Date();
  const expiresAt = new Date(now.getTime() + input.days * DAY_MS);
  const auditId = crypto.randomUUID();

  return deps.db.transaction(async (tx) => {
    const db = tx as unknown as AppDb;
    const userIds =
      input.scope === 'users' ? await resolveEmails(db, input.emails) : null;

    const target =
      userIds === null
        ? sql`TRUE`
        : sql`u.id IN (${sql.join(
            userIds.map((id) => sql`${id}::uuid`),
            sql`, `
          )})`;

    const inserted = (await db.execute(sql`
      INSERT INTO public.entitlement_grants (
        user_id, entitlement_key, source, environment, product_id,
        starts_at, expires_at, status, will_renew, external_ref
      )
      SELECT
        u.id, 'premium', 'promo', env.name, 'admin_grant',
        ${now.toISOString()}::timestamptz,
        ${expiresAt.toISOString()}::timestamptz, 'active', false,
        'admin:' || ${auditId} || ':' || u.id::text
      FROM auth.users AS u
      CROSS JOIN (VALUES ('production'), ('sandbox')) AS env(name)
      WHERE ${target}
      RETURNING user_id
    `)) as unknown as { user_id: string }[];

    const userCount = new Set(inserted.map((row) => row.user_id)).size;

    await db.insert(premiumGrantAudit).values({
      id: auditId,
      adminUserId: admin.id,
      adminEmail: admin.email,
      scope: input.scope,
      days: input.days,
      userCount,
      targetUserIds: userIds,
      expiresAt,
      createdAt: now,
    });

    return { auditId, userCount, expiresAt };
  });
}
