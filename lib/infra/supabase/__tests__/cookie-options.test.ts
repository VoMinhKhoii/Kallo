import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  EXPECTED_HSTS_MAX_AGE_SECONDS,
  isSecureCookieContext,
  SESSION_COOKIE_MAX_AGE_SECONDS,
  sessionCookieOptions,
  sessionCookieWriteOptions,
} from '@/lib/infra/supabase/cookie-options';

vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');

const SUPABASE_DEFAULT_MAX_AGE = 400 * 24 * 60 * 60;

afterEach(() => {
  vi.unstubAllGlobals();
  vi.stubEnv('NODE_ENV', 'test');
});

function stubProtocol(protocol: 'http:' | 'https:') {
  vi.stubGlobal('location', { ...window.location, protocol });
}

describe('session cookie lifetime (KALLO-06)', () => {
  it('never outlives the HSTS policy, so it cannot be sent over plain HTTP after HSTS lapses', () => {
    expect(SESSION_COOKIE_MAX_AGE_SECONDS).toBeLessThanOrEqual(
      EXPECTED_HSTS_MAX_AGE_SECONDS
    );
  });

  it('documents the 180-day Cloudflare HSTS setting', () => {
    expect(EXPECTED_HSTS_MAX_AGE_SECONDS).toBe(15_552_000);
  });
});

describe('isSecureCookieContext', () => {
  it('is always Secure in production, even if the page reports http', () => {
    vi.stubEnv('NODE_ENV', 'production');
    stubProtocol('http:');
    expect(isSecureCookieContext()).toBe(true);
  });

  it('is Secure on an https page outside production', () => {
    vi.stubEnv('NODE_ENV', 'development');
    stubProtocol('https:');
    expect(isSecureCookieContext()).toBe(true);
  });

  it('drops Secure only on a plain-http page in development', () => {
    vi.stubEnv('NODE_ENV', 'development');
    stubProtocol('http:');
    expect(isSecureCookieContext()).toBe(false);
  });
});

describe('sessionCookieOptions', () => {
  it('pins the name, path, SameSite, Secure and lifetime', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(sessionCookieOptions()).toEqual({
      name: 'sb-project-auth-token',
      path: '/',
      sameSite: 'lax',
      secure: true,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });
});

describe('sessionCookieWriteOptions', () => {
  it("replaces @supabase/ssr's forced 400-day maxAge with ours", () => {
    vi.stubEnv('NODE_ENV', 'production');
    const written = sessionCookieWriteOptions({
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      maxAge: SUPABASE_DEFAULT_MAX_AGE,
    });
    expect(written).toEqual({
      path: '/',
      sameSite: 'lax',
      httpOnly: false,
      secure: true,
      maxAge: SESSION_COOKIE_MAX_AGE_SECONDS,
    });
  });

  it('keeps deletions as deletions', () => {
    expect(sessionCookieWriteOptions({ maxAge: 0 }).maxAge).toBe(0);
  });

  it('never lets the name leak into Set-Cookie options', () => {
    expect(sessionCookieWriteOptions(undefined)).not.toHaveProperty('name');
  });
});
