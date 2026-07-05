'use server';

import { randomUUID } from 'node:crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { and, eq, gte, sql } from 'drizzle-orm';
import type { SubmitFeedbackInput } from '@/lib/api/contracts/feedback';
import { submitFeedbackSchema } from '@/lib/api/contracts/feedback';
import { db } from '@/lib/db';
import { userFeedback } from '@/lib/db/schema';
import { Errors } from '@/lib/errors';
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';

/** Max feedback submissions a single user may make per rolling hour. */
const HOURLY_LIMIT = 10;
/** Max screenshot uploads per rolling hour (higher than submits — re-picks). */
const UPLOAD_HOURLY_LIMIT = 20;

/** Private bucket holding optional feedback screenshots. */
const SCREENSHOT_BUCKET = 'feedback-screenshots';
const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
/** Allowed screenshot content types → file extension. */
const SCREENSHOT_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

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
  return data.user;
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
  const user = await requireUser();

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

/** File-signature (magic-byte) check so a spoofed Content-Type can't smuggle a
 * non-image (e.g. SVG/HTML) past the allowlist. */
function signatureMatches(bytes: Uint8Array, mime: string): boolean {
  switch (mime) {
    case 'image/png':
      return (
        bytes.length >= 8 &&
        bytes[0] === 0x89 &&
        bytes[1] === 0x50 &&
        bytes[2] === 0x4e &&
        bytes[3] === 0x47
      );
    case 'image/jpeg':
      return (
        bytes.length >= 3 &&
        bytes[0] === 0xff &&
        bytes[1] === 0xd8 &&
        bytes[2] === 0xff
      );
    case 'image/webp':
      // "RIFF" .... "WEBP"
      return (
        bytes.length >= 12 &&
        bytes[0] === 0x52 &&
        bytes[1] === 0x49 &&
        bytes[2] === 0x46 &&
        bytes[3] === 0x46 &&
        bytes[8] === 0x57 &&
        bytes[9] === 0x45 &&
        bytes[10] === 0x42 &&
        bytes[11] === 0x50
      );
    default:
      return false;
  }
}

/**
 * Best-effort per-user upload cap. This is a soft secondary guard — the hard
 * cap is the advisory-locked submit limit in `submitFeedbackAction`. It is not
 * strictly synchronized (concurrent uploads could momentarily exceed the count)
 * and, on a storage/list error, it allows the upload rather than blocking a
 * legitimate user. Both are intentional given the real cap lives on the submit.
 */
async function assertUploadQuota(
  admin: SupabaseClient,
  userId: string
): Promise<void> {
  const { data, error } = await admin.storage
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
 * Uploads run through the service-role admin client, not the browser/mobile
 * supabase client: those ride the auth-only `/api/supabase-proxy` origin, which
 * rejects `/storage/v1/*`. The object is namespaced by uploader
 * (`{userId}/{uuid}.{ext}`) in a private bucket; admins read it later via a
 * short-lived signed URL.
 */
export async function uploadFeedbackScreenshotAction(
  file: File
): Promise<{ path: string }> {
  const user = await requireUser();

  const ext = SCREENSHOT_TYPES[file.type];
  if (!ext) {
    throw Errors.validationFailed('Unsupported image type.');
  }
  if (file.size === 0 || file.size > MAX_SCREENSHOT_BYTES) {
    throw Errors.validationFailed('Image must be between 1 byte and 5 MB.');
  }

  const admin = createAdminClient();
  await assertUploadQuota(admin, user.id);

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type)) {
    throw Errors.validationFailed('Image content does not match its type.');
  }

  const path = `${user.id}/${randomUUID()}.${ext}`;
  const { error } = await admin.storage
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
