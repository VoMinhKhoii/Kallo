import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const ORIGINAL = process.env.NEXT_PUBLIC_SUPABASE_URL;

async function build(isDev = false) {
  // Re-import per call so the module reads the current env each time.
  const { buildCsp } = await import('@/lib/infra/security/csp');
  return buildCsp(isDev);
}

/** The source list of one directive, or [] when the directive is absent. */
function directive(csp: string, name: string): string[] {
  const found = csp.split('; ').find((d) => d.split(' ')[0] === name);
  return found ? found.split(' ').slice(1) : [];
}

describe('buildCsp (enforced policy)', () => {
  beforeEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://abc.supabase.co';
  });
  afterEach(() => {
    // Assigning `undefined` to process.env coerces to the string "undefined";
    // delete to truly restore an originally-unset var.
    if (ORIGINAL === undefined) delete process.env.NEXT_PUBLIC_SUPABASE_URL;
    else process.env.NEXT_PUBLIC_SUPABASE_URL = ORIGINAL;
  });

  // Prerendered shells cannot carry a per-request nonce, and with
  // 'strict-dynamic' present 'self' and 'unsafe-inline' are ignored — the
  // policy would refuse every framework chunk. Both must stay out.
  it('carries no nonce and no strict-dynamic, so static shells can run', async () => {
    const scriptSrc = directive(await build(), 'script-src');
    expect(scriptSrc.join(' ')).not.toMatch(/nonce-/);
    expect(scriptSrc).not.toContain("'strict-dynamic'");
    expect(scriptSrc).toEqual(
      expect.arrayContaining(["'self'", "'unsafe-inline'"])
    );
  });

  it('allows scripts only from self plus the two third parties that inject one', async () => {
    const scriptSrc = directive(await build(), 'script-src');
    expect(scriptSrc).toEqual([
      "'self'",
      "'unsafe-inline'",
      'https://accounts.google.com/gsi/client',
      'https://cdn.paddle.com',
    ]);
  });

  it("adds 'unsafe-eval' only in dev, never in prod", async () => {
    expect(directive(await build(true), 'script-src')).toContain(
      "'unsafe-eval'"
    );
    expect(await build(false)).not.toContain("'unsafe-eval'");
  });

  it('allows Supabase over https + wss in connect-src', async () => {
    const connect = directive(await build(), 'connect-src');
    expect(connect).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://abc.supabase.co',
        'wss://abc.supabase.co',
      ])
    );
  });

  it('lets the Paddle checkout iframe and the RevenueCat API through', async () => {
    const csp = await build();
    // Per directive, not against the whole header: an origin that drifted
    // from connect-src into frame-src (or the reverse) would still satisfy a
    // bare `toContain` while breaking checkout or the API call.
    expect(directive(csp, 'frame-src')).toEqual(
      expect.arrayContaining([
        "'self'",
        'https://*.paddle.com',
        'https://pay.rev.cat',
      ])
    );
    expect(directive(csp, 'connect-src')).toEqual(
      expect.arrayContaining([
        'https://api.revenuecat.com',
        'https://e.revenue.cat',
        'https://*.paddle.com',
      ])
    );
    expect(directive(csp, 'frame-src')).not.toContain(
      'https://api.revenuecat.com'
    );
  });

  it('lets Sentry (US) and PostHog (EU) ingest through connect-src only', async () => {
    const csp = await build();
    expect(directive(csp, 'connect-src')).toEqual(
      expect.arrayContaining([
        'https://*.ingest.us.sentry.io',
        'https://eu.i.posthog.com',
        'https://eu-assets.i.posthog.com',
      ])
    );
    expect(csp).not.toContain('us.i.posthog.com');
    expect(directive(csp, 'script-src').join(' ')).not.toContain('posthog');
  });

  it('lets Google Identity Services load, style, frame and call back', async () => {
    // Without these, web Google sign-in silently drops back to the
    // Supabase-branded redirect flow.
    const csp = await build();
    expect(directive(csp, 'script-src')).toContain(
      'https://accounts.google.com/gsi/client'
    );
    expect(directive(csp, 'style-src')).toContain(
      'https://accounts.google.com/gsi/style'
    );
    expect(directive(csp, 'frame-src')).toContain(
      'https://accounts.google.com'
    );
    expect(directive(csp, 'connect-src')).toContain(
      'https://accounts.google.com'
    );
    expect(directive(csp, 'img-src')).toContain(
      'https://*.googleusercontent.com'
    );
  });

  it('never allowlists a whole scheme or a wildcard host for scripts or connections', async () => {
    const csp = await build();
    for (const name of ['script-src', 'connect-src', 'frame-src']) {
      const list = directive(csp, name);
      expect(list).not.toContain('*');
      expect(list).not.toContain('https:');
      expect(list).not.toContain('data:');
    }
  });

  it('locks down framing, base-uri, objects and form-action, and upgrades http', async () => {
    const csp = await build();
    expect(directive(csp, 'frame-ancestors')).toEqual(["'none'"]);
    expect(directive(csp, 'object-src')).toEqual(["'none'"]);
    expect(directive(csp, 'base-uri')).toEqual(["'self'"]);
    expect(directive(csp, 'form-action')).toEqual(["'self'"]);
    expect(csp.split('; ')).toContain('upgrade-insecure-requests');
  });

  it('reports to the same-origin collector through both mechanisms', async () => {
    const csp = await build();
    expect(directive(csp, 'report-uri')).toEqual(['/api/csp-report']);
    expect(directive(csp, 'report-to')).toEqual(['csp-endpoint']);
  });

  it('degrades gracefully when the Supabase URL is unset', async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = '';
    const csp = await build();
    expect(directive(csp, 'connect-src')[0]).toBe("'self'");
    expect(csp).not.toContain('undefined');
  });
});

describe('cspHeaders', () => {
  it('pairs the enforced policy with the Reporting-Endpoints group it names', async () => {
    const { cspHeaders, buildCsp } = await import('@/lib/infra/security/csp');
    const headers = Object.fromEntries(
      cspHeaders(false).map(({ key, value }) => [key, value])
    );

    expect(headers['Content-Security-Policy']).toBe(buildCsp(false));
    expect(headers['Reporting-Endpoints']).toBe(
      'csp-endpoint="/api/csp-report"'
    );
    // Never the report-only header: that was the finding.
    expect(headers).not.toHaveProperty('Content-Security-Policy-Report-Only');
  });
});
