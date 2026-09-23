import { describe, expect, it } from 'vitest';

/**
 * The enforced CSP lives in `next.config.ts` `headers()` — the one place that
 * also covers prerendered shells and every path the proxy matcher skips. Pin
 * that it is there, on every path, and that it is the enforcing header.
 */

async function globalHeaders() {
  const { default: config } = await import('@/next.config');
  const rules = (await config.headers?.()) ?? [];
  const rule = rules.find((r) => r.source === '/(.*)');
  return Object.fromEntries(
    (rule?.headers ?? []).map(({ key, value }) => [key.toLowerCase(), value])
  );
}

describe('next.config headers()', () => {
  it('sends an ENFORCED Content-Security-Policy on every path', async () => {
    const headers = await globalHeaders();

    expect(headers['content-security-policy']).toContain(
      "frame-ancestors 'none'"
    );
    expect(headers['content-security-policy']).toContain(
      "script-src 'self' 'unsafe-inline'"
    );
    expect(headers).not.toHaveProperty('content-security-policy-report-only');
  });

  it('declares the reporting endpoint the policy reports to', async () => {
    const headers = await globalHeaders();

    expect(headers['reporting-endpoints']).toBe(
      'csp-endpoint="/api/csp-report"'
    );
    expect(headers['content-security-policy']).toContain(
      'report-to csp-endpoint'
    );
  });

  it('keeps the rest of the security headers beside it', async () => {
    const headers = await globalHeaders();

    expect(headers['x-frame-options']).toBe('DENY');
    expect(headers['x-content-type-options']).toBe('nosniff');
  });
});
