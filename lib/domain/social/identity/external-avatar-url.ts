// ---------------------------------------------------------------------------
// externalAvatarUrl — the one gate for a photo URL the user did not upload
// ---------------------------------------------------------------------------
// `public_profiles.avatar_url` is synced from the auth user's metadata, which
// the account owner can write. Friends' phones fetch it (the push extension,
// the Flutter avatar disc) outside the web CSP, so the URL is held to the same
// hosts the CSP's `img-src` allows: Google sign-in pictures and the app's own
// avatar domain. Anything else is null, and clients draw the initials disc.
// Applied when the URL is stored and again wherever a stored one is projected,
// so a row written before this gate existed is neutralised on read.

const MAX_LENGTH = 2048;
const GOOGLE_PICTURE_HOST_SUFFIX = '.googleusercontent.com';

function ownAvatarHost(): string | null {
  const base = process.env.NEXT_PUBLIC_AVATAR_BASE_URL;
  if (!base) return null;
  try {
    return new URL(base).hostname;
  } catch {
    return null;
  }
}

/** The URL in its parsed (WHATWG) form when it is https on an allowed image
 *  host with no userinfo or port; null otherwise. */
export function externalAvatarUrl(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0 || raw.length > MAX_LENGTH) {
    return null;
  }
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== 'https:') return null;
  if (url.username || url.password || url.port) return null;
  const host = url.hostname;
  const allowed =
    host.endsWith(GOOGLE_PICTURE_HOST_SUFFIX) || host === ownAvatarHost();
  // The serialized form, so a client whose parser reads the raw string
  // differently still lands on the host checked here.
  return allowed && url.href.length <= MAX_LENGTH ? url.href : null;
}
