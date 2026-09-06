import { describe, expect, it } from 'vitest';
import { targetKeyFromBody } from '@/app/api/supabase-proxy/_lib/auth-target';

describe('targetKeyFromBody', () => {
  it('normalises and canonicalises the address', () => {
    // Plus-addressing collapses on a known-alias domain (Gmail); case and
    // surrounding whitespace are always folded.
    expect(targetKeyFromBody({ email: '  Victim+Tag@GMail.COM ' })).toBe(
      'victim@gmail.com'
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
