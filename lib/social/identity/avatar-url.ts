// ---------------------------------------------------------------------------
// avatarUrlFor — public URL for an avatar storage path
// ---------------------------------------------------------------------------
// The `avatars` bucket is public (avatars render on the anonymous invite page
// and in feeds on web + mobile), so the URL is a plain static-object path.
// Centralized here so a later switch to signed URLs touches one place.

export function avatarUrlFor(path: string | null): string | null {
  if (!path) return null;
  const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!base) return null;
  return `${base}/storage/v1/object/public/avatars/${path}`;
}
