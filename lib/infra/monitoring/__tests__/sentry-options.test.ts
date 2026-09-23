import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  clientSentryEnvironment,
  scrubBreadcrumb,
  scrubEvent,
  serverSentryEnvironment,
  sharedSentryOptions,
} from '../sentry-options';

describe('scrubEvent', () => {
  it('strips request payload, cookies, headers and query string', () => {
    const event = scrubEvent({
      request: {
        url: 'https://kallo.fit/api/analyze-meal',
        data: { message: 'phở bò 2 bowls' },
        cookies: { 'sb-auth': 'x' },
        headers: { authorization: 'Bearer y' },
        query_string: 'token=z',
      },
    });
    expect(event.request).toEqual({
      url: 'https://kallo.fit/api/analyze-meal',
    });
  });

  it('reduces the request URL to its route pattern', () => {
    const event = scrubEvent({
      request: { url: 'https://kallo.fit/vi/invite/secret-slug?ref=x' },
    });
    expect(event.request?.url).toBe('https://kallo.fit/invite/[slug]');
  });

  it('keeps only the opaque user id', () => {
    const event = scrubEvent({
      user: { id: 'uuid-1', email: 'a@b.c', ip_address: '1.2.3.4' },
    });
    expect(event.user).toEqual({ id: 'uuid-1' });
  });

  it('empties a user without an id', () => {
    expect(scrubEvent({ user: { email: 'a@b.c' } }).user).toEqual({});
  });
});

describe('scrubBreadcrumb', () => {
  it('patterns navigation paths and strips fetch query strings', () => {
    expect(
      scrubBreadcrumb({
        data: { from: '/en/circle/share-1', to: '/en/circle/g/group-2?tab=x' },
      }).data
    ).toEqual({ from: '/circle/[shareId]', to: '/circle/g/[groupId]' });
    expect(
      scrubBreadcrumb({
        data: { url: 'https://kallo.fit/api/v1/meals?date=2026-09-01' },
      }).data
    ).toEqual({ url: 'https://kallo.fit/api/v1/meals' });
  });
});

describe('sharedSentryOptions', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled without a DSN', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const options = sharedSentryOptions('test');
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
  });

  it('is enabled with a DSN and never sends default PII', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://k@o1.ingest.de.sentry.io/2');
    const options = sharedSentryOptions('test');
    expect(options.enabled).toBe(true);
    expect(options.sendDefaultPii).toBe(false);
  });
});

describe('environment', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('server: SENTRY_ENVIRONMENT wins; a prod build without it is a preview', () => {
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('SENTRY_ENVIRONMENT', '');
    expect(serverSentryEnvironment()).toBe('preview');
    vi.stubEnv('SENTRY_ENVIRONMENT', 'production');
    expect(serverSentryEnvironment()).toBe('production');
  });

  it('client: only the canonical host is production', () => {
    vi.stubEnv('NODE_ENV', 'production');
    expect(clientSentryEnvironment('kallo.fit')).toBe('production');
    expect(clientSentryEnvironment('www.kallo.fit')).toBe('production');
    expect(clientSentryEnvironment('pr-12-abc.a.run.app')).toBe('preview');
    vi.stubEnv('NODE_ENV', 'development');
    expect(clientSentryEnvironment('localhost')).toBe('development');
  });
});
