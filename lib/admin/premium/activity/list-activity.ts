import 'server-only';
import { and, desc, eq, ilike, or, type SQL } from 'drizzle-orm';
import type { AuditAction } from '@/lib/admin/premium/activity/audit';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumGrantAudit } from '@/lib/infra/db/schema';

export type ActivityRow = typeof premiumGrantAudit.$inferSelect;

export interface ActivityFilter {
  action?: AuditAction;
  search?: string;
  limit?: number;
}

/** The /admin/premium action log, newest first. */
export async function listActivity(
  db: AppDb,
  filter: ActivityFilter = {}
): Promise<ActivityRow[]> {
  const where: SQL[] = [];
  if (filter.action) where.push(eq(premiumGrantAudit.action, filter.action));
  const term = filter.search?.trim();
  if (term) {
    const pattern = `%${term.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
    const match = or(
      ilike(premiumGrantAudit.reason, pattern),
      ilike(premiumGrantAudit.adminEmail, pattern)
    );
    if (match) where.push(match);
  }
  return db
    .select()
    .from(premiumGrantAudit)
    .where(where.length > 0 ? and(...where) : undefined)
    .orderBy(desc(premiumGrantAudit.createdAt))
    .limit(filter.limit ?? 50);
}
