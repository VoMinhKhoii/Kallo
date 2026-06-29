import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function build(nonce: string, isDev: boolean) {
  // Re-import per call so the module reads the current env each time.
  const { buildCsp } = await import('./csp');
  return buildCsp(nonce, isDev);
}

describe('buildCsp', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  });
  afterEach(() => {
    // Assigning `undefined` to process.env coerces to the string "undefined";
    // delete to truly restore an originally-unset var.
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL;
  });

  it('binds scripts to the request nonce + strict-dynamic, never unsafe-inline', async () => {
    const csp = await build('test-nonce', false);
    expect(csp).toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic'"
    );
    // The whole point: scripts must not fall back to unsafe-inline.
    expect(csp).not.toContain(
      "script-src 'self' 'nonce-test-nonce' 'strict-dynamic' 'unsafe-inline'"
    );
  });

  it("adds 'unsafe-eval' only in dev (HMR), never in prod", async () => {
    expect(await build('n', true)).toContain("'unsafe-eval'");
    expect(await build('n', false)).not.toContain("'unsafe-eval'");
  });

  it('allows Supabase over https + wss in connect-src', async () => {
    const csp = await build('n', false);
    expect(csp).toContain('connect-src');
    expect(csp).toContain('https://abc.supabase.co');
    expect(csp).toContain('wss://abc.supabase.co');
  });

  it('locks down framing, base-uri, objects, and form-action', async () => {
    const csp = await build('n', false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  it('degrades gracefully when the Supabase URL is unset', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    const csp = await build('n', false);
    // No crash, connect-src still self-scoped.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('undefined');
  });
});
