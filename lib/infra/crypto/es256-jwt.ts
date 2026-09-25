// ---------------------------------------------------------------------------
// ES256 JWT signing (no dependency)
// ---------------------------------------------------------------------------
// Apple takes an ES256 JWT signed with a downloaded .p8 key in two places we
// use: the APNs provider token and the Sign in with Apple client secret. Both
// are one header, one claims object and one P-256 signature, so the signer is
// hand-rolled on node:crypto rather than pulling in a JOSE library.
//
// The detail Apple is unforgiving about, and that no type checker sees: the
// signature must be IEEE-P1363 (raw r||s). Node's default is DER, which Apple
// rejects outright.

import 'server-only';
import {
  createPrivateKey,
  type KeyObject,
  sign as signWith,
} from 'node:crypto';

/**
 * Parse a .p8 (PKCS#8 PEM) and refuse anything that cannot sign ES256.
 *
 * Literal `\n` survive single-line env vars; PEM parsing needs real newlines.
 * Any valid PKCS#8 parses, so the curve is checked explicitly: an RSA or
 * Ed25519 key would otherwise build a signer whose every JWT Apple refuses.
 * `label` names the env var in the error so the log points at the fix.
 */
export function loadEs256PrivateKey(pem: string, label: string): KeyObject {
  const key = createPrivateKey(pem.replace(/\\n/g, '\n'));
  if (
    key.asymmetricKeyType !== 'ec' ||
    key.asymmetricKeyDetails?.namedCurve !== 'prime256v1'
  ) {
    throw new Error(
      `${label} must be an EC P-256 (prime256v1) key; got ${key.asymmetricKeyType}${key.asymmetricKeyDetails?.namedCurve ? `/${key.asymmetricKeyDetails.namedCurve}` : ''}`
    );
  }
  return key;
}

/** `{alg:'ES256',kid}.{claims}` signed with `key`, P1363-encoded. */
export function signEs256Jwt(
  key: KeyObject,
  keyId: string,
  claims: Record<string, unknown>
): string {
  const header = Buffer.from(
    JSON.stringify({ alg: 'ES256', kid: keyId })
  ).toString('base64url');
  const body = Buffer.from(JSON.stringify(claims)).toString('base64url');
  const signature = signWith('sha256', Buffer.from(`${header}.${body}`), {
    key,
    // MANDATORY: Node defaults to DER, which Apple rejects outright.
    dsaEncoding: 'ieee-p1363',
  });
  return `${header}.${body}.${signature.toString('base64url')}`;
}
