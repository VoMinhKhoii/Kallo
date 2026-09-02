import { describe, expect, it } from 'vitest';
import {
  canonicalizeRateLimitIp,
  hashRateLimitKey,
  RateLimitKeyError,
} from '../key-hash';

describe('hashRateLimitKey', () => {
  it('stamps the key version so a pepper rotation is explicit', () => {
    expect(hashRateLimitKey({ kind: 'user', value: 'u1' })).toMatch(
      /^v1:[0-9a-f]{64}$/
    );
  });

  it('domain-separates the kinds', () => {
    const value = 'person@example.com';
    const account = hashRateLimitKey({ kind: 'account', value });
    const recipient = hashRateLimitKey({ kind: 'recipient', value });
    const user = hashRateLimitKey({ kind: 'user', value });

    expect(new Set([account, recipient, user]).size).toBe(3);
  });

  it('is stable for the same key', () => {
    expect(hashRateLimitKey({ kind: 'global', value: 'auth' })).toBe(
      hashRateLimitKey({ kind: 'global', value: 'auth' })
    );
  });

  it('aggregates IPv6 addresses that share a /64', () => {
    const left = hashRateLimitKey({
      kind: 'ip',
      value: '2001:db8:1:2:3:4:5:6',
    });
    const right = hashRateLimitKey({
      kind: 'ip',
      value: '2001:0db8:0001:0002:aaaa:bbbb:cccc:dddd',
    });

    expect(left).toBe(right);
  });

  it('keeps different /64 prefixes apart', () => {
    const left = hashRateLimitKey({ kind: 'ip', value: '2001:db8:1:2::1' });
    const right = hashRateLimitKey({ kind: 'ip', value: '2001:db8:1:3::1' });

    expect(left).not.toBe(right);
  });

  it('keeps IPv4 addresses distinct from each other and from IPv6', () => {
    const first = hashRateLimitKey({ kind: 'ip', value: '203.0.113.5' });
    const second = hashRateLimitKey({ kind: 'ip', value: '203.0.113.6' });
    const sixth = hashRateLimitKey({ kind: 'ip', value: '2001:db8:1:2::1' });

    expect(new Set([first, second, sixth]).size).toBe(3);
  });

  it('throws a typed error for an unparseable IP', () => {
    expect(() => hashRateLimitKey({ kind: 'ip', value: 'not-an-ip' })).toThrow(
      RateLimitKeyError
    );
  });

  it('throws a typed error for an empty value', () => {
    expect(() => hashRateLimitKey({ kind: 'user', value: '' })).toThrow(
      RateLimitKeyError
    );
  });
});

describe('canonicalizeRateLimitIp', () => {
  it('collapses an IPv6 address to its /64 prefix', () => {
    expect(canonicalizeRateLimitIp('2001:0DB8:0001:0002:3:4:5:6')).toBe(
      '2001:0db8:0001:0002::/64'
    );
  });

  it('expands :: the same way regardless of where it sits', () => {
    expect(canonicalizeRateLimitIp('2001:db8::1')).toBe(
      '2001:0db8:0000:0000::/64'
    );
    expect(canonicalizeRateLimitIp('::1')).toBe('0000:0000:0000:0000::/64');
  });

  it.each([
    // Every legal spelling of the same IPv4-mapped address. A text pattern
    // matching only the first would aggregate the rest to
    // 0000:0000:0000:0000::/64 — every mapped client in the world sharing one
    // counter, which is the same as no limit at all.
    '::ffff:203.0.113.5',
    '::FFFF:203.0.113.5',
    '::ffff:cb00:7105',
    '0:0:0:0:0:ffff:203.0.113.5',
    '0000:0000:0000:0000:0000:ffff:cb00:7105',
    '[::ffff:203.0.113.5]',
  ])('folds the IPv4-mapped address %s back to its IPv4 form', (spelling) => {
    expect(canonicalizeRateLimitIp(spelling)).toBe('203.0.113.5');
    expect(hashRateLimitKey({ kind: 'ip', value: spelling })).toBe(
      hashRateLimitKey({ kind: 'ip', value: '203.0.113.5' })
    );
  });

  it('treats the SIIT prefix ::ffff:0:0/96 as plain IPv6', () => {
    // ::ffff:0:1.2.3.4 is NOT an IPv4-mapped address — it is the (routable)
    // IPv4-translated block, a different thing that must aggregate normally.
    expect(canonicalizeRateLimitIp('::ffff:0:203.0.113.5')).toBe(
      '0000:0000:0000:0000::/64'
    );
    expect(
      hashRateLimitKey({ kind: 'ip', value: '::ffff:0:203.0.113.5' })
    ).not.toBe(hashRateLimitKey({ kind: 'ip', value: '203.0.113.5' }));
  });

  it('strips brackets and a zone id', () => {
    expect(canonicalizeRateLimitIp('[2001:db8:1:2::1]')).toBe(
      '2001:0db8:0001:0002::/64'
    );
    expect(canonicalizeRateLimitIp('fe80::1%eth0')).toBe(
      'fe80:0000:0000:0000::/64'
    );
  });

  it('passes IPv4 through unchanged', () => {
    expect(canonicalizeRateLimitIp(' 203.0.113.5 ')).toBe('203.0.113.5');
  });

  it('throws on garbage', () => {
    expect(() => canonicalizeRateLimitIp('999.1.1.1')).toThrow(
      RateLimitKeyError
    );
  });
});
