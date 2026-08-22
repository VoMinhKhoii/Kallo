// Validates a post-auth redirect target so it can only be an in-app, locale-
// prefixed path (never an open redirect). Mirrors the guard in
// app/auth/callback/route.ts, shared so the landing page can reuse it.

const SAFE_NEXT_RE = /^\/(en|vi)(\/[\w\-./?&=%#]*)?$/;

export function safeNextPath(raw: string | null | undefined): string | null {
  if (!raw) return null;
  if (raw.length > 512) return null;
  if (raw.startsWith('//') || raw.startsWith('/\\')) return null;
  for (let i = 0; i < raw.length; i++) {
    const c = raw.charCodeAt(i);
    // Reject control chars (< 0x20), DEL (0x7f), and backslash (0x5c).
    if (c < 0x20 || c === 0x7f || c === 0x5c) return null;
  }
  if (!SAFE_NEXT_RE.test(raw)) return null;
  return raw;
}
