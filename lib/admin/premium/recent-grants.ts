import 'server-only';
import { desc } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumGrantAudit } from '@/lib/infra/db/schema';

export type RecentGrant = Pick<
  typeof premiumGrantAudit.$inferSelect,
  | 'id'
  | 'adminEmail'
  | 'scope'
  | 'days'
  | 'userCount'
  | 'expiresAt'
  | 'createdAt'
>;

/** The latest admin Premium grants, newest first, for the audit list. */
export async function listRecentGrants(
  db: AppDb,
  limit = 20
): Promise<RecentGrant[]> {
  return db
    .select({
      id: premiumGrantAudit.id,
      adminEmail: premiumGrantAudit.adminEmail,
      scope: premiumGrantAudit.scope,
      days: premiumGrantAudit.days,
      userCount: premiumGrantAudit.userCount,
      expiresAt: premiumGrantAudit.expiresAt,
      createdAt: premiumGrantAudit.createdAt,
    })
    .from(premiumGrantAudit)
    .orderBy(desc(premiumGrantAudit.createdAt))
    .limit(limit);
}
