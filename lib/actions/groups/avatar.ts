// Avatar photo upload/removal. Storage writes run through the SERVICE-ROLE
// client, and only after the type/size/magic-byte checks and the sharp
// re-encode: users hold no write policy on the `avatars` bucket (migration
// 20260923034000), so this function is the ONLY way bytes land there and a
// direct Storage upload can no longer skip the processing (KALLO-05). The
// object path is built here from the authenticated actor id + a random UUID —
// nothing caller-supplied reaches it. The bucket is public for reads (avatars
// render on the anonymous invite page and in feeds).

import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { Errors } from '@/lib/core/errors/catalog';
import { db as defaultDb } from '@/lib/infra/db/client';
import { publicProfiles } from '@/lib/infra/db/schema';
import { createAdminClient } from '@/lib/infra/supabase/admin';
import { processAvatarImage } from '@/lib/infra/uploads/avatar-image';
import {
  IMAGE_TYPES,
  MAX_IMAGE_BYTES,
  signatureMatches,
} from '@/lib/infra/uploads/image-file';

import { getMyPublicProfile, getOrCreateMyProfile } from './profile';
import type { Db, PublicProfile } from './types';

const AVATAR_BUCKET = 'avatars';

/** CDN/browser freshness for a stored avatar, in seconds. Each upload gets a
 * fresh random filename, so a replaced avatar's NEW url is never stale; the
 * short TTL only bounds how long a deleted/replaced object keeps being served
 * from edge caches (Supabase's default is 3600). */
export const AVATAR_CACHE_CONTROL_SECONDS = '300';

type AdminClient = ReturnType<typeof createAdminClient>;

/** Best-effort delete of a replaced/removed avatar object — a stale orphan in
 * the bucket is harmless, so a storage error never fails the mutation. The
 * service-role client ignores RLS, so the owner-prefix check that the old
 * `avatars_delete_own` policy did is re-done here: a path outside
 * `{actorId}/` (a corrupted or tampered row) is refused, never deleted. */
async function removeObject(
  admin: AdminClient,
  actorId: string,
  path: string | null
) {
  if (!path) return;
  if (!isOwnAvatarPath(actorId, path)) {
    console.error('[avatar] refused to remove an object outside the prefix');
    return;
  }
  const { error } = await admin.storage.from(AVATAR_BUCKET).remove([path]);
  if (error) {
    console.error('[avatar] cleanup of old object failed:', error.message);
  }
}

/** `{actorId}/{single segment}` only — no nested folders, no traversal. */
export function isOwnAvatarPath(actorId: string, path: string): boolean {
  const prefix = `${actorId}/`;
  if (!actorId || !path.startsWith(prefix)) return false;
  const name = path.slice(prefix.length);
  return name.length > 0 && !name.includes('/') && !name.includes('..');
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

  // Server-built path: the authenticated id + a random name. The bytes are the
  // sharp output, never the caller's upload.
  const path = `${actorId}/${randomUUID()}.webp`;
  const admin = createAdminClient();
  const { error } = await admin.storage.from(AVATAR_BUCKET).upload(path, webp, {
    contentType: 'image/webp',
    cacheControl: AVATAR_CACHE_CONTROL_SECONDS,
    upsert: false,
  });
  if (error) {
    throw Errors.internal(error, 'Could not upload the avatar.');
  }

  await db
    .update(publicProfiles)
    .set({ avatarPath: path, updatedAt: new Date() })
    .where(eq(publicProfiles.userId, actorId));

  await removeObject(admin, actorId, previous);

  const profile = await getMyPublicProfile(actorId, db);
  if (!profile) throw Errors.internal(null, 'Profile disappeared mid-update.');
  return profile;
}

/** Clear the actor's avatar photo (falls back to the initials disc). */
export async function removeMyAvatar(
  actorId: string,
  db: Db = defaultDb
): Promise<PublicProfile> {
  const previous = await currentAvatarPath(actorId, db);
  // Built before the write so a missing service-role secret fails the request
  // cleanly instead of clearing the row and orphaning the object.
  const admin = previous ? createAdminClient() : null;

  await db
    .update(publicProfiles)
    .set({ avatarPath: null, updatedAt: new Date() })
    .where(eq(publicProfiles.userId, actorId));

  if (admin) await removeObject(admin, actorId, previous);

  return getOrCreateMyProfile(actorId, null, db);
}
