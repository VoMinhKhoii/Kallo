// Content reports (App Store 1.2: a report mechanism with a timely response).
// SECURITY: the Drizzle db handle bypasses RLS — the reporter id comes from the
// session and every read of the target is gated in report-targets.ts.

import { and, eq } from 'drizzle-orm';
import { after } from 'next/server';
import {
  type CreateReportBody,
  createReportBodySchema,
} from '@/lib/api/contracts/social/moderation';
import { Errors } from '@/lib/core/errors/catalog';
import { resolveReportTarget } from '@/lib/domain/social/moderation/report-targets';
import { type AppDb, db as defaultDb } from '@/lib/infra/db/client';
import { contentReports } from '@/lib/infra/db/schema';
import { alertAdminsOfReport } from './report-alert';

/**
 * File a report against a share, reply, chat message, chat group or profile.
 *
 * The target must exist and be one the reporter could have seen (else 404 —
 * the same answer as a missing id). The reported person is derived from the
 * target (the body has no field for it). Reporting your own content is a
 * 400. One report per reporter per target: a repeat (a retry, or a second
 * tap) returns the existing report's id and does not email the admins again.
 *
 * On a new report, every ADMIN_EMAILS address is emailed after the response is
 * sent (`after`); an email failure is logged and never fails the request.
 */
export async function createContentReport(
  reporterId: string,
  input: CreateReportBody,
  db: AppDb = defaultDb
): Promise<{ id: string }> {
  const parsed = createReportBodySchema.parse(input);

  const target = await resolveReportTarget(
    reporterId,
    parsed.targetKind,
    parsed.targetId,
    db
  );
  if (!target) {
    throw Errors.notFound('Không tìm thấy nội dung cần báo cáo.');
  }
  if (target.ownerId === reporterId) {
    throw Errors.validationFailed('Không thể báo cáo nội dung của chính bạn.');
  }

  const [inserted] = await db
    .insert(contentReports)
    .values({
      reporterId,
      targetUserId: target.ownerId,
      targetKind: parsed.targetKind,
      targetId: parsed.targetId,
      reason: parsed.reason,
      note: parsed.note ?? null,
    })
    .onConflictDoNothing({
      target: [
        contentReports.reporterId,
        contentReports.targetKind,
        contentReports.targetId,
      ],
    })
    .returning({ id: contentReports.id, createdAt: contentReports.createdAt });

  if (!inserted) {
    const [existing] = await db
      .select({ id: contentReports.id })
      .from(contentReports)
      .where(
        and(
          eq(contentReports.reporterId, reporterId),
          eq(contentReports.targetKind, parsed.targetKind),
          eq(contentReports.targetId, parsed.targetId)
        )
      )
      .limit(1);
    if (!existing) throw Errors.internal();
    return { id: existing.id };
  }

  after(() =>
    alertAdminsOfReport({
      reportId: inserted.id,
      targetKind: parsed.targetKind,
      targetId: parsed.targetId,
      targetUserId: target.ownerId,
      reporterId,
      reason: parsed.reason,
      note: parsed.note ?? null,
      excerpt: target.excerpt,
      createdAt: inserted.createdAt,
    })
  );

  return { id: inserted.id };
}
