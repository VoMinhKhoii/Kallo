import {
  AuthApiError,
  AuthInvalidJwtError,
  AuthRetryableFetchError,
  createClient,
} from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockSigningKeys } = vi.hoisted(() => ({
  mockSigningKeys: vi.fn(),
}));
vi.mock('@/lib/infra/auth/signing-keys/signing-keys', () => ({
  signingKeys: mockSigningKeys,
}));

import { verifyUser } from '@/lib/infra/auth/verified-user';
import { createFakeDb } from '@/lib/infra/db/__fixtures__/fake-db';

// What used to be a round trip to the Auth server on every request: the token
// is checked locally, then one query confirms its session is still live.

const getClaims = vi.fn();
const signOut = vi.fn();
const supabase = { auth: { getClaims, signOut } } as unknown as Parameters<
  typeof verifyUser
>[0];

const liveRow = {
  id: 'u1',
  email: 'a@b.com',
  raw_user_meta_data: { avatar_url: 'https://x/a.png' },
  created_at: new Date('2026-01-01T00:00:00Z'),
  last_sign_in_at: '2026-10-27T00:00:00Z',
};

function token(claims: Record<string, unknown>) {
  getClaims.mockResolvedValue({ data: { claims }, error: null });
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('verifyUser', () => {
  it('returns the user behind a valid token with a live session', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);

    expect(await verifyUser(supabase, fake.db)).toEqual({
      id: 'u1',
      email: 'a@b.com',
      userMetadata: { avatar_url: 'https://x/a.png' },
      createdAt: '2026-01-01T00:00:00.000Z',
      lastSignInAt: '2026-10-27T00:00:00.000Z',
    });
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('shares one session query between concurrent checks of the same session', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);

    const users = await Promise.all([
      verifyUser(supabase, fake.db),
      verifyUser(supabase, fake.db),
      verifyUser(supabase, fake.db),
    ]);

    expect(users.map((user) => user?.id)).toEqual(['u1', 'u1', 'u1']);
    expect(fake.execute).toHaveBeenCalledTimes(1);
  });

  it('shares across separately bundled db objects over the same client', async () => {
    // Each bundled copy of db/client.ts exports its own `db` proxy; they share
    // one postgres client, which is what the lookups are keyed by.
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);
    const client = {};
    const copyA = Object.assign(Object.create(fake.db), { $client: client });
    const copyB = Object.assign(Object.create(fake.db), { $client: client });

    const [a, b] = await Promise.all([
      verifyUser(supabase, copyA),
      verifyUser(supabase, copyB),
    ]);

    expect([a?.id, b?.id]).toEqual(['u1', 'u1']);
    expect(fake.execute).toHaveBeenCalledTimes(1);
  });

  it('asks again on the next request, so a revoked session ends at once', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);
    fake.queueExecute([]);

    expect(await verifyUser(supabase, fake.db)).not.toBeNull();
    expect(await verifyUser(supabase, fake.db)).toBeNull();
    expect(fake.execute).toHaveBeenCalledTimes(2);
  });

  it('keeps different sessions apart', async () => {
    getClaims
      .mockResolvedValueOnce({
        data: { claims: { sub: 'u1', session_id: 's1' } },
        error: null,
      })
      .mockResolvedValueOnce({
        data: { claims: { sub: 'u1', session_id: 's2' } },
        error: null,
      });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);
    fake.queueExecute([]);

    const [a, b] = await Promise.all([
      verifyUser(supabase, fake.db),
      verifyUser(supabase, fake.db),
    ]);

    expect(a?.id).toBe('u1');
    expect(b).toBeNull();
    expect(fake.execute).toHaveBeenCalledTimes(2);
  });

  it('shares a failed lookup as a failure, never as a sign-out', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.execute.mockRejectedValueOnce(new Error('connection terminated'));

    const results = await Promise.allSettled([
      verifyUser(supabase, fake.db),
      verifyUser(supabase, fake.db),
    ]);

    expect(results.map((r) => r.status)).toEqual(['rejected', 'rejected']);
    expect(fake.execute).toHaveBeenCalledTimes(1);
    expect(signOut).not.toHaveBeenCalled();
  });

  it('checks the Bearer token it is given', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);

    await verifyUser(supabase, fake.db, 'jwt-from-header');
    expect(getClaims).toHaveBeenCalledWith('jwt-from-header', undefined);
  });

  it('checks the token against the held signing keys, not a fetch per request', async () => {
    const jwks = { keys: [{ kty: 'EC', kid: 'k1', key_ops: ['verify'] }] };
    mockSigningKeys.mockReturnValueOnce(jwks);
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([liveRow]);

    await verifyUser(supabase, fake.db, 'jwt-from-header');
    expect(getClaims).toHaveBeenCalledWith('jwt-from-header', { jwks });
  });

  it('signs out a token whose session was revoked', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.queueExecute([]);

    expect(await verifyUser(supabase, fake.db)).toBeNull();
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('is signed out with no session at all, without querying', async () => {
    getClaims.mockResolvedValue({ data: null, error: null });
    const fake = createFakeDb();

    expect(await verifyUser(supabase, fake.db)).toBeNull();
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it('is signed out for a token without a session id', async () => {
    token({ sub: 'u1' });
    const fake = createFakeDb();

    expect(await verifyUser(supabase, fake.db)).toBeNull();
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it.each([
    new AuthInvalidJwtError('Invalid JWT signature'),
    new AuthApiError('gone', 400, 'refresh_token_not_found'),
  ])('is signed out on $name', async (error) => {
    getClaims.mockResolvedValue({ data: null, error });
    expect(await verifyUser(supabase, createFakeDb().db)).toBeNull();
  });

  it.each([
    new AuthRetryableFetchError('fetch failed', 0),
    new AuthApiError('unavailable', 503, undefined),
  ])('throws on an outage ($name), never reporting a sign-out', async (error) => {
    getClaims.mockResolvedValue({ data: null, error });
    await expect(verifyUser(supabase, createFakeDb().db)).rejects.toBe(error);
  });

  // The real auth-js client, its network stubbed. `eA.eA.eA` makes the decoder
  // throw a SyntaxError and an `alg` that is not a string a TypeError (Codex);
  // both fall back to the Auth server, which rejects them.
  const b64 = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  const future = Math.floor(Date.now() / 1000) + 3600;

  function realClient(fetchImpl: typeof fetch) {
    return createClient('https://example.supabase.co', 'key', {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { fetch: fetchImpl },
    }) as unknown as Parameters<typeof verifyUser>[0];
  }

  const rejectsToken = vi.fn(
    async () =>
      new Response(
        JSON.stringify({ code: 403, error_code: 'bad_jwt', msg: 'bad JWT' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
  );

  it.each([
    'eA.eA.eA',
    'bnVsbA.bnVsbA.eA',
    'a!b.c.d',
    'bad',
    `${b64({ alg: 7 })}.${b64({ sub: 'u1', exp: future })}.c2ln`,
  ])('is signed out for the malformed Bearer token %s', async (bad) => {
    const fake = createFakeDb();

    expect(
      await verifyUser(realClient(rejectsToken as typeof fetch), fake.db, bad)
    ).toBeNull();
    expect(fake.execute).not.toHaveBeenCalled();
  });

  it('throws when the Auth server cannot be reached for an undecodable token', async () => {
    const offline = vi.fn(async () => {
      throw new TypeError('fetch failed');
    });
    await expect(
      verifyUser(
        realClient(offline as unknown as typeof fetch),
        createFakeDb().db,
        'eA.eA.eA'
      )
    ).rejects.toThrow();
  });

  it('drops a cookie session whose token the decoder throws on', async () => {
    getClaims.mockRejectedValue(new SyntaxError('JSON Parse error'));
    const getUser = vi.fn().mockResolvedValue({
      data: { user: null },
      error: new AuthApiError('bad jwt', 403, 'bad_jwt'),
    });
    const cookieClient = {
      auth: { getClaims, getUser, signOut },
    } as unknown as Parameters<typeof verifyUser>[0];

    expect(await verifyUser(cookieClient, createFakeDb().db)).toBeNull();
    expect(getUser).toHaveBeenCalledWith(undefined);
    expect(signOut).toHaveBeenCalledWith({ scope: 'local' });
  });

  it('throws when the session query fails', async () => {
    token({ sub: 'u1', session_id: 's1' });
    const fake = createFakeDb();
    fake.execute.mockRejectedValueOnce(new Error('connection terminated'));

    await expect(verifyUser(supabase, fake.db)).rejects.toThrow(
      'connection terminated'
    );
    expect(signOut).not.toHaveBeenCalled();
  });
});
