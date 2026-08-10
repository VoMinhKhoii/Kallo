import 'server-only';

/**
 * The Google **Web** OAuth client ID, resolved at request time.
 *
 * Server-only by design: it is read here and passed down through `AuthProvider`
 * rather than exposed as `NEXT_PUBLIC_*`, so it stays a per-environment runtime
 * value instead of being baked into the Docker image at build time (same
 * reasoning as the RevenueCat web key in `app/api/v1/account/billing-config`).
 *
 * Returns null when unset — including the empty string a Cloud Run
 * `--update-env-vars` entry leaves behind when its GitHub variable is missing —
 * which leaves web Google sign-in on the redirect fallback.
 */
export function googleWebClientId(): string | null {
  return process.env.GOOGLE_WEB_CLIENT_ID || null;
}
