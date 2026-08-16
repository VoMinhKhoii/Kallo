// Profile service functions. SECURITY: the Drizzle db handle bypasses RLS —
// every query must carry an explicit actor predicate (see ./types.ts).

import { eq } from 'drizzle-orm';
import { db as defaultDb } from '@/lib/db';
import { publicProfiles } from '@/lib/db/schema';
import { Errors } from '@/lib/errors/catalog';
import {
  HANDLE_MAX_LENGTH,
  isValidHandle,
  validateHandle,
} from '@/lib/groups/handles';
import {
  publicProfileColumns,
  toPublicIdentity,
} from '@/lib/groups/public-identity';
import { generateInviteSlug } from '@/lib/groups/slug';
import { handleFromName } from '@/lib/groups/slugify';
import {
  handleSchema,
  renameProfileSchema,
  upsertPublicProfileSchema,
} from '@/lib/validation/social';

import type { Db, PublicProfile } from './types';

// ---------------------------------------------------------------------------
// upsertPublicProfile
// ---------------------------------------------------------------------------

export async function upsertPublicProfile(
  actorId: string,
  input: { handle: string; displayName?: string | null; avatarSeed?: string },
  db: Db = defaultDb
): Promise<PublicProfile> {
  const parsed = upsertPublicProfileSchema.parse(input);

  // Reserved-handle blocklist (distinct rejection reason from shape validation).
  const checked = validateHandle(parsed.handle);
  if (!checked.valid) {
    throw Errors.validationFailed(
      checked.error === 'reserved'
        ? 'Handle này đã được giữ chỗ.'
        : 'Handle không hợp lệ.'
    );
  }
  const handle = checked.handle;

  // Reject if the handle is taken by someone else (case-insensitive — stored
  // lowercased). The unique index is the ultimate guard; this gives a clean error.
  const existing = await db
    .select({ userId: publicProfiles.userId })
    .from(publicProfiles)
    .where(eq(publicProfiles.handle, handle))
    .limit(1);
  if (existing[0] && existing[0].userId !== actorId) {
    throw Errors.conflict('Handle này đã được sử dụng.');
  }

  // Seed the warm-palette avatar/swatch from the handle when the caller does
  // not supply one, so every claimed profile renders a stable, distinct color.
  const avatarSeed = parsed.avatarSeed ?? handle;

  // Tri-state update: an omitted field KEEPS the stored value (a slug-only
  // save must not wipe the display name or reset the avatar seed); an explicit
  // `displayName: null` clears it back to the handle fallback.
  const update: Partial<typeof publicProfiles.$inferInsert> = {
    handle,
    updatedAt: new Date(),
  };
  if (parsed.displayName !== undefined) {
    update.displayName = parsed.displayName;
  }
  if (parsed.avatarSeed !== undefined) {
    update.avatarSeed = parsed.avatarSeed;
  }

  try {
    const [row] = await db
      .insert(publicProfiles)
      .values({
        userId: actorId,
        handle,
        displayName: parsed.displayName ?? null,
        avatarSeed,
      })
      .onConflictDoUpdate({
        target: publicProfiles.userId,
        set: update,
      })
      .returning();

    return toPublicIdentity(row);
  } catch (error) {
    // The handle unique index is the ultimate guard: a concurrent claim of the
    // same handle by a different user (which the pre-check above can race past)
    // surfaces as a Postgres 23505 unique violation. Map it to a clean 409
    // instead of leaking a raw 500.
    if ((error as { code?: string } | null)?.code === '23505') {
      throw Errors.conflict('Handle này đã được sử dụng.');
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// getMyPublicProfile — the actor's own profile (or null if not claimed yet)
// ---------------------------------------------------------------------------

export async function getMyPublicProfile(
  actorId: string,
  db: Db = defaultDb
): Promise<PublicProfile | null> {
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      ...publicProfileColumns,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, actorId))
    .limit(1);

  return rows[0] ? toPublicIdentity(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// getOrCreateMyProfile — auto-provision a link profile on first use
// ---------------------------------------------------------------------------
// No "claim a username" gate: the user gets a shareable link immediately, with
// a generated slug they can edit later (upsertPublicProfile). The slug is the
// editable end of the invite link and doubles as the person's circle label.

export async function getOrCreateMyProfile(
  actorId: string,
  avatarUrl: string | null = null,
  db: Db = defaultDb
): Promise<PublicProfile> {
  // Raw row (not the projection): the refresh below must compare the STORED
  // OAuth URL — the projected avatarUrl prefers an uploaded photo, which
  // would make this update fire on every fetch for users with uploads.
  const rows = await db
    .select({
      userId: publicProfiles.userId,
      ...publicProfileColumns,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.userId, actorId))
    .limit(1);
  const existing = rows[0];
  if (existing) {
    // Refresh a changed Google picture (or backfill a null one) so friends see
    // the current avatar; never clobber a stored URL with null.
    if (avatarUrl && existing.avatarUrl !== avatarUrl) {
      await db
        .update(publicProfiles)
        .set({ avatarUrl, updatedAt: new Date() })
        .where(eq(publicProfiles.userId, actorId));
      return toPublicIdentity({ ...existing, avatarUrl });
    }
    return toPublicIdentity(existing);
  }

  // Provision with a generated slug; retry a few times on a uniqueness clash.
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle = generateInviteSlug();
    try {
      const [row] = await db
        .insert(publicProfiles)
        .values({
          userId: actorId,
          handle,
          displayName: null,
          avatarSeed: handle,
          avatarUrl,
        })
        .returning();
      return toPublicIdentity(row);
    } catch (error) {
      if ((error as { code?: string } | null)?.code === '23505') {
        // Either a concurrent provision for this user, or a slug clash.
        const now = await getMyPublicProfile(actorId, db);
        if (now) return now;
        continue; // slug collision — retry with a fresh slug
      }
      throw error;
    }
  }
  throw Errors.conflict('Không thể tạo liên kết mời. Vui lòng thử lại.');
}

// ---------------------------------------------------------------------------
// getProfileBySlug — resolve an inviter from their link slug (exact match)
// ---------------------------------------------------------------------------
// Server-only: the public invite page calls this via the owner-role Drizzle db
// (which bypasses RLS). Exact match only — no search/prefix surface, so it is
// not enumerable.

export async function getProfileBySlug(
  slug: string,
  db: Db = defaultDb
): Promise<PublicProfile | null> {
  const parsed = handleSchema.safeParse(slug);
  if (!parsed.success) return null;

  const rows = await db
    .select({
      userId: publicProfiles.userId,
      ...publicProfileColumns,
    })
    .from(publicProfiles)
    .where(eq(publicProfiles.handle, parsed.data))
    .limit(1);

  return rows[0] ? toPublicIdentity(rows[0]) : null;
}

// ---------------------------------------------------------------------------
// renameMyProfile — set the display name and re-derive the handle from it
// ---------------------------------------------------------------------------
// The invite handle follows the display name by default ("what should we call
// you" is the one identity input), so a rename updates both in a single
// UPDATE. Outstanding invite links stop working — same accepted consequence
// as editing the slug directly via upsertPublicProfile.

export async function renameMyProfile(
  actorId: string,
  displayName: string,
  db: Db = defaultDb
): Promise<PublicProfile> {
  const name = renameProfileSchema.parse({ displayName }).displayName;

  // Ensure the profile row exists (rename may be the first profile touch).
  const current = await getOrCreateMyProfile(actorId, null, db);

  const base = handleFromName(name) ?? generateInviteSlug();

  // A name whose slug already matches the current handle (exactly, or up to a
  // digit suffix from an earlier collision) keeps the handle — don't churn the
  // invite link for a no-op rename.
  const keepsHandle =
    current.handle === base ||
    (current.handle.startsWith(base) &&
      /^\d+$/.test(current.handle.slice(base.length)));
  if (keepsHandle) {
    const [row] = await db
      .update(publicProfiles)
      .set({ displayName: name, updatedAt: new Date() })
      .where(eq(publicProfiles.userId, actorId))
      .returning();
    // Empty when the row was deleted concurrently (e.g. account deletion race)
    // after getOrCreateMyProfile — surface a clean error, not a TypeError.
    if (!row) throw Errors.internal(null, 'Profile disappeared mid-rename.');
    return toPublicIdentity(row);
  }

  // First attempt uses the bare base (unless reserved); collisions and the
  // blocklist get a 2–4 digit suffix, mirroring getOrCreateMyProfile's retry.
  for (let attempt = 0; attempt < 6; attempt++) {
    const handle =
      attempt === 0 && isValidHandle(base) ? base : suffixedHandle(base);
    try {
      const [row] = await db
        .update(publicProfiles)
        .set({ displayName: name, handle, updatedAt: new Date() })
        .where(eq(publicProfiles.userId, actorId))
        .returning();
      if (!row) throw Errors.internal(null, 'Profile disappeared mid-rename.');
      return toPublicIdentity(row);
    } catch (error) {
      if ((error as { code?: string } | null)?.code === '23505') {
        continue; // handle collision — retry with a fresh suffix
      }
      throw error;
    }
  }
  throw Errors.conflict('Không thể đổi tên. Vui lòng thử lại.');
}

/** Base + 2–4 random digits, always within the 20-char handle bound. */
function suffixedHandle(base: string): string {
  const digits = String(Math.floor(Math.random() * 10000)).padStart(2, '0');
  return `${base}${digits}`.slice(0, HANDLE_MAX_LENGTH);
}
