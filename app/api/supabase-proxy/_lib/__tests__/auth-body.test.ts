import { describe, expect, it } from 'vitest';
import {
  hasValidRefreshToken,
  parseAuthBody,
  readBodyField,
} from '@/app/api/supabase-proxy/_lib/auth-body';

const encode = (text: string) => new TextEncoder().encode(text);

describe('parseAuthBody', () => {
  it('parses JSON', () => {
    expect(parseAuthBody(encode('{"email":"a@b.co"}'))).toEqual({
      email: 'a@b.co',
    });
  });

  it('parses a form-encoded body — GoTrue accepts one, so we must read one', () => {
    expect(parseAuthBody(encode('email=a%40b.co&type=signup'))).toEqual({
      email: 'a@b.co',
      type: 'signup',
    });
  });

  it('never returns an array or a primitive', () => {
    expect(parseAuthBody(encode('[1,2,3]'))).toEqual({ '[1,2,3]': '' });
    expect(parseAuthBody(encode('"just a string"'))).toEqual({
      '"just a string"': '',
    });
  });

  it('returns undefined for an absent or empty body', () => {
    expect(parseAuthBody(undefined)).toBeUndefined();
    expect(parseAuthBody(new Uint8Array(0))).toBeUndefined();
  });

  it('returns undefined for bytes that are not text at all', () => {
    expect(parseAuthBody(new Uint8Array([0xff, 0xfe, 0xfd]))).toBeUndefined();
  });
});

describe('readBodyField', () => {
  // Go's encoding/json binds fields case-insensitively, so every one of these
  // spellings mails the same stranger upstream.
  it.each([
    'email',
    'Email',
    'EMAIL',
    'eMaIl',
  ])('finds the field spelled %s', (key) => {
    expect(readBodyField({ [key]: 'a@b.co' }, 'email')).toBe('a@b.co');
  });

  it('returns undefined for a missing field or an absent body', () => {
    expect(readBodyField({ phone: '1' }, 'email')).toBeUndefined();
    expect(readBodyField(undefined, 'email')).toBeUndefined();
  });

  it('reads own keys only, so an inherited property is never a field', () => {
    const body = Object.create({ email: 'inherited@x.com' }) as Record<
      string,
      unknown
    >;
    expect(readBodyField(body, 'email')).toBeUndefined();
  });
});

describe('hasValidRefreshToken', () => {
  it('accepts the shape supabase-js actually sends', () => {
    expect(hasValidRefreshToken(encode('{"refresh_token":"abc"}'))).toBe(true);
    expect(hasValidRefreshToken(encode('{"Refresh_Token":"abc"}'))).toBe(true);
  });

  it.each([
    ['an absent body', undefined],
    ['an empty body', encode('')],
    ['a body with no token', encode('{}')],
    ['an empty token', encode('{"refresh_token":""}')],
    ['a non-string token', encode('{"refresh_token":{"a":1}}')],
    ['malformed JSON', encode('{')],
    // Form encoding is refused on THIS path on purpose: Go merges a form body
    // into r.Form ahead of the query string, so a form-encoded
    // `grant_type=password` would be a password grant upstream and a cheap
    // memory-bucket refresh to us.
    ['a form-encoded body', encode('refresh_token=abc')],
  ])('refuses %s', (_name, body) => {
    expect(hasValidRefreshToken(body)).toBe(false);
  });

  it('refuses a token longer than any real one', () => {
    const long = JSON.stringify({ refresh_token: 'x'.repeat(2049) });
    expect(hasValidRefreshToken(encode(long))).toBe(false);
  });
});
