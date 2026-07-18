import { publicProfiles } from '@/lib/db/schema';
import { avatarUrlFor } from '@/lib/groups/avatar-url';

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
}

/** Row → response shape. A user-uploaded photo (`avatar_path`, served from the
 * public `avatars` bucket) takes precedence over the OAuth `avatar_url`. */
export function toPublicIdentity(
  row: Omit<PublicIdentity, 'avatarUrl'> & {
    avatarUrl: string | null;
    avatarPath?: string | null;
  }
): PublicIdentity {
  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
    avatarUrl: avatarUrlFor(row.avatarPath ?? null) ?? row.avatarUrl,
  };
}
