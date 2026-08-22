import { afterEach, describe, expect, it } from 'vitest';
import { googleWebClientId } from '@/lib/infra/auth/google-client-id';

const ORIGINAL = process.env.GOOGLE_WEB_CLIENT_ID;

afterEach(() => {
  // Assigning `undefined` to process.env coerces to the string "undefined";
  // delete to truly restore an originally-unset var.
  if (ORIGINAL === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
  else process.env.GOOGLE_WEB_CLIENT_ID = ORIGINAL;
});

describe('googleWebClientId', () => {
  it('returns the configured client ID', () => {
    process.env.GOOGLE_WEB_CLIENT_ID = 'client-123.apps.googleusercontent.com';

    expect(googleWebClientId()).toBe('client-123.apps.googleusercontent.com');
  });

  it('trims surrounding whitespace', () => {
    // A GitHub Actions variable with a stray space reaches Cloud Run intact.
    process.env.GOOGLE_WEB_CLIENT_ID = '  client-123  ';

    expect(googleWebClientId()).toBe('client-123');
  });

  it.each([
    ['unset', undefined],
    ['empty', ''],
    ['whitespace-only', '   '],
  ])('reads a %s value as unconfigured', (_label, value) => {
    // All three must mean "use the redirect fallback". A blank ID handed to GIS
    // fails inside Google's script and surfaces as a misleading origin error.
    if (value === undefined) delete process.env.GOOGLE_WEB_CLIENT_ID;
    else process.env.GOOGLE_WEB_CLIENT_ID = value;

    expect(googleWebClientId()).toBeNull();
  });
});
