import { describe, expect, it } from 'vitest';
import { canonicalAuthPath } from '@/app/api/supabase-proxy/_lib/canonical-auth-path';

/** Split the way the test helpers model Next's catch-all param. */
const canon = (path: string) => canonicalAuthPath(path.split('/'));

describe('canonicalAuthPath', () => {
  it.each([
    ['auth/v1/token', '/auth/v1/token'],
    ['auth/v1/user', '/auth/v1/user'],
    ['auth/v1/logout', '/auth/v1/logout'],
    ['auth/v1/verify', '/auth/v1/verify'],
    ['auth/v1/authorize', '/auth/v1/authorize'],
    ['auth/v1/otp', '/auth/v1/otp'],
    ['auth/v1/recover', '/auth/v1/recover'],
    ['auth/v1/signup', '/auth/v1/signup'],
    ['auth/v1/settings', '/auth/v1/settings'],
    ['auth/v1/callback', '/auth/v1/callback'],
    ['auth/v1/reauthenticate', '/auth/v1/reauthenticate'],
    ['auth/v1/sso', '/auth/v1/sso'],
    ['auth/v1/.well-known/jwks.json', '/auth/v1/.well-known/jwks.json'],
    [
      'auth/v1/factors/0f8fad5b-d9cb-469f-a165-70867728950e/challenge',
      '/auth/v1/factors/0f8fad5b-d9cb-469f-a165-70867728950e/challenge',
    ],
    [
      'auth/v1/user/identities/0f8fad5b-d9cb-469f-a165-70867728950e',
      '/auth/v1/user/identities/0f8fad5b-d9cb-469f-a165-70867728950e',
    ],
    [
      'auth/v1/passkeys/authentication/options',
      '/auth/v1/passkeys/authentication/options',
    ],
  ])('keeps the real GoTrue path %s', (path, expected) => {
    expect(canon(path)).toBe(expected);
  });

  it.each([
    // The KALLO-11 escape, as Next hands it over after decoding `%252F` once.
    'auth/v1/..%2F..%2Frest/v1/user_profiles',
    'auth/v1/%2e%2e/%2e%2e/rest/v1/user_profiles',
    'auth/v1/%252e%252e/rest',
    'auth/v1/token%00',
    'auth/v1/to%6ben',
    // Dot segments, and runs of dots.
    'auth/v1/../../rest/v1/meals',
    'auth/v1/./token',
    'auth/v1/...',
    // Semicolon path parameters, backslashes.
    'auth/v1/token;/../../rest/v1',
    'auth/v1/token;foo',
    'auth/v1/..\\..\\rest/v1/user_profiles',
    'auth/v1\\token',
    // Case games against the prefix and the block-list.
    'AUTH/V1/token',
    'Auth/v1/token',
    'auth/V1/token',
    'auth/v1/admin/users',
    'auth/v1/ADMIN/users',
    'auth/v1/Admin',
    'auth/v1/invite',
    'auth/v1/INVITE',
    // Structure.
    'auth/v1',
    'auth/v1/',
    'auth/v1//token',
    'auth/v2/token',
    'rest/v1/user_profiles',
    '/auth/v1/token',
    'auth/v1/a/b/c/d/e/f/g/h/i',
    // Control characters and whitespace.
    'auth/v1/token\u0000',
    'auth/v1/tok\nen',
    'auth/v1/token ',
    'auth/v1/tok\ten',
    'auth/v1/tokén',
  ])('refuses %j', (path) => {
    expect(canon(path)).toBeNull();
  });

  it('treats a segment containing a slash as hostile, not as two segments', () => {
    // Next decodes `%2F` inside a segment into a literal `/`.
    expect(canonicalAuthPath(['auth', 'v1', '../../rest', 'v1'])).toBeNull();
    expect(canonicalAuthPath(['auth', 'v1', 'token/extra'])).toBeNull();
  });
});
