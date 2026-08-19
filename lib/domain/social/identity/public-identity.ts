import { avatarUrlFor } from '@/lib/domain/social/identity/avatar-url';
import { publicProfiles } from '@/lib/infra/db/schema';

/** Canonical public-profile projection for every server-side identity query. */
export const publicProfileColumns = {
  handle: publicProfiles.handle,
  displayName: publicProfiles.displayName,
  avatarSeed: publicProfiles.avatarSeed,
  avatarUrl: publicProfiles.avatarUrl,
  avatarPath: publicProfiles.avatarPath,
};

export interface PublicIdentity {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  /** Effective photo URL: the user's uploaded avatar, else the OAuth picture. */
  avatarUrl: string | null;
  /** True when the photo is a user upload (drives the settings Remove button —
   * clearing an OAuth-only avatar would be a silent no-op). */
  hasCustomAvatar: boolean;
}

/** Row → response shape. A user-uploaded photo (`avatar_path`, served from the
 * public `avatars` bucket) takes precedence over the OAuth `avatar_url`. */
export function toPublicIdentity(
  row: Omit<PublicIdentity, 'avatarUrl' | 'hasCustomAvatar'> & {
    avatarUrl: string | null;
    avatarPath?: string | null;
  }
): PublicIdentity {
  const uploadedUrl = avatarUrlFor(row.avatarPath ?? null);
  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
    avatarUrl: uploadedUrl ?? row.avatarUrl,
    hasCustomAvatar: uploadedUrl !== null,
  };
}
