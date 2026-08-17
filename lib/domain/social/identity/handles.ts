// ---------------------------------------------------------------------------
// Handles — reserved-handle blocklist + validator
// ---------------------------------------------------------------------------
// Pure, dependency-light helper (no DB imports) so it is safe to vendor-copy
// into the mobile package. Handles are the add-by-@handle identity surface; the
// blocklist blunts impersonation/squatting of system identities, and the
// validator enforces a lowercased, ASCII, length-bounded shape so handles are
// case-insensitively unique (lowercase-on-write, exact-match lookup on read).

/**
 * Reserved handles that may never be claimed by a user. Lowercase. Covers
 * system/brand identities and common impersonation targets.
 */
export const RESERVED_HANDLES: ReadonlySet<string> = new Set([
  'admin',
  'administrator',
  'nham',
  'nhamapp',
  'support',
  'help',
  'coach',
  'system',
  'root',
  'official',
  'staff',
  'team',
  'moderator',
  'mod',
  'security',
  'api',
  'www',
  'me',
  'null',
  'undefined',
]);

/** Allowed handle shape: 3-20 chars, lowercase letters/digits/underscore. */
export const HANDLE_PATTERN = /^[a-z0-9_]{3,20}$/u;

export const HANDLE_MIN_LENGTH = 3;
export const HANDLE_MAX_LENGTH = 20;

export type HandleValidationError =
  | 'too_short'
  | 'too_long'
  | 'invalid_chars'
  | 'reserved';

export type HandleValidationResult =
  | { valid: true; handle: string }
  | { valid: false; error: HandleValidationError };

/**
 * Normalize + validate a handle. Lowercases and trims first (so validation is
 * case-insensitive and the stored form is canonical), then checks length,
 * character set, and the reserved blocklist.
 */
export function validateHandle(raw: string): HandleValidationResult {
  const handle = raw.trim().toLowerCase();

  if (handle.length < HANDLE_MIN_LENGTH) {
    return { valid: false, error: 'too_short' };
  }
  if (handle.length > HANDLE_MAX_LENGTH) {
    return { valid: false, error: 'too_long' };
  }
  if (!HANDLE_PATTERN.test(handle)) {
    return { valid: false, error: 'invalid_chars' };
  }
  if (RESERVED_HANDLES.has(handle)) {
    return { valid: false, error: 'reserved' };
  }

  return { valid: true, handle };
}

/** True when the handle passes every rule (convenience predicate). */
export function isValidHandle(raw: string): boolean {
  return validateHandle(raw).valid;
}
