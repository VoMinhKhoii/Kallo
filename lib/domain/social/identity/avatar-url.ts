// ---------------------------------------------------------------------------
// avatarUrlFor — public URL for an avatar storage path
// ---------------------------------------------------------------------------
// The `avatars` bucket is public (avatars render on the anonymous invite page
// and in feeds on web + mobile), served from its R2 custom domain, so the URL
// is the domain plus the object key. Centralized here so a later switch to
// signed URLs touches one place.

export function avatarUrlFor(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_AVATAR_BASE_URL;
  if (!base) return null;
  return `${base.replace(/\/+$/, '')}/${path}`;
}
