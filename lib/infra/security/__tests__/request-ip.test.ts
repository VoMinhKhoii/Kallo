import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { getRequestIp } from '../request-ip';

const originalSecret = process.env.ORIGIN_SHARED_SECRET;

function request(headers: Record<string, string>) {
  return new Request('https://kallo.fit/api/v1/waitlist', { headers });
}

afterEach(() => {
  if (originalSecret === undefined) {
    delete process.env.ORIGIN_SHARED_SECRET;
  } else {
    process.env.ORIGIN_SHARED_SECRET = originalSecret;
  }
});

describe('getRequestIp behind Cloudflare (production)', () => {
  beforeEach(() => {
    process.env.ORIGIN_SHARED_SECRET = 'origin-secret';
  });

  it('returns cf-connecting-ip', () => {
    expect(getRequestIp(request({ 'cf-connecting-ip': '203.0.113.7' }))).toBe(
      '203.0.113.7'
    );
  });

  it('ignores a spoofed x-forwarded-for entirely', () => {
    const ip = getRequestIp(
      request({
        'cf-connecting-ip': '203.0.113.7',
        'x-forwarded-for': '10.0.0.1, 198.51.100.1',
        'x-real-ip': '10.0.0.2',
      })
    );

    expect(ip).toBe('203.0.113.7');
  });

  it('returns null when cf-connecting-ip is absent, never falling back', () => {
    // A request without the Cloudflare header did not come through Cloudflare,
    // which is precisely the request whose self-reported IP must not be used.
    const ip = getRequestIp(
      request({
        'x-forwarded-for': '198.51.100.1',
        'x-real-ip': '198.51.100.2',
      })
    );

    expect(ip).toBeNull();
  });

  it('rejects a cf-connecting-ip that is not an IP', () => {
    expect(
      getRequestIp(request({ 'cf-connecting-ip': 'not-an-ip' }))
    ).toBeNull();
  });

  it('normalizes IPv6 casing', () => {
    expect(getRequestIp(request({ 'cf-connecting-ip': '2001:DB8::1' }))).toBe(
      '2001:db8::1'
    );
  });
});

describe('getRequestIp without the origin lock (local, preview)', () => {
  beforeEach(() => {
    delete process.env.ORIGIN_SHARED_SECRET;
  });

  it('takes the first x-forwarded-for entry', () => {
    expect(
      getRequestIp(request({ 'x-forwarded-for': '198.51.100.1, 203.0.113.9' }))
    ).toBe('198.51.100.1');
  });

  it('falls back to x-real-ip', () => {
    expect(getRequestIp(request({ 'x-real-ip': '198.51.100.4' }))).toBe(
      '198.51.100.4'
    );
  });

  it('falls back to x-real-ip when x-forwarded-for is garbage', () => {
    expect(
      getRequestIp(
        request({ 'x-forwarded-for': 'unknown', 'x-real-ip': '198.51.100.4' })
      )
    ).toBe('198.51.100.4');
  });

  it('strips brackets, ports and IPv6 zone ids', () => {
    expect(getRequestIp(request({ 'x-real-ip': '[2001:db8::1]' }))).toBe(
      '2001:db8::1'
    );
    expect(getRequestIp(request({ 'x-real-ip': '[2001:db8::1]:443' }))).toBe(
      '2001:db8::1'
    );
    expect(getRequestIp(request({ 'x-real-ip': '198.51.100.4:5432' }))).toBe(
      '198.51.100.4'
    );
    expect(getRequestIp(request({ 'x-real-ip': 'fe80::1%eth0' }))).toBe(
      'fe80::1'
    );
  });

  it('returns null when no header carries an IP', () => {
    expect(getRequestIp(request({}))).toBeNull();
  });
});
