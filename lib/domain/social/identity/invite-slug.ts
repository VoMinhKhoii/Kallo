// ---------------------------------------------------------------------------
// Invite slug generator
// ---------------------------------------------------------------------------
// Produces a default, human-readable link slug for a freshly-provisioned
// profile (the editable end of the invite link). Always matches HANDLE_PATTERN
// and avoids the reserved blocklist; the caller retries on a uniqueness clash.

import { RESERVED_HANDLES } from './handles';

// Warm, on-brand single tokens (no diacritics — slugs are ASCII [a-z0-9_]).
const SLUG_WORDS = [
  'pho',
  'banh',
  'com',
  'bun',
  'mi',
  'xoi',
  'che',
  'tra',
  'goi',
  'nem',
  'canh',
  'rau',
  'ca',
  'ga',
  'cha',
  'nom',
] as const;

/**
 * A default invite slug: a warm word + 4 digits (e.g. `pho4821`). 7–8 chars,
 * always within the 3–20 handle bound and never reserved. Not guaranteed
 * unique — the provisioning path retries on a unique-constraint clash.
 */
export function generateInviteSlug(): string {
  const word = SLUG_WORDS[Math.floor(Math.random() * SLUG_WORDS.length)];
  const digits = Math.floor(1000 + Math.random() * 9000); // 4 digits, no leading zero
  const slug = `${word}${digits}`;
  // Defensive: a generated word should never be reserved, but guard anyway.
  return RESERVED_HANDLES.has(slug) ? `u${digits}${digits}` : slug;
}
