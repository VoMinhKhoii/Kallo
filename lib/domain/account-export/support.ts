import { eq } from 'drizzle-orm';
import type { AppDb } from '@/lib/infra/db/client';
import { userFeedback } from '@/lib/infra/db/schema';

/**
 * Feedback the user sent from the app (bug reports, ingredient requests,
 * ideas), including the triage status we set on it. `screenshotPath` is the
 * object path in the private `feedback-screenshots` bucket, not the image; the
 * builder also lists it under `files`.
 */
export async function loadSupportExport(db: AppDb, userId: string) {
  const feedbackRows = await db
    .select({
      id: userFeedback.id,
      type: userFeedback.type,
      message: userFeedback.message,
      screenshotPath: userFeedback.screenshotPath,
      appVersion: userFeedback.appVersion,
      platform: userFeedback.platform,
      locale: userFeedback.locale,
      route: userFeedback.route,
      metadata: userFeedback.metadata,
      status: userFeedback.status,
      createdAt: userFeedback.createdAt,
      updatedAt: userFeedback.updatedAt,
    })
    .from(userFeedback)
    .where(eq(userFeedback.userId, userId));

  return { feedback: feedbackRows };
}
