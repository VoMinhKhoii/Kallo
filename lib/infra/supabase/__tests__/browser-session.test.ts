// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  BROWSER_SESSION_EXPIRY_MARGIN_MS,
  ensureFreshBrowserSession,
  needsBrowserSessionRefresh,
  resetBrowserSessionRefreshForTests,
} from '@/lib/infra/supabase/browser-session';

const getSessionMock = vi.fn();

vi.mock('@/lib/infra/supabase/client', () => ({
  createClient: () => ({
    auth: {
      getSession: () => getSessionMock(),
    },
  }),
}));

const COOKIE_NAME = 'sb-projref-auth-token';

function encodeSessionCookie(session: Record<string, unknown>): string {
  const b64 = Buffer.from(JSON.stringify(session), 'utf8').toString(
    'base64url'
  );
  return `base64-${b64}`;
}

function clearCookies() {
  for (const part of document.cookie.split(';')) {
    const name = part.split('=')[0]?.trim();
    if (name) {
      document.cookie = `${name}=; path=/; max-age=0`;
    }
  }
}

beforeEach(() => {
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://projref.supabase.co');
  resetBrowserSessionRefreshForTests();
  getSessionMock.mockReset();
  clearCookies();
});

afterEach(() => {
  clearCookies();
  vi.unstubAllEnvs();
});

describe('needsBrowserSessionRefresh / ensureFreshBrowserSession', () => {
  it('skips refresh when no session cookie exists', async () => {
    expect(needsBrowserSessionRefresh()).toBe(false);
    await ensureFreshBrowserSession();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('skips refresh when the session cookie is still fresh', async () => {
    const freshExp = Math.floor(Date.now() / 1000) + 1800;
    document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
      access_token: 'jwt-fresh',
      refresh_token: 'rt-1',
      expires_at: freshExp,
    })}; path=/`;

    expect(needsBrowserSessionRefresh()).toBe(false);
    await ensureFreshBrowserSession();
    expect(getSessionMock).not.toHaveBeenCalled();
  });

  it('triggers refresh when inside the 90 s expiry margin', () => {
    const now = Date.now();
    const withinMargin = Math.floor(
      (now + BROWSER_SESSION_EXPIRY_MARGIN_MS - 5_000) / 1000
    );
    document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
      access_token: 'jwt-expiring',
      refresh_token: 'rt-1',
      expires_at: withinMargin,
    })}; path=/`;

    expect(needsBrowserSessionRefresh(now)).toBe(true);
  });

  it('coalesces a 7-call expired wake-up burst into one browser refresh', async () => {
    const expired = Math.floor(Date.now() / 1000) - 300;
    document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
      access_token: 'jwt-old',
      refresh_token: 'rt-old',
      expires_at: expired,
    })}; path=/`;

    let resolveSession!: () => void;
    getSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = () => {
            document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
              access_token: 'jwt-new',
              refresh_token: 'rt-new',
              expires_at: Math.floor(Date.now() / 1000) + 3600,
            })}; path=/`;
            resolve({ data: { session: null }, error: null });
          };
        })
    );

    const waiters = Array.from({ length: 7 }, () =>
      ensureFreshBrowserSession()
    );
    expect(getSessionMock).toHaveBeenCalledTimes(1);

    resolveSession();
    await Promise.all(waiters);

    // Next call sees the refreshed cookie synchronously and skips getSession.
    expect(needsBrowserSessionRefresh()).toBe(false);
    await ensureFreshBrowserSession();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('decodes chunked .0 / .1 session cookies', async () => {
    const encoded = encodeSessionCookie({
      access_token: 'a'.repeat(400),
      refresh_token: 'rt-chunked',
      expires_at: Math.floor(Date.now() / 1000) - 10,
    });
    const mid = Math.floor(encoded.length / 2);
    document.cookie = `${COOKIE_NAME}.0=${encoded.slice(0, mid)}; path=/`;
    document.cookie = `${COOKIE_NAME}.1=${encoded.slice(mid)}; path=/`;

    expect(needsBrowserSessionRefresh()).toBe(true);
    getSessionMock.mockResolvedValue({ data: { session: null }, error: null });
    await ensureFreshBrowserSession();
    expect(getSessionMock).toHaveBeenCalledTimes(1);
  });

  it('unblocks an aborted caller without cancelling the shared refresh', async () => {
    document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
      access_token: 'jwt-old',
      refresh_token: 'rt-abort',
      expires_at: Math.floor(Date.now() / 1000) - 10,
    })}; path=/`;

    let resolveSession!: () => void;
    getSessionMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveSession = () =>
            resolve({ data: { session: null }, error: null });
        })
    );

    const controller = new AbortController();
    let otherDone = false;
    const abortedWait = ensureFreshBrowserSession(controller.signal);
    const otherWait = ensureFreshBrowserSession().then(() => {
      otherDone = true;
    });

    controller.abort();
    await abortedWait;
    expect(otherDone).toBe(false);

    resolveSession();
    await otherWait;
    expect(otherDone).toBe(true);
  });

  it('swallows refresh errors so callers fall through to normal fetch handling', async () => {
    document.cookie = `${COOKIE_NAME}=${encodeSessionCookie({
      access_token: 'jwt-old',
      refresh_token: 'rt-fail',
      expires_at: Math.floor(Date.now() / 1000) - 10,
    })}; path=/`;
    getSessionMock.mockRejectedValue(new Error('network down'));

    await expect(ensureFreshBrowserSession()).resolves.toBeUndefined();
  });
});
