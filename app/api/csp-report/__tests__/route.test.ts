import type { NextRequest } from 'next/server';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const assertRateLimit = vi.fn(async (..._args: unknown[]) => undefined);
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  assertRateLimit: (...args: unknown[]) => assertRateLimit(...args),
}));

const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

const { POST } = await import('@/app/api/csp-report/route');

function makeRequest(
  body: string,
  contentType = 'application/csp-report',
  headers: Record<string, string> = { 'x-forwarded-for': '203.0.113.4' }
): NextRequest {
  return new Request('http://localhost/api/csp-report', {
    method: 'POST',
    headers: { 'content-type': contentType, ...headers },
    body,
  }) as unknown as NextRequest;
}

const legacyReport = JSON.stringify({
  'csp-report': {
    'document-uri': 'https://kallo.fit/en/waitlist/confirm?token=tok_secret',
    'blocked-uri': 'https://evil.example/x?leak=tok_secret',
    'effective-directive': 'connect-src',
    disposition: 'enforce',
  },
});

beforeEach(() => {
  assertRateLimit.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
});
afterEach(() => {
  warn.mockClear();
});

describe('POST /api/csp-report', () => {
  it('accepts a legacy report, logs it sanitized, and answers 204', async () => {
    const res = await POST(makeRequest(legacyReport));

    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(warn).toHaveBeenCalledTimes(1);
    const line = String(warn.mock.calls[0][1]);
    expect(JSON.parse(line)).toEqual({
      disposition: 'enforce',
      directive: 'connect-src',
      document: 'https://kallo.fit/en/waitlist/confirm',
      blocked: 'https://evil.example/:param',
    });
    // The query strings — where tokens live — never reach the log.
    expect(line).not.toContain('tok_secret');
  });

  // A CSP violation on an invite page must not log the invite slug — it is
  // the credential that accepts the invite (Codex review on #382).
  it('logs the route template, never an invite slug from the path', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify({
          'csp-report': {
            'document-uri': 'https://kallo.fit/en/invite/inv_Zq81sLkP',
            'source-file': 'https://kallo.fit/en/invite/inv_Zq81sLkP',
            'blocked-uri': 'inline',
            'effective-directive': 'script-src-elem',
            disposition: 'enforce',
          },
        })
      )
    );

    expect(res.status).toBe(204);
    const line = String(warn.mock.calls[0][1]);
    expect(line).not.toContain('inv_Zq81sLkP');
    expect(JSON.parse(line).document).toBe(
      'https://kallo.fit/en/invite/:param'
    );
  });

  it('accepts a Reporting API batch', async () => {
    const res = await POST(
      makeRequest(
        JSON.stringify([
          {
            type: 'csp-violation',
            body: {
              documentURL: 'https://kallo.fit/en?x=1',
              blockedURL: 'eval',
              effectiveDirective: 'script-src',
              disposition: 'enforce',
            },
          },
        ]),
        'application/reports+json'
      )
    );

    expect(res.status).toBe(204);
    expect(warn).toHaveBeenCalledWith('[csp-report]', expect.any(String));
  });

  it('charges the per-IP policy before reading the body', async () => {
    await POST(makeRequest(legacyReport));
    expect(assertRateLimit).toHaveBeenCalledWith('cspReportIp', {
      kind: 'ip',
      value: '203.0.113.4',
    });
  });

  it('answers 429 once the IP is over its limit, logging nothing', async () => {
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 30));

    const res = await POST(makeRequest(legacyReport));

    expect(res.status).toBe(429);
    expect(warn).not.toHaveBeenCalled();
  });

  it('skips the IP policy when there is no usable client IP', async () => {
    const res = await POST(makeRequest(legacyReport, undefined, {}));
    expect(res.status).toBe(204);
    expect(assertRateLimit).not.toHaveBeenCalled();
  });

  it('refuses a body over the byte cap with 413', async () => {
    const res = await POST(makeRequest('x'.repeat(33 * 1024)));
    expect(res.status).toBe(413);
    expect(warn).not.toHaveBeenCalled();
  });

  it('refuses an unknown content type with 415', async () => {
    const res = await POST(makeRequest(legacyReport, 'application/json'));
    expect(res.status).toBe(415);
  });

  it('answers 400 to malformed JSON and to a body that fails the schema', async () => {
    expect((await POST(makeRequest('{not json'))).status).toBe(400);
    expect(
      (await POST(makeRequest(JSON.stringify({ 'csp-report': {} })))).status
    ).toBe(400);
    expect(warn).not.toHaveBeenCalled();
  });
});
