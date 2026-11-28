import type { NextRequest } from 'next/server';
import { describe, expect, it } from 'vitest';
import {
  authErrorUrl,
  localeFromNext,
  publicUrl,
} from '@/lib/infra/auth/redirects';

const RUN_APP = 'https://kallo-prod-abc123-as.a.run.app';

function request(headers: Record<string, string> = {}): NextRequest {
  return new Request(`${RUN_APP}/auth/verify`, {
    headers,
  }) as unknown as NextRequest;
}

describe('publicUrl', () => {
  it('prefers the forwarded public host', () => {
    const url = publicUrl(
      request({
        'x-forwarded-host': 'kallo.fit',
        'x-forwarded-proto': 'https',
      }),
      '/en/logging',
      RUN_APP
    );
    expect(url.toString()).toBe('https://kallo.fit/en/logging');
  });

  it('keeps a non-Cloud-Run fallback origin (local dev)', () => {
    expect(
      publicUrl(request(), '/en/logging', 'http://localhost:3000').toString()
    ).toBe('http://localhost:3000/en/logging');
  });

  // KALLO-11: Cloudflare rewrites Host to the run.app hostname, so without a
  // forwarded host the fallback origin IS the origin the edge is meant to hide.
  it('never hands out the Cloud Run origin when no forwarded host arrives', () => {
    expect(
      publicUrl(request(), '/en/?error=verify_failed', RUN_APP).toString()
    ).toBe('https://kallo.fit/en/?error=verify_failed');
  });

  it('never hands out a Cloud Run origin named by the forwarded host', () => {
    expect(
      publicUrl(
        request({ 'x-forwarded-host': 'kallo-prod-abc123-as.a.run.app' }),
        '/en/logging',
        RUN_APP
      ).toString()
    ).toBe('https://kallo.fit/en/logging');
  });
});

describe('localeFromNext', () => {
  it('reads the locale a next path starts with', () => {
    expect(localeFromNext('/vi/logging')).toBe('vi');
    expect(localeFromNext('/vi')).toBe('vi');
    expect(localeFromNext('/en/settings?tab=plan')).toBe('en');
  });

  it('falls back to the default locale', () => {
    expect(localeFromNext(null)).toBe('en');
    expect(localeFromNext('/fr/logging')).toBe('en');
    expect(localeFromNext('/video')).toBe('en');
    expect(localeFromNext('/vi?tab=plan')).toBe('en');
  });
});

describe('authErrorUrl', () => {
  it('lands on the locale home with the error code', () => {
    expect(
      authErrorUrl(
        request({ 'x-forwarded-host': 'kallo.fit' }),
        'vi',
        'verify_failed',
        RUN_APP
      ).toString()
    ).toBe('https://kallo.fit/vi/?error=verify_failed');
  });
});
