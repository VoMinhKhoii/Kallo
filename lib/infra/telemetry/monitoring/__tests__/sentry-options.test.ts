import { afterEach, describe, expect, it, vi } from 'vitest';
import { scrubTransaction } from '../scrub';
import {
  clientSentryEnvironment,
  serverSentryEnvironment,
  sharedSentryOptions,
} from '../sentry-options';

describe('sharedSentryOptions', () => {
  afterEach(() => vi.unstubAllEnvs());

  it('is disabled without a DSN', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', '');
    const options = sharedSentryOptions('test');
    expect(options.enabled).toBe(false);
    expect(options.dsn).toBeUndefined();
  });

  it('is enabled with a DSN and never sends default PII', () => {
    vi.stubEnv('NEXT_PUBLIC_SENTRY_DSN', 'https://k@o1.ingest.us.sentry.io/2');
    const options = sharedSentryOptions('test');
    expect(options.enabled).toBe(true);
    expect(options.sendDefaultPii).toBe(false);
    expect(options.beforeSendTransaction).toBe(scrubTransaction);
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
