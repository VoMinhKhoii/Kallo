import { publicProfiles } from '@/lib/db/schema';

/** Canonical public-profile projection for every server-side identity query. */
export const publicProfileColumns = {
  handle: publicProfiles.handle,
  displayName: publicProfiles.displayName,
  avatarSeed: publicProfiles.avatarSeed,
  avatarUrl: publicProfiles.avatarUrl,
};

export interface PublicIdentity {
  userId: string;
  handle: string;
  displayName: string | null;
  avatarSeed: string | null;
  avatarUrl: string | null;
}

export function toPublicIdentity(row: PublicIdentity): PublicIdentity {
  return {
    userId: row.userId,
    handle: row.handle,
    displayName: row.displayName,
    avatarSeed: row.avatarSeed,
    avatarUrl: row.avatarUrl,
  };
}
