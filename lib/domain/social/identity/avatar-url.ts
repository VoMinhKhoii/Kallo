// ---------------------------------------------------------------------------
// avatarUrlFor — public URL for an avatar storage path
// ---------------------------------------------------------------------------
// The `avatars` bucket is public (avatars render on the anonymous invite page
// and in feeds on web + mobile), served from its R2 custom domain, so the URL
// is the domain plus the object key. Centralized here so a later switch to
// signed URLs touches one place. Past the R2 free-tier cap on reads there is
// no URL at all, and clients fall back to the initials disc / OAuth picture.

import { storageReadsAllowed } from '@/lib/infra/storage/object-storage';

export function avatarUrlFor(path: string | null): string | null {
  if (!path) return null;
  if (!storageReadsAllowed()) return null;
  const base = process.env.NEXT_PUBLIC_AVATAR_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${path}`;
}
