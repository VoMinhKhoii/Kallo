'use server';

import { randomUUID } from 'node:crypto';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { SubmitFeedbackInput } from '@/lib/api/contracts/feedback';
import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { userFeedback } from '@/lib/infra/db/schema';
import { createClient } from '@/lib/infra/supabase/server';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  signatureMatches,
} from '@/lib/infra/uploads/image-file';

/** The request-scoped Supabase client (user's own session, RLS-enforced). */
type ScopedClient = Awaited<ReturnType<typeof createClient>>;

/** Max feedback submissions a single user may make per rolling hour. */
const HOURLY_LIMIT = 10;
/** Max screenshot uploads per rolling hour (higher than submits — re-picks). */
const UPLOAD_HOURLY_LIMIT = 20;

/** Private bucket holding optional feedback screenshots. */
const SCREENSHOT_BUCKET = 'feedback-screenshots';

/**
 * Resolve the current authenticated user WITHOUT requiring a completed
 * profile — feedback must work for users who signed up but skipped onboarding.
 */
async function requireUser() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    throw Errors.notAuthenticated();
  }
  return { supabase, user: data.user };
}

/**
 * Persist an in-app feedback submission (bug report, ingredient request, or
 * idea) for the authenticated user. The `userId` is taken from the session,
 * never the input, so feedback can't be attributed to another account. Applies
 * a lightweight per-user hourly rate limit to blunt spam.
 */
export async function submitFeedbackAction(
  input: SubmitFeedbackInput
): Promise<{ id: string }> {
  const parsed = submitFeedbackSchema.parse(input);
  const { user } = await requireUser();

  // The path format is already validated by the schema; this proves the object
  // belongs to the submitter (its first segment is the uploader's id), so a
  // crafted request can't attach another user's screenshot.
  if (
    parsed.screenshotPath &&
    !parsed.screenshotPath.startsWith(`${user.id}/`)
  ) {
    throw Errors.validationFailed('Invalid screenshot path.');
  }

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  // Serialize the count-then-insert per user with a transaction-scoped advisory
  // lock so two concurrent submits can't both read count=9 and both insert
  // (TOCTOU). The lock auto-releases at commit/rollback — pooler-safe.
  const row = await db.transaction(async (tx) => {
    await tx.execute(sql`select pg_advisory_xact_lock(hashtext(${user.id}))`);

    const [{ count }] = await tx
      .select({ count: sql<number>`count(*)::int` })
      .from(userFeedback)
      .where(
        and(
          eq(userFeedback.userId, user.id),
          gte(userFeedback.createdAt, oneHourAgo)
        )
      );

    if (count >= HOURLY_LIMIT) {
      throw Errors.rateLimited();
    }

    const [inserted] = await tx
      .insert(userFeedback)
      .values({
        userId: user.id,
        type: parsed.type,
        message: parsed.message,
        screenshotPath: parsed.screenshotPath ?? null,
        appVersion: parsed.appVersion ?? null,
        platform: parsed.platform ?? null,
        locale: parsed.locale ?? null,
        route: parsed.route ?? null,
        metadata: parsed.metadata ?? null,
      })
      .returning({ id: userFeedback.id });
    return inserted;
  });

  return { id: row.id };
}

/**
 * Best-effort per-user upload cap. This is a soft secondary guard — the hard
 * cap is the advisory-locked submit limit in `submitFeedbackAction`. It is not
 * strictly synchronized (concurrent uploads could momentarily exceed the count)
 * and, on a storage/list error, it allows the upload rather than blocking a
 * legitimate user. Both are intentional given the real cap lives on the submit.
 */
async function assertUploadQuota(
  supabase: ScopedClient,
  userId: string
): Promise<void> {
  const { data, error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .list(userId, {
      limit: 100,
      sortBy: { column: 'created_at', order: 'desc' },
    });
  if (error) {
    console.error('[feedback] upload-quota list failed:', error.message);
    return;
  }
  if (!data) return;
  const oneHourAgo = Date.now() - 60 * 60 * 1000;
  const recent = data.filter(
    (o) => o.created_at && new Date(o.created_at).getTime() > oneHourAgo
  ).length;
  if (recent >= UPLOAD_HOURLY_LIMIT) {
    throw Errors.rateLimited();
  }
}

/**
 * Upload an optional feedback screenshot for the authenticated user and return
 * its storage path (to be passed as `screenshotPath` to `submitFeedbackAction`).
 *
 * The upload runs server-side (the browser/mobile supabase client rides the
 * auth-only `/api/supabase-proxy` origin, which rejects `/storage/v1/*`) but
 * through the user's OWN session client, not the service-role admin client — so
 * the `feedback_screenshots_insert_own` RLS policy enforces that the object
 * lands under the uploader's `{userId}/…` prefix, backing up the code-set path.
 * Admins read it back later via a short-lived signed URL (service-role).
 */
export async function uploadFeedbackScreenshotAction(
  file: File
): Promise<{ path: string }> {
  const { supabase, user } = await requireUser();

  const ext = IMAGE_TYPES[file.type];
  if (!ext) {
    throw Errors.validationFailed('Unsupported image type.');
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw Errors.validationFailed('Image must be between 1 byte and 5 MB.');
  }

  await assertUploadQuota(supabase, user.id);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type)) {
    throw Errors.validationFailed('Image content does not match its type.');
  }

  const path = `${user.id}/${randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from(SCREENSHOT_BUCKET)
    .upload(path, bytes, {
      contentType: file.type,
      upsert: false,
    });

  if (error) {
    throw Errors.internal(error, 'Could not upload the screenshot.');
  }

  return { path };
}
