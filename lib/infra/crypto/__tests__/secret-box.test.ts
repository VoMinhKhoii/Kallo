import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { open, resolveSecretBoxKey, seal } from '@/lib/infra/crypto/secret-box';

const ENV = 'SECRET_BOX_TEST_KEY';
const KEY = randomBytes(32);

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('seal / open', () => {
  it('round-trips with a v1 prefix and never shows the plaintext', () => {
    const sealed = seal(KEY, 'refresh-token-value', 'user-1');

    expect(sealed).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(sealed).not.toContain('refresh-token-value');
    expect(open(KEY, sealed, 'user-1')).toBe('refresh-token-value');
  });

  it('uses a fresh IV per seal', () => {
    expect(seal(KEY, 'same', 'aad')).not.toBe(seal(KEY, 'same', 'aad'));
  });

  it('refuses a tampered ciphertext', () => {
    const [version, iv, ciphertext, tag] = seal(KEY, 'value', 'user-1').split(
      ':'
    );
    const flipped = Buffer.from(ciphertext, 'base64url');
    flipped[0] ^= 0x01;
    const tampered = [version, iv, flipped.toString('base64url'), tag].join(
      ':'
    );
    expect(() => open(KEY, tampered, 'user-1')).toThrow();
  });

  it('refuses a value moved to another context (aad)', () => {
    const sealed = seal(KEY, 'value', 'user-1');
    expect(() => open(KEY, sealed, 'user-2')).toThrow();
  });

  it('refuses a value sealed under a different key', () => {
    const sealed = seal(KEY, 'value', 'user-1');
    expect(() => open(randomBytes(32), sealed, 'user-1')).toThrow();
  });

  it('refuses an unknown version or shape', () => {
    const sealed = seal(KEY, 'x', 'a');
    expect(() => open(KEY, sealed.replace(/^v1:/, 'v2:'), 'a')).toThrow(
      'secret_box_unsupported_format'
    );
    expect(() => open(KEY, 'v1:abc', 'a')).toThrow(
      'secret_box_unsupported_format'
    );
  });
});

describe('resolveSecretBoxKey', () => {
  it('returns a configured 32-byte key', () => {
    vi.stubEnv(ENV, KEY.toString('base64'));
    expect(resolveSecretBoxKey(ENV)?.equals(KEY)).toBe(true);
  });

  it('rejects a key that is not 32 bytes of valid base64', () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    for (const bad of [
      randomBytes(16).toString('base64'),
      'not base64 at all!!',
      `${KEY.toString('base64').slice(0, -4)}!!!!`,
    ]) {
      vi.stubEnv(ENV, bad);
      expect(resolveSecretBoxKey(ENV)).toBeNull();
    }
  });

  it('falls back to a fixed key only under tests', () => {
    vi.stubEnv(ENV, '');
    expect(resolveSecretBoxKey(ENV)).toHaveLength(32);
    vi.stubEnv('NODE_ENV', 'production');
    expect(resolveSecretBoxKey(ENV)).toBeNull();
  });
});
