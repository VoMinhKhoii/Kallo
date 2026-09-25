import 'server-only';
import {
  loadEs256PrivateKey,
  signEs256Jwt,
} from '@/lib/infra/crypto/es256-jwt';
import type { AppleAuthConfig } from './config';

export const APPLE_AUDIENCE = 'https://appleid.apple.com';

/**
 * Apple caps a client secret at 180 days. We mint one per call instead of
 * holding a long-lived one, so a leaked secret is useless within minutes and
 * there is nothing to rotate.
 */
const CLIENT_SECRET_TTL_SECONDS = 5 * 60;

/**
 * The `client_secret` Apple's /auth/token and /auth/revoke expect: an ES256
 * JWT signed with the Sign in with Apple key.
 * Throws when the .p8 cannot sign ES256 — the caller turns that into a
 * "not configured" result.
 */
export function createAppleClientSecret(
  config: AppleAuthConfig,
  now: number = Date.now()
): string {
  const key = loadEs256PrivateKey(config.keyP8, 'APPLE_SIGNIN_KEY_P8');
  const iat = Math.floor(now / 1000);
  return signEs256Jwt(key, config.keyId, {
    iss: config.teamId,
    iat,
    exp: iat + CLIENT_SECRET_TTL_SECONDS,
    aud: APPLE_AUDIENCE,
    sub: config.clientId,
  });
}
