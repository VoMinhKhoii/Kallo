import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function build(nonce: string, isDev: boolean, reportOnly = false) {
  // Re-import per call so the module reads the current env each time.
  const { buildCsp } = await import('./csp');
  return buildCsp(nonce, isDev, reportOnly);
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

  it('lets the Paddle checkout iframe and RevenueCat API through', async () => {
    const csp = await build('n', false);
    // Assert per directive, not against the whole header: an origin that
    // drifted from connect-src into frame-src (or the reverse) would still
    // satisfy a bare `toContain` while breaking checkout or the API call.
    const directive = (name: string) =>
      (csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '')
        .split(' ')
        .slice(1);

    expect(directive('frame-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://*.paddle.com',
        'https://pay.rev.cat',
      ])
    );
    expect(directive('connect-src')).toEqual(
      expect.arrayContaining([
        'https://api.revenuecat.com',
        'https://*.paddle.com',
      ])
    );
    expect(directive('frame-src')).not.toContain('https://api.revenuecat.com');
  });

  it('keeps host allowlists out of script-src, which strict-dynamic ignores', async () => {
    const csp = await build('n', false);
    const scriptSrc = csp
      .split('; ')
      .find((directive) => directive.startsWith('script-src'));
    expect(scriptSrc).not.toContain('paddle.com');
    expect(scriptSrc).not.toContain('rev.cat');
    expect(scriptSrc).not.toContain('accounts.google.com');
  });

  it('lets Google Identity Services frame and call back for web sign-in', async () => {
    // Without these, enforcing the policy would silently break the ID-token
    // flow and drop web Google sign-in back to the Supabase-branded redirect.
    const csp = await build('n', false);
    const directive = (name: string) =>
      (csp.split('; ').find((d) => d.startsWith(`${name} `)) ?? '')
        .split(' ')
        .slice(1);

    expect(directive('frame-src')).toContain('https://accounts.google.com');
    expect(directive('connect-src')).toContain('https://accounts.google.com');
    // Avatars on the personalized button come from a different Google host.
    expect(directive('img-src')).toContain('https://*.googleusercontent.com');
  });

  it('locks down framing, base-uri, objects, and form-action', async () => {
    const csp = await build('n', false);
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    expect(csp).toContain("form-action 'self'");
    expect(csp).toContain('upgrade-insecure-requests');
  });

  // The directive is defined to be ignored in a report-only policy, and Chrome
  // logs a console error for it on every page load. It must be absent while the
  // rollout is report-only, and present the moment the header enforces.
  it('omits upgrade-insecure-requests only while report-only', async () => {
    const reportOnly = await build('n', false, true);
    expect(reportOnly).not.toContain('upgrade-insecure-requests');
    // Everything else the directive sits next to is unaffected.
    expect(reportOnly).toContain("frame-ancestors 'none'");
    expect(reportOnly).toContain("default-src 'self'");

    const enforced = await build('n', false, false);
    expect(enforced).toContain('upgrade-insecure-requests');
  });

  it('degrades gracefully when the Supabase URL is unset', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    const csp = await build('n', false);
    // No crash, connect-src still self-scoped.
    expect(csp).toContain("connect-src 'self'");
    expect(csp).not.toContain('undefined');
  });
});
