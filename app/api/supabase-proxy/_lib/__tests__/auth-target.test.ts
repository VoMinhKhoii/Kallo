import { describe, expect, it } from 'vitest';
import {
  bearerSubjectKey,
  targetKeyFromBody,
} from '@/app/api/supabase-proxy/_lib/auth-target';

function jwt(payload: unknown): string {
  return `header.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.sig`;
}

describe('targetKeyFromBody', () => {
  it('normalises and canonicalises the address', () => {
    expect(targetKeyFromBody({ email: '  Victim+Tag@Example.COM ' })).toBe(
      'victim@example.com'
    );
  });

  it('keeps email and phone in separate namespaces', () => {
    expect(targetKeyFromBody({ phone: '+84 90 000 0000' })).toBe(
      'phone:84900000000'
    );
    expect(targetKeyFromBody({ email: 'a@b.co' })).toBe('a@b.co');
  });

  it('prefers the email when a body carries both', () => {
    expect(targetKeyFromBody({ email: 'a@b.co', phone: '+8490' })).toBe(
      'a@b.co'
    );
  });

  it('caps rather than drops an over-long value', () => {
    const key = targetKeyFromBody({ email: `${'x'.repeat(400)}@example.com` });

    expect(key).not.toBeNull();
    expect(key).toHaveLength(320);
  });

  it.each([
    ['no body', undefined],
    ['neither field', { password: 'x' }],
    ['a non-string email', { email: 12 }],
    ['an object email', { email: { toLowerCase: 'nope' } }],
    ['a blank email', { email: '   ' }],
    ['a phone with no digits', { phone: '+++' }],
  ])('returns null for %s', (_name, body) => {
    expect(targetKeyFromBody(body as Record<string, unknown>)).toBeNull();
  });
});

describe('bearerSubjectKey', () => {
  it('reads the sub claim without verifying the signature', () => {
    expect(
      bearerSubjectKey(`Bearer ${jwt({ sub: 'user-1', role: 'x' })}`)
    ).toBe('user:user-1');
  });

  it('accepts the header in any case', () => {
    expect(bearerSubjectKey(`bearer ${jwt({ sub: 'user-1' })}`)).toBe(
      'user:user-1'
    );
  });

  it.each([
    ['an absent header', null],
    ['a non-bearer scheme', 'Basic abc'],
    ['a token with the wrong segment count', 'Bearer a.b'],
    ['a payload that is not base64url JSON', 'Bearer a.!!!.c'],
    ['a payload with no sub', `Bearer ${jwt({ role: 'authenticated' })}`],
    ['a non-string sub', `Bearer ${jwt({ sub: 42 })}`],
  ])('returns null for %s — the request falls back to IP + global', (_n, h) => {
    expect(bearerSubjectKey(h)).toBeNull();
  });
});
