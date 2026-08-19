import 'server-only';

/**
 * The Google **Web** OAuth client ID, resolved at request time.
 *
 * Server-only by design: it is read here and passed down through `AuthProvider`
 * rather than exposed as `NEXT_PUBLIC_*`, so it stays a per-environment runtime
 * value instead of being baked into the Docker image at build time (same
 * reasoning as the RevenueCat web key in `app/api/v1/account/billing-config`).
 *
 * Returns null when unset, empty, or whitespace — a Cloud Run
 * `--update-env-vars` entry whose GitHub variable is missing leaves an empty
 * string behind, and a stray space in that variable leaves whitespace. Both
 * must read as "unset": a blank client ID handed to GIS fails deep inside
 * Google's script, which reports it as an origin problem and buries the real
 * cause. Null instead keeps sign-in on the redirect fallback and lets
 * `useGoogleIdentity` say plainly that the variable isn't configured.
 */
export function googleWebClientId(): string | null {
  return process.env.GOOGLE_WEB_CLIENT_ID?.trim() || null;
}
