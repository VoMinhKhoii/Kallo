import { generateKeyPairSync, verify as verifyWith } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import {
  exchangeAppleAuthorizationCode,
  revokeAppleRefreshToken,
} from '@/lib/infra/apple-auth/apple-auth';
import { createAppleClientSecret } from '@/lib/infra/apple-auth/client-secret';
import { readAppleAuthConfig } from '@/lib/infra/apple-auth/config';

const { privateKey: PRIVATE_PEM, publicKey: PUBLIC_PEM } = generateKeyPairSync(
  'ec',
  {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }
);

const CONFIG = {
  teamId: 'TEAM98765',
  clientId: 'com.khoivo.nham',
  keyId: 'KEY1234567',
  keyP8: PRIVATE_PEM,
};
const NOW = Date.UTC(2026, 8, 25, 12, 0, 0);

function decode(part: string) {
  return JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
}

function idToken(sub: string): string {
  const b64 = (value: object) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${b64({ alg: 'RS256' })}.${b64({ sub, aud: CONFIG.clientId })}.sig`;
}

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllEnvs();
});

describe('createAppleClientSecret', () => {
  it('carries the claims Apple requires, signed ES256 with the key id', () => {
    const [header, claims, signature] = createAppleClientSecret(
      CONFIG,
      NOW
    ).split('.');
    const iat = NOW / 1000;

    expect(decode(header)).toEqual({ alg: 'ES256', kid: 'KEY1234567' });
    expect(decode(claims)).toEqual({
      iss: 'TEAM98765',
      iat,
      exp: iat + 300,
      aud: 'https://appleid.apple.com',
      sub: 'com.khoivo.nham',
    });
    // Apple caps a client secret at 180 days.
    expect(decode(claims).exp - iat).toBeLessThanOrEqual(180 * 24 * 3600);
    expect(
      verifyWith(
        'sha256',
        Buffer.from(`${header}.${claims}`),
        { key: PUBLIC_PEM, dsaEncoding: 'ieee-p1363' },
        Buffer.from(signature, 'base64url')
      )
    ).toBe(true);
  });
});

describe('readAppleAuthConfig', () => {
  it('is null until all four variables are set', () => {
    vi.stubEnv('APPLE_TEAM_ID', 'T');
    vi.stubEnv('APPLE_SIGNIN_CLIENT_ID', 'C');
    vi.stubEnv('APPLE_SIGNIN_KEY_ID', 'K');
    vi.stubEnv('APPLE_SIGNIN_KEY_P8', '');
    expect(readAppleAuthConfig()).toBeNull();
    vi.stubEnv('APPLE_SIGNIN_KEY_P8', 'pem');
    expect(readAppleAuthConfig()).toEqual({
      teamId: 'T',
      clientId: 'C',
      keyId: 'K',
      keyP8: 'pem',
    });
  });
});

describe('exchangeAppleAuthorizationCode', () => {
  it('posts the authorization_code grant and returns the refresh token + sub', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse(200, {
        access_token: 'at',
        refresh_token: 'rt-1',
        id_token: idToken('001234.apple-sub'),
      })
    );
    const result = await exchangeAppleAuthorizationCode('code-1', {
      fetch: fetchMock,
      config: CONFIG,
      now: NOW,
    });

    expect(result).toEqual({
      ok: true,
      refreshToken: 'rt-1',
      subject: '001234.apple-sub',
    });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://appleid.apple.com/auth/token');
    expect(init.method).toBe('POST');
    expect(init.signal).toBeInstanceOf(AbortSignal);
    const form = new URLSearchParams(init.body);
    expect(form.get('grant_type')).toBe('authorization_code');
    expect(form.get('code')).toBe('code-1');
    expect(form.get('client_id')).toBe('com.khoivo.nham');
    expect(form.get('client_secret')?.split('.')).toHaveLength(3);
  });

  it('maps a 400 invalid_grant to a non-retryable refusal', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const result = await exchangeAppleAuthorizationCode('stale', {
      fetch: vi
        .fn()
        .mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' })),
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'invalid_grant' });
  });

  it('reports a timeout without throwing', async () => {
    const timeout = new DOMException('timed out', 'TimeoutError');
    const result = await exchangeAppleAuthorizationCode('code', {
      fetch: vi.fn().mockRejectedValue(timeout),
      config: CONFIG,
    });
    expect(result).toEqual({ ok: false, reason: 'timeout' });
  });

  it('is "not configured" without env, and never calls Apple', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchMock = vi.fn();
    const result = await exchangeAppleAuthorizationCode('code', {
      fetch: fetchMock,
      config: null,
    });
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('is "not configured" when the .p8 cannot sign ES256', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const { privateKey } = generateKeyPairSync('ed25519', {
      privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
      publicKeyEncoding: { type: 'spki', format: 'pem' },
    });
    const result = await exchangeAppleAuthorizationCode('code', {
      fetch: vi.fn(),
      config: { ...CONFIG, keyP8: privateKey },
    });
    expect(result).toEqual({ ok: false, reason: 'not_configured' });
  });
});

describe('revokeAppleRefreshToken', () => {
  it('posts the refresh token with its type hint; 200 is success', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null));
    await expect(
      revokeAppleRefreshToken('rt-1', { fetch: fetchMock, config: CONFIG })
    ).resolves.toEqual({ ok: true });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://appleid.apple.com/auth/revoke');
    const form = new URLSearchParams(init.body);
    expect(form.get('token')).toBe('rt-1');
    expect(form.get('token_type_hint')).toBe('refresh_token');
    expect(form.get('client_id')).toBe('com.khoivo.nham');
  });

  it('treats an already-dead token (invalid_grant) as revoked', async () => {
    await expect(
      revokeAppleRefreshToken('rt-dead', {
        fetch: vi
          .fn()
          .mockResolvedValue(jsonResponse(400, { error: 'invalid_grant' })),
        config: CONFIG,
      })
    ).resolves.toEqual({ ok: true });
  });

  it('fails retryably on a client error or a 5xx', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const response of [
      jsonResponse(400, { error: 'invalid_client' }),
      new Response('down', { status: 503 }),
    ]) {
      await expect(
        revokeAppleRefreshToken('rt-1', {
          fetch: vi.fn().mockResolvedValue(response),
          config: CONFIG,
        })
      ).resolves.toEqual({ ok: false, reason: 'upstream_error' });
    }
  });

  it('reports a timeout', async () => {
    await expect(
      revokeAppleRefreshToken('rt-1', {
        fetch: vi
          .fn()
          .mockRejectedValue(new DOMException('timed out', 'TimeoutError')),
        config: CONFIG,
      })
    ).resolves.toEqual({ ok: false, reason: 'timeout' });
  });
});
