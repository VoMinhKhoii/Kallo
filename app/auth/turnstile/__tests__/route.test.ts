import type { NextRequest } from 'next/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { GET } from '../route';

function get(query = '') {
  const url = new URL(`https://kallo.fit/auth/turnstile${query}`);
  return GET({ nextUrl: url } as unknown as NextRequest);
}

/** The config object the page's inline script was rendered with. */
async function config(res: Response) {
  const html = await res.text();
  const match = html.match(/var config = (\{.*?\});/);
  return JSON.parse(match?.[1] ?? '{}');
}

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('GET /auth/turnstile (the iOS widget page)', () => {
  it('renders the widget with the runtime site key and the requested language', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', 'site-key');

    const res = get('?lang=vi&theme=dark');

    expect(res.headers.get('content-type')).toContain('text/html');
    expect(res.headers.get('cache-control')).toBe('no-store');
    expect(await config(res)).toEqual({
      sitekey: 'site-key',
      action: 'auth-email',
      language: 'vi',
      theme: 'dark',
    });
  });

  it('falls back to English and the system theme for anything unexpected', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', 'site-key');

    const body = await config(get('?lang=fr&theme=%3Cscript%3E'));

    expect(body.language).toBe('en');
    expect(body.theme).toBe('auto');
  });

  it('tells the app to send without a token when no site key is configured', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '');

    const res = get();
    const html = await res.clone().text();

    expect((await config(res)).sitekey).toBeNull();
    expect(html).toContain("post({ type: 'disabled' })");
  });

  it('cannot be broken out of its inline script by the site key', async () => {
    vi.stubEnv('TURNSTILE_SITE_KEY', '</script><script>alert(1)</script>');

    const html = await get().text();

    expect(html).not.toContain('</script><script>alert(1)');
    expect(html).toContain('\\u003c/script>');
  });
});
