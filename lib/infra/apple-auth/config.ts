import 'server-only';

/**
 * Sign in with Apple REST credentials. All four come from Apple Developer →
 * Keys (a key with "Sign in with Apple" enabled for the app's primary App ID)
 * and Membership; setup lives in docs/GOOGLE_CLOUD_RUN.md.
 *
 * `clientId` is the audience the authorization code was minted for — for the
 * native iOS flow that is the app's bundle id, not a web Services ID.
 */
export interface AppleAuthConfig {
  teamId: string;
  clientId: string;
  keyId: string;
  /** Contents of the AuthKey_XXXX.p8 file; escaped \n are normalized. */
  keyP8: string;
}

/** `null` when any variable is unset: the caller degrades, never throws. */
export function readAppleAuthConfig(): AppleAuthConfig | null {
  const teamId = process.env.APPLE_TEAM_ID;
  const clientId = process.env.APPLE_SIGNIN_CLIENT_ID;
  const keyId = process.env.APPLE_SIGNIN_KEY_ID;
  const keyP8 = process.env.APPLE_SIGNIN_KEY_P8;
  if (!(teamId && clientId && keyId && keyP8)) return null;
  return { teamId, clientId, keyId, keyP8 };
}
