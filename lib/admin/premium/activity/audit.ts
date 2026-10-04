import 'server-only';
import type { AdminUser } from '@/lib/admin/authz/require-admin';
import type { AppDb } from '@/lib/infra/db/client';
import { premiumGrantAudit } from '@/lib/infra/db/schema';

export type AuditAction = 'grant' | 'end' | 'offer' | 'undo';
export type AuditScope = 'users' | 'group' | 'everyone' | 'offer';

export interface AuditEntry {
  id: string;
  action: AuditAction;
  scope: AuditScope;
  userCount: number;
  reason: string | null;
  mode?: 'extend' | 'restart' | null;
  days?: number | null;
  expiresAt?: Date | null;
  targetUserIds?: string[] | null;
  details?: Record<string, unknown> | null;
}

/** Records one /admin/premium action. Call inside the action's transaction. */
export async function recordAudit(
  db: AppDb,
  admin: AdminUser,
  entry: AuditEntry,
  now: Date
): Promise<void> {
  await db.insert(premiumGrantAudit).values({
    id: entry.id,
    adminUserId: admin.id,
    adminEmail: admin.email,
    action: entry.action,
    scope: entry.scope,
    mode: entry.mode ?? null,
    days: entry.days ?? null,
    userCount: entry.userCount,
    targetUserIds: entry.targetUserIds ?? null,
    expiresAt: entry.expiresAt ?? null,
    reason: entry.reason,
    details: entry.details ?? null,
    createdAt: now,
  });
}
