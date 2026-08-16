// Avatar photo upload/removal. The upload runs server-side through the user's
// OWN session Supabase client (the browser/mobile client rides the auth-only
// `/api/supabase-proxy` origin, which rejects `/storage/v1/*`), so the
// `avatars_insert_own` / `avatars_delete_own` RLS policies enforce that
// objects live under the uploader's `{userId}/…` prefix. The bucket is public
// for reads (avatars render on the anonymous invite page and in feeds).

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { publicProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import type { createClient } from '@/lib/supabase/server';
import { processAvatarImage } from '@/lib/uploads/avatar-image';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  signatureMatches,
} from '@/lib/uploads/image-file';

import { getMyPublicProfile, getOrCreateMyProfile } from './profile';
import type { Db, PublicProfile } from './types';

const AVATAR_BUCKET = 'avatars';

type ScopedClient = Awaited<ReturnType<typeof createClient>>;

/** Best-effort delete of a replaced/removed avatar object — a stale orphan in
 * the bucket is harmless, so a storage error never fails the mutation. */
async function removeObject(supabase: ScopedClient, path: string | null) {
  if (!path) return;
  const { error } = await supabase.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) {
    console.error('[avatar] cleanup of old object failed:', error.message);
  }
}

async function currentAvatarPath(
  actorId: string,
  db: Db
): Promise<string | null> {
  const rows = await db
    .select({ avatarPath: publicProfiles.avatarPath })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, actorId))
    .limit(1);
  return rows[0]?.avatarPath ?? null;
}

/**
 * Upload a new avatar photo for the authenticated actor and point their
 * profile at it. Validates type, size, and magic bytes, then re-encodes to a
 * 512px square WebP — a few KB instead of a multi-MB phone photo, EXIF (GPS)
 * stripped, and the sharp decode hard-proves the bytes are a real image.
 */
export async function uploadMyAvatar(
  actorId: string,
  file: File,
  supabase: ScopedClient,
  db: Db = defaultDb
): Promise<PublicProfile> {
  if (!IMAGE_TYPES[file.type]) {
    throw Errors.validationFailed('Unsupported image type.');
  }
  if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
    throw Errors.validationFailed('Image must be between 1 byte and 5 MB.');
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  if (!signatureMatches(bytes, file.type)) {
    throw Errors.validationFailed('Image content does not match its type.');
  }

  let webp: Buffer;
  try {
    webp = await processAvatarImage(bytes);
  } catch {
    throw Errors.validationFailed('Could not process the image.');
  }

  // Rename/upload may be the first profile touch — make sure the row exists.
  await getOrCreateMyProfile(actorId, null, db);
  const previous = await currentAvatarPath(actorId, db);

  const path = `${actorId}/${randomUUID()}.webp`;
  const { error } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, webp, { contentType: 'image/webp', upsert: false });
  if (error) {
    throw Errors.internal(error, 'Could not upload the avatar.');
  }

  await db
    .update(publicProfiles)
    .set({ avatarPath: path, updatedAt: new Date() })
    .where(eq(publicProfiles.userId, actorId));

  await removeObject(supabase, previous);

  const profile = await getMyPublicProfile(actorId, db);
  if (!profile) throw Errors.internal(null, 'Profile disappeared mid-update.');
  return profile;
}

/** Clear the actor's avatar photo (falls back to the initials disc). */
export async function removeMyAvatar(
  actorId: string,
  supabase: ScopedClient,
  db: Db = defaultDb
): Promise<PublicProfile> {
  const previous = await currentAvatarPath(actorId, db);

  await db
    .update(publicProfiles)
    .set({ avatarPath: null, updatedAt: new Date() })
    .where(eq(publicProfiles.userId, actorId));

  await removeObject(supabase, previous);

  return getOrCreateMyProfile(actorId, null, db);
}
