import { generateKeyPairSync, verify as verifyWith } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  base64url,
  loadEs256PrivateKey,
  signEs256Jwt,
} from '@/lib/infra/crypto/es256-jwt';

// A real throwaway P-256 pair: the signature ENCODING is what Apple rejects,
// so node:crypto has to actually sign and verify here.
const { privateKey: PRIVATE_PEM, publicKey: PUBLIC_PEM } = generateKeyPairSync(
  'ec',
  {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }
);

function decodePart(part: string): unknown {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

describe('signEs256Jwt', () => {
  it('signs a P1363 ES256 JWT with the kid header and the given claims', () => {
    const key = loadEs256PrivateKey(PRIVATE_PEM, 'TEST_KEY');
    const jwt = signEs256Jwt(key, 'KID1234567', { iss: 'TEAM', iat: 1 });
    const [header, claims, signature] = jwt.split('.');

    expect(decodePart(header)).toEqual({ alg: 'ES256', kid: 'KID1234567' });
    expect(decodePart(claims)).toEqual({ iss: 'TEAM', iat: 1 });
    const raw = Buffer.from(signature, 'base64url');
    // P1363 is exactly r||s = 64 bytes for P-256; DER would be ~70-72.
    expect(raw).toHaveLength(64);
    expect(
      verifyWith(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        { key: PUBLIC_PEM, dsaEncoding: 'ieee-p1363' },
        raw
      )
    ).toBe(true);
  });

  it('never emits base64 padding or the +/ alphabet', () => {
    expect(base64url(Buffer.from([0xfb, 0xff, 0xfe]))).toBe('-__-');
    expect(base64url('a')).toBe('YQ');
  });
});

describe('loadEs256PrivateKey', () => {
  it('accepts a PEM whose newlines arrived escaped from an env var', () => {
    const escaped = PRIVATE_PEM.replace(/\n/g, '\\n');
    expect(loadEs256PrivateKey(escaped, 'TEST_KEY').asymmetricKeyType).toBe(
      'ec'
    );
  });

  it('refuses a key that cannot sign ES256, naming the env var', () => {
    const { privateKey } = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    expect(() => loadEs256PrivateKey(privateKey, 'APPLE_KEY')).toThrow(
      /APPLE_KEY must be an EC P-256/
    );
  });
});
