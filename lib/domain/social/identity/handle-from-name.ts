// ---------------------------------------------------------------------------
// handleFromName — derive an invite-link handle from a display name
// ---------------------------------------------------------------------------
// The invite handle follows the display name by default ("change username
// changes both"), so a rename derives a fresh slug from the new name. Pure and
// dependency-light, matching handles.ts.

/**
 * Reserve room for a collision suffix (2–4 digits) within the 20-char
 * HANDLE_MAX_LENGTH, so `base + digits` never overflows the handle bound.
 */
const BASE_MAX_LENGTH = 16;
const BASE_MIN_LENGTH = 3;

/** Unicode combining marks (U+0300–U+036F) left behind by NFD decomposition. */
const COMBINING_MARKS = /[̀-ͯ]/g;

/**
 * Derive a handle base from a display name: strip diacritics (NFD + combining
 * marks, with an explicit đ/Đ → d — U+0111 has no Unicode decomposition),
 * lowercase, keep only [a-z0-9], truncate to 16 chars. Returns null when fewer
 * than 3 usable chars survive (e.g. an emoji-only name) — the caller falls
 * back to a generated slug. May return a reserved word; the service layer
 * suffixes digits on reserve/collision.
 */
export function handleFromName(name: string): string | null {
  const base = name
    .normalize('NFD')
    .replace(COMBINING_MARKS, '')
    .replace(/[đĐ]/g, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, BASE_MAX_LENGTH);

  return base.length >= BASE_MIN_LENGTH ? base : null;
}
