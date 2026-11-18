import { afterEach, describe, expect, it, vi } from 'vitest';

const { connection } = vi.hoisted(() => ({
  connection: vi.fn(async () => {}),
}));
vi.mock('next/server', () => ({ connection }));

import { GET } from '@/app/api/v1/auth/client-config/route';

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /api/v1/auth/client-config', () => {
  it('returns the two public sign-in values, trimmed', async () => {
    vi.stubEnv(
      'GOOGLE_WEB_CLIENT_ID',
      ' client-id.apps.googleusercontent.com '
    );
    vi.stubEnv('TURNSTILE_SITE_KEY', '0x4AAA');

    const res = await GET();

    expect(await res.json()).toEqual({
      googleClientId: 'client-id.apps.googleusercontent.com',
      turnstileSiteKey: '0x4AAA',
    });
    expect(res.headers.get('cache-control')).toBe('public, max-age=300');
    // Read per request: a prerendered answer would carry the build's (empty) env.
    expect(connection).toHaveBeenCalled();
  });

  it('reports unset values as null', async () => {
    vi.stubEnv('GOOGLE_WEB_CLIENT_ID', '');
    vi.stubEnv('TURNSTILE_SITE_KEY', '  ');

    expect(await (await GET()).json()).toEqual({
      googleClientId: null,
      turnstileSiteKey: null,
    });
  });
});
