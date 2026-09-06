// The FCM sender is two HTTP calls and a pile of format rules, none of which
// a type checker can hold us to: the assertion Google will accept, the message
// body Google will not 400 on, and the difference between "this token is dead"
// and "try again later". All three are pinned here against a fetch double, so
// a change to any of them shows up as a failing expectation rather than as
// silently undelivered notifications in production.

import { generateKeyPairSync } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { createFcmSender, resetFcmTokenCache } from '@/lib/infra/push/fcm';
import type { PushMessage } from '@/lib/infra/push/types';

// A real (throwaway, test-only) key pair: node:crypto has to actually sign,
// because an unsigned or malformed assertion is exactly what this suite is
// here to catch. Generated per run — nothing secret is committed.
const { privateKey: PRIVATE_KEY } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

const SERVICE_ACCOUNT = JSON.stringify({
  project_id: 'kallo-test',
  client_email: 'push@kallo-test.iam.gserviceaccount.com',
  private_key: PRIVATE_KEY,
});

function message(overrides: Partial<PushMessage> = {}): PushMessage {
  return {
    token: 'device-token-1',
    title: 'Kallo',
    body: 'Mai reacted to your meal',
    data: { type: 'share.reaction' },
    ...overrides,
  };
}

/** Mocked fetch: first call is the OAuth exchange, the rest are sends. */
function mockFetch(sendResponses: Array<{ status: number; body?: unknown }>) {
  const calls: Array<{ url: string; init: RequestInit }> = [];
  let sendIndex = 0;
  const fetchMock = vi.fn(async (url: string, init: RequestInit) => {
    calls.push({ url, init });
    if (url.includes('oauth2.googleapis.com')) {
      return {
        ok: true,
        status: 200,
        json: async () => ({ access_token: 'ya29.fake', expires_in: 3599 }),
      } as unknown as Response;
    }
    const next = sendResponses[sendIndex++] ?? { status: 200 };
    return {
      ok: next.status >= 200 && next.status < 300,
      status: next.status,
      json: async () => next.body ?? {},
    } as unknown as Response;
  });
  vi.stubGlobal('fetch', fetchMock);
  return { calls, fetchMock };
}

/** The JWT's signature needs the real key to verify; its header and claims are
 *  plain base64url and are what Google validates us on. */
function decodeAssertion(body: string) {
  const assertion = new URLSearchParams(body).get('assertion') ?? '';
  const [header, claims] = assertion.split('.');
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  return { header: decode(header), claims: decode(claims), assertion };
}

describe('createFcmSender', () => {
  beforeEach(() => {
    resetFcmTokenCache();
    vi.unstubAllGlobals();
  });

  it('exchanges a correctly assembled RS256 service-account JWT', async () => {
    const { calls } = mockFetch([{ status: 200 }]);

    await createFcmSender(SERVICE_ACCOUNT).send([message()]);

    const exchange = calls[0];
    expect(exchange.url).toBe('https://oauth2.googleapis.com/token');
    const body = String(exchange.init.body);
    expect(new URLSearchParams(body).get('grant_type')).toBe(
      'urn:ietf:params:oauth:grant-type:jwt-bearer'
    );
    const { header, claims, assertion } = decodeAssertion(body);
    expect(header).toEqual({ alg: 'RS256', typ: 'JWT' });
    expect(claims.iss).toBe('push@kallo-test.iam.gserviceaccount.com');
    expect(claims.aud).toBe('https://oauth2.googleapis.com/token');
    expect(claims.scope).toBe(
      'https://www.googleapis.com/auth/firebase.messaging'
    );
    expect(claims.exp - claims.iat).toBe(3600);
    // Three segments: an unsigned assertion is rejected by Google outright.
    expect(assertion.split('.')).toHaveLength(3);
    expect(assertion.split('.')[2].length).toBeGreaterThan(0);
  });

  it('reuses the cached access token across sends', async () => {
    const { calls } = mockFetch([{ status: 200 }, { status: 200 }]);
    const sender = createFcmSender(SERVICE_ACCOUNT);

    await sender.send([message()]);
    await sender.send([message({ token: 'device-token-2' })]);

    const exchanges = calls.filter((call) =>
      call.url.includes('oauth2.googleapis.com')
    );
    expect(exchanges).toHaveLength(1);
    expect(calls).toHaveLength(3);
  });

  it('sends to the project endpoint with the bearer token', async () => {
    const { calls } = mockFetch([{ status: 200 }]);

    await createFcmSender(SERVICE_ACCOUNT).send([message()]);

    const send = calls[1];
    expect(send.url).toBe(
      'https://fcm.googleapis.com/v1/projects/kallo-test/messages:send'
    );
    expect((send.init.headers as Record<string, string>).authorization).toBe(
      'Bearer ya29.fake'
    );
  });

  it('omits the apns and android blocks when nothing needs them', async () => {
    const { calls } = mockFetch([{ status: 200 }]);

    await createFcmSender(SERVICE_ACCOUNT).send([message()]);

    const sent = JSON.parse(String(calls[1].init.body));
    expect(sent.message).toEqual({
      token: 'device-token-1',
      notification: { title: 'Kallo', body: 'Mai reacted to your meal' },
      data: { type: 'share.reaction' },
    });
    expect(sent.message).not.toHaveProperty('apns');
    expect(sent.message).not.toHaveProperty('android');
  });

  it('expresses collapse key and badge on both platforms when present', async () => {
    const { calls } = mockFetch([{ status: 200 }]);

    await createFcmSender(SERVICE_ACCOUNT).send([
      message({ collapseKey: 'share.reaction:abc', badge: 4 }),
    ]);

    const sent = JSON.parse(String(calls[1].init.body));
    expect(sent.message.apns).toEqual({
      headers: { 'apns-collapse-id': 'share.reaction:abc' },
      payload: { aps: { badge: 4 } },
    });
    expect(sent.message.android).toEqual({
      collapse_key: 'share.reaction:abc',
    });
  });

  it('keeps the apns headers block out when only a badge is set', async () => {
    const { calls } = mockFetch([{ status: 200 }]);

    await createFcmSender(SERVICE_ACCOUNT).send([message({ badge: 1 })]);

    const sent = JSON.parse(String(calls[1].init.body));
    expect(sent.message.apns).toEqual({ payload: { aps: { badge: 1 } } });
    expect(sent.message).not.toHaveProperty('android');
  });

  it('prunes on 404 UNREGISTERED and on 400 INVALID_ARGUMENT', async () => {
    mockFetch([
      {
        status: 404,
        body: {
          error: {
            status: 'NOT_FOUND',
            details: [{ errorCode: 'UNREGISTERED' }],
          },
        },
      },
      {
        status: 400,
        body: {
          error: {
            status: 'INVALID_ARGUMENT',
            details: [{ errorCode: 'INVALID_ARGUMENT' }],
          },
        },
      },
    ]);

    const results = await createFcmSender(SERVICE_ACCOUNT).send([
      message({ token: 'dead' }),
      message({ token: 'malformed' }),
    ]);

    expect(results).toEqual([
      { token: 'dead', ok: false, shouldPrune: true },
      { token: 'malformed', ok: false, shouldPrune: true },
    ]);
  });

  it('keeps the token on transient failures', async () => {
    mockFetch([
      { status: 503, body: { error: { status: 'UNAVAILABLE' } } },
      { status: 429, body: { error: { status: 'RESOURCE_EXHAUSTED' } } },
      { status: 401, body: { error: { status: 'UNAUTHENTICATED' } } },
    ]);

    const results = await createFcmSender(SERVICE_ACCOUNT).send([
      message({ token: 'a' }),
      message({ token: 'b' }),
      message({ token: 'c' }),
    ]);

    expect(results.every((result) => result.shouldPrune)).toBe(false);
    expect(results.every((result) => result.ok)).toBe(false);
  });

  it('reports success per token and never calls out for an empty batch', async () => {
    const { fetchMock } = mockFetch([{ status: 200 }]);
    const sender = createFcmSender(SERVICE_ACCOUNT);

    expect(await sender.send([])).toEqual([]);
    expect(fetchMock).not.toHaveBeenCalled();

    expect(await sender.send([message()])).toEqual([
      { token: 'device-token-1', ok: true, shouldPrune: false },
    ]);
  });
});
