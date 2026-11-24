import { createServerClient } from '@supabase/ssr';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REUSE_MS,
  resetSharedRefreshesForTests,
  sharedRefreshFetch,
} from '@/lib/infra/supabase/shared-refresh';

const TOKEN_URL =
  'https://ref.supabase.co/auth/v1/token?grant_type=refresh_token';

function refresh(token: string) {
  return sharedRefreshFetch(TOKEN_URL, {
    method: 'POST',
    body: JSON.stringify({ refresh_token: token }),
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetSharedRefreshesForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('sharedRefreshFetch', () => {
  it('sends one refresh for concurrent requests carrying the same token', async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );

    const calls = [refresh('rt-a'), refresh('rt-a'), refresh('rt-a')];
    answer(Response.json({ access_token: 'new' }, { status: 200 }));
    const bodies = await Promise.all(
      (await Promise.all(calls)).map((r) => r.json())
    );

    expect(bodies).toEqual([
      { access_token: 'new' },
      { access_token: 'new' },
      { access_token: 'new' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps different refresh tokens apart', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));

    await Promise.all([refresh('rt-b1'), refresh('rt-b2')]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('reuses a successful answer briefly, then asks again', async () => {
    vi.useFakeTimers({ toFake: ['Date', 'setTimeout'] });
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));

    await refresh('rt-c');
    await refresh('rt-c');
    expect(fetchMock).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(REUSE_MS + 1);
    await refresh('rt-c');
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('never reuses a failed refresh', async () => {
    fetchMock
      .mockResolvedValueOnce(Response.json({ error: 'x' }, { status: 400 }))
      .mockResolvedValueOnce(Response.json({ ok: true }));

    expect((await refresh('rt-d')).status).toBe(400);
    expect((await refresh('rt-d')).status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('passes every other request straight through', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));

    await sharedRefreshFetch('https://ref.supabase.co/auth/v1/user', {
      method: 'GET',
    });
    await sharedRefreshFetch('https://ref.supabase.co/auth/v1/user', {
      method: 'GET',
    });

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('gives concurrent server clients with one expired session a single refresh', async () => {
    // The real @supabase/ssr client, as server.ts builds it: an expired access
    // token in the cookie makes each client refresh on getSession().
    const ref = 'shared';
    const b64 = (v: unknown) =>
      Buffer.from(JSON.stringify(v)).toString('base64url');
    const expired = Math.floor(Date.now() / 1000) - 60;
    const jwt = `${b64({ alg: 'ES256', kid: 'k' })}.${b64({ sub: 'u1', exp: expired, session_id: 's1' })}.c2ln`;
    const session = {
      access_token: jwt,
      refresh_token: 'rt-real',
      expires_at: expired,
      expires_in: -60,
      token_type: 'bearer',
      user: { id: 'u1' },
    };
    const cookie = `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;
    const freshJwt = `${b64({ alg: 'ES256', kid: 'k' })}.${b64({ sub: 'u1', exp: expired + 7200, session_id: 's1' })}.c2ln`;
    fetchMock.mockImplementation(async (input: string) => {
      if (String(input).includes('grant_type=refresh_token')) {
        await new Promise((r) => setTimeout(r, 20));
        return Response.json({
          access_token: freshJwt,
          refresh_token: 'rt-next',
          expires_in: 3600,
          expires_at: expired + 7200,
          token_type: 'bearer',
          user: { id: 'u1' },
        });
      }
      return Response.json({});
    });

    const client = () =>
      createServerClient(`https://${ref}.supabase.co`, 'key', {
        global: { fetch: sharedRefreshFetch },
        cookies: {
          getAll: () => [{ name: `sb-${ref}-auth-token`, value: cookie }],
          setAll: () => {},
        },
      });

    const sessions = await Promise.all(
      Array.from({ length: 5 }, () => client().auth.getSession())
    );

    expect(sessions.map((s) => s.data.session?.refresh_token)).toEqual(
      Array(5).fill('rt-next')
    );
    const refreshes = fetchMock.mock.calls.filter(([url]) =>
      String(url).includes('grant_type=refresh_token')
    );
    expect(refreshes).toHaveLength(1);
  });

  it('shares one refresh between a Uint8Array proxy body and a string server body', async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );

    const proxyBody = new TextEncoder().encode('{ "refresh_token": "rt-u8" }');
    const serverBody = JSON.stringify({ refresh_token: 'rt-u8' });

    const [proxyRes, serverRes] = [
      sharedRefreshFetch(new URL(TOKEN_URL), {
        method: 'POST',
        headers: new Headers({ apikey: 'pk-1' }),
        body: proxyBody,
      }),
      sharedRefreshFetch(TOKEN_URL, {
        method: 'POST',
        headers: { ApiKey: 'pk-1' },
        body: serverBody,
      }),
    ];

    answer(Response.json({ access_token: 'shared-jwt' }, { status: 200 }));
    const bodies = await Promise.all(
      (await Promise.all([proxyRes, serverRes])).map((r) => r.json())
    );

    expect(bodies).toEqual([
      { access_token: 'shared-jwt' },
      { access_token: 'shared-jwt' },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('keeps requests with different apikey headers apart', async () => {
    fetchMock.mockImplementation(async () => Response.json({ ok: true }));

    await Promise.all([
      sharedRefreshFetch(TOKEN_URL, {
        method: 'POST',
        headers: { apikey: 'pk-valid' },
        body: JSON.stringify({ refresh_token: 'rt-key' }),
      }),
      sharedRefreshFetch(TOKEN_URL, {
        method: 'POST',
        headers: { apikey: 'pk-other' },
        body: JSON.stringify({ refresh_token: 'rt-key' }),
      }),
    ]);

    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});
