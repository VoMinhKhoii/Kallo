// The APNs sender is one signature format, one set of headers and one failure
// taxonomy, none of which a type checker can hold us to: Apple rejects a
// DER-encoded ES256 signature outright, silently 400s on a wrong :path or
// apns-topic, and answers BadDeviceToken for a perfectly good token sent to
// the wrong host. All three are pinned here against a fake HTTP/2 session, so
// a regression shows up as a failing expectation rather than as silently
// undelivered notifications — or, worse, as pruned live registrations.

import { generateKeyPairSync, verify as verifyWith } from 'node:crypto';
import { EventEmitter } from 'node:events';
import type { Mock } from 'vitest';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('node:http2', () => {
  const connect = (...args: unknown[]) => connectMock(...args);
  return { connect, default: { connect } };
});

import { createApnsSender, resetApnsState } from '@/lib/infra/push/apns';
import type { PushMessage } from '@/lib/infra/push/types';

// A real (throwaway, test-only) P-256 key pair: node:crypto has to actually
// sign, because the signature ENCODING is what this suite exists to catch.
const { privateKey: PRIVATE_PEM, publicKey: PUBLIC_PEM } = generateKeyPairSync(
  'ec',
  {
    namedCurve: 'P-256',
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
    publicKeyEncoding: { type: 'spki', format: 'pem' },
  }
);

const CONFIG = {
  keyP8: PRIVATE_PEM,
  keyId: 'KEY123456',
  teamId: 'TEAM98765',
  bundleId: 'com.khoivo.nham',
  production: false,
};

interface Reply {
  status: number;
  body?: unknown;
  /** Fail the stream instead of answering — the network-error path. */
  error?: string;
}

interface SentRequest {
  headers: Record<string, string>;
  body: string;
}

let connectMock: (...args: unknown[]) => unknown;
let requests: SentRequest[];
let connects: string[];
let replies: Reply[];
let sessions: Array<
  EventEmitter & { destroyed: boolean; closed: boolean; unref: Mock }
>;
type FakeStream = EventEmitter & { setTimeout: Mock; destroy: Mock };
let streams: FakeStream[];

/** A fake HTTP/2 session whose streams answer from the `replies` queue. */
function installHttp2() {
  requests = [];
  streams = [];
  connects = [];
  replies = [];
  sessions = [];
  connectMock = (authority: unknown) => {
    connects.push(String(authority));
    const session = Object.assign(new EventEmitter(), {
      destroyed: false,
      closed: false,
      unref: vi.fn(),
      close: vi.fn(() => {
        session.closed = true;
      }),
      request(headers: Record<string, string>) {
        const stream = Object.assign(new EventEmitter(), {
          setTimeout: vi.fn(),
          destroy: vi.fn(),
          end(body: string) {
            requests.push({ headers, body });
            const reply = replies.shift() ?? { status: 200 };
            queueMicrotask(() => {
              if (reply.error) {
                stream.emit('error', new Error(reply.error));
                return;
              }
              stream.emit('response', { ':status': reply.status });
              if (reply.body !== undefined) {
                stream.emit('data', Buffer.from(JSON.stringify(reply.body)));
              }
              stream.emit('end');
            });
          },
        });
        streams.push(stream);
        return stream;
      },
    });
    sessions.push(session);
    return session;
  };
}

function message(overrides: Partial<PushMessage> = {}): PushMessage {
  return {
    token: 'device-token-1',
    title: 'Kallo',
    body: 'Mai reacted to your meal',
    data: { type: 'share.reaction' },
    ...overrides,
  };
}

function decodeJwt(authorization: string) {
  const jwt = authorization.replace(/^bearer /, '');
  const [header, claims, signature] = jwt.split('.');
  const decode = (part: string) =>
    JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  return {
    jwt,
    header: decode(header),
    claims: decode(claims),
    signingInput: `${header}.${claims}`,
    signature: Buffer.from(signature, 'base64url'),
  };
}

describe('createApnsSender', () => {
  beforeEach(() => {
    installHttp2();
    resetApnsState();
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('signs an ES256 provider token APNs will accept', async () => {
    await createApnsSender(CONFIG).send([message()]);

    const { header, claims, signingInput, signature } = decodeJwt(
      requests[0].headers.authorization
    );
    expect(header).toEqual({ alg: 'ES256', kid: 'KEY123456' });
    expect(claims.iss).toBe('TEAM98765');
    expect(claims.iat).toBeCloseTo(Math.floor(Date.now() / 1000), -1);
    expect(Object.keys(claims).sort()).toEqual(['iat', 'iss']);
    // The whole point: a DER signature verifies only with dsaEncoding 'der',
    // and APNs rejects it. P1363 is 64 raw bytes for P-256.
    expect(signature).toHaveLength(64);
    expect(
      verifyWith(
        'sha256',
        Buffer.from(signingInput),
        { key: PUBLIC_PEM, dsaEncoding: 'ieee-p1363' },
        signature
      )
    ).toBe(true);
  });

  it('accepts a .p8 whose newlines arrived escaped from the env', async () => {
    await createApnsSender({
      ...CONFIG,
      keyP8: PRIVATE_PEM.replace(/\n/g, '\\n'),
    }).send([message()]);

    expect(requests[0].headers.authorization).toMatch(/^bearer \S+\.\S+\.\S+$/);
  });

  it('reuses the cached token inside the window and refreshes past it', async () => {
    const sender = createApnsSender(CONFIG);
    const start = Date.now();
    const now = vi.spyOn(Date, 'now');

    now.mockReturnValue(start);
    await sender.send([message()]);
    now.mockReturnValue(start + 39 * 60 * 1000);
    await sender.send([message({ token: 'device-token-2' })]);
    now.mockReturnValue(start + 41 * 60 * 1000);
    await sender.send([message({ token: 'device-token-3' })]);

    const [first, second, third] = requests.map(
      (request) => request.headers.authorization
    );
    expect(second).toBe(first);
    expect(third).not.toBe(first);
    expect(decodeJwt(third).claims.iat).toBe(
      Math.floor((start + 41 * 60 * 1000) / 1000)
    );
  });

  it('posts to the sandbox host with every APNs header set', async () => {
    await createApnsSender(CONFIG).send([message()]);

    expect(connects).toEqual(['https://api.sandbox.push.apple.com']);
    const { headers } = requests[0];
    expect(headers[':method']).toBe('POST');
    expect(headers[':path']).toBe('/3/device/device-token-1');
    expect(headers['apns-topic']).toBe('com.khoivo.nham');
    expect(headers['apns-push-type']).toBe('alert');
    expect(headers['apns-priority']).toBe('10');
    expect(headers['apns-expiration']).toBe('0');
    expect(headers).not.toHaveProperty('apns-collapse-id');
  });

  it('uses the production host when configured', async () => {
    await createApnsSender({ ...CONFIG, production: true }).send([message()]);

    expect(connects).toEqual(['https://api.push.apple.com']);
  });

  it('reuses one HTTP/2 session across sends and reconnects after close', async () => {
    const sender = createApnsSender(CONFIG);

    await sender.send([message()]);
    await sender.send([message({ token: 'b' })]);
    expect(connects).toHaveLength(1);
    expect(sessions[0].unref).toHaveBeenCalled();

    sessions[0].emit('goaway');
    await sender.send([message({ token: 'c' })]);
    expect(connects).toHaveLength(2);
  });

  it('sends the collapse key, truncated to Apple’s 64-byte limit', async () => {
    const long = `share.reaction:${'x'.repeat(80)}`;
    await createApnsSender(CONFIG).send([
      message({ collapseKey: 'share.reaction:abc' }),
      message({ token: 'b', collapseKey: long }),
    ]);

    expect(requests[0].headers['apns-collapse-id']).toBe('share.reaction:abc');
    const truncated = requests[1].headers['apns-collapse-id'];
    expect(Buffer.byteLength(truncated)).toBe(64);
    expect(truncated).toBe(long.slice(0, 64));
  });

  it('builds the native aps dict with the data map flattened alongside', async () => {
    await createApnsSender(CONFIG).send([message()]);

    expect(JSON.parse(requests[0].body)).toEqual({
      aps: {
        alert: { title: 'Kallo', body: 'Mai reacted to your meal' },
        sound: 'default',
      },
      type: 'share.reaction',
    });
  });

  it('includes the badge only when one was asked for', async () => {
    await createApnsSender(CONFIG).send([message({ badge: 4 })]);

    expect(JSON.parse(requests[0].body).aps).toEqual({
      alert: { title: 'Kallo', body: 'Mai reacted to your meal' },
      sound: 'default',
      badge: 4,
    });
  });

  it('prunes on 410 Unregistered and 400 DeviceTokenNotForTopic only', async () => {
    replies.push(
      { status: 410, body: { reason: 'Unregistered' } },
      { status: 400, body: { reason: 'DeviceTokenNotForTopic' } },
      { status: 500, body: { reason: 'InternalServerError' } },
      { status: 429, body: { reason: 'TooManyRequests' } }
    );

    const results = await createApnsSender(CONFIG).send([
      message({ token: 'gone' }),
      message({ token: 'wrong-topic' }),
      message({ token: 'apple-hiccup' }),
      message({ token: 'throttled' }),
    ]);

    expect(results).toEqual([
      { token: 'gone', ok: false, shouldPrune: true },
      { token: 'wrong-topic', ok: false, shouldPrune: true },
      { token: 'apple-hiccup', ok: false, shouldPrune: false },
      { token: 'throttled', ok: false, shouldPrune: false },
    ]);
  });

  it('never prunes on BadDeviceToken — it is a host mismatch as often as a dead token', async () => {
    replies.push({ status: 400, body: { reason: 'BadDeviceToken' } });

    const results = await createApnsSender(CONFIG).send([
      message({ token: 'maybe-fine' }),
    ]);

    expect(results).toEqual([
      { token: 'maybe-fine', ok: false, shouldPrune: false },
    ]);
    expect(console.error).toHaveBeenCalledWith(
      expect.stringContaining('APNS_PRODUCTION')
    );
  });

  it('returns one result per message even when a stream blows up', async () => {
    replies.push(
      { status: 200 },
      { status: 0, error: 'socket hang up' },
      { status: 200 }
    );

    const results = await createApnsSender(CONFIG).send([
      message({ token: 'a' }),
      message({ token: 'b' }),
      message({ token: 'c' }),
    ]);

    expect(results).toEqual([
      { token: 'a', ok: true, shouldPrune: false },
      { token: 'b', ok: false, shouldPrune: false },
      { token: 'c', ok: true, shouldPrune: false },
    ]);
  });

  it('reports success per token and never connects for an empty batch', async () => {
    const sender = createApnsSender(CONFIG);

    expect(await sender.send([])).toEqual([]);
    expect(connects).toHaveLength(0);

    expect(await sender.send([message()])).toEqual([
      { token: 'device-token-1', ok: true, shouldPrune: false },
    ]);
  });

  it('arms a per-request timeout that destroys a hung stream', async () => {
    await createApnsSender(CONFIG).send([message()]);

    const stream = streams[0];
    expect(stream.setTimeout).toHaveBeenCalledWith(
      10_000,
      expect.any(Function)
    );
    stream.setTimeout.mock.calls[0][1]();
    expect(stream.destroy).toHaveBeenCalledWith(expect.any(Error));
  });
});
