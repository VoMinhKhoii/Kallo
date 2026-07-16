// ---------------------------------------------------------------------------
// Deterministic avatar-disc tinting — shared by Circle and chat-groups
// ---------------------------------------------------------------------------
// Warm, status-free disc tints. Sage is reserved for status, so members are
// tinted across tan / taupe / stone only (deterministic from a seed).

export const DISC_TINTS = [
  'from-nham-accent/35 to-nham-border/45', // tan
  'from-[#b8a890]/40 to-[#9c8c78]/35', // taupe
  'from-[#cfc6ba]/45 to-[#a9a193]/35', // stone
] as const;

export function tintFor(seed: string | null, fallback: string): string {
  const key = seed ?? fallback;
  let hash = 0;
  for (let i = 0; i < key.length; i++) {
    hash = (hash * 31 + key.charCodeAt(i)) | 0;
  }
  return DISC_TINTS[Math.abs(hash) % DISC_TINTS.length];
}
