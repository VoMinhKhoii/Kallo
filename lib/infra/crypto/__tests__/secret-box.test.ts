import { randomBytes } from 'node:crypto';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));

import { secretBox } from '@/lib/infra/crypto/secret-box';

const ENV = 'SECRET_BOX_TEST_KEY';
const box = secretBox(ENV);

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('secretBox', () => {
  it('round-trips under a configured key with a v1 prefix', () => {
    vi.stubEnv(ENV, randomBytes(32).toString('base64'));
    const sealed = box.seal('refresh-token-value', 'user-1');

    expect(sealed).toMatch(/^v1:[\w-]+:[\w-]+:[\w-]+$/);
    expect(sealed).not.toContain('refresh-token-value');
    expect(box.open(sealed, 'user-1')).toBe('refresh-token-value');
  });

  it('uses a fresh IV per seal', () => {
    expect(box.seal('same', 'aad')).not.toBe(box.seal('same', 'aad'));
  });

  it('refuses a tampered ciphertext', () => {
    const [version, iv, ciphertext, tag] = box
      .seal('refresh-token-value', 'user-1')
      .split(':');
    const flipped = Buffer.from(ciphertext, 'base64url');
    flipped[0] ^= 0x01;
    const tampered = [version, iv, flipped.toString('base64url'), tag].join(
      ':'
    );
    expect(() => box.open(tampered, 'user-1')).toThrow();
  });

  it('refuses a value moved to another context (aad)', () => {
    const sealed = box.seal('refresh-token-value', 'user-1');
    expect(() => box.open(sealed, 'user-2')).toThrow();
  });

  it('refuses a value sealed under a different key', () => {
    vi.stubEnv(ENV, randomBytes(32).toString('base64'));
    const sealed = box.seal('refresh-token-value', 'user-1');
    vi.stubEnv(ENV, randomBytes(32).toString('base64'));
    expect(() => box.open(sealed, 'user-1')).toThrow();
  });

  it('refuses an unknown version or shape', () => {
    const sealed = box.seal('x', 'a');
    expect(() => box.open(sealed.replace(/^v1:/, 'v2:'), 'a')).toThrow(
      'secret_box_unsupported_format'
    );
    expect(() => box.open('v1:abc', 'a')).toThrow(
      'secret_box_unsupported_format'
    );
  });

  it('rejects a key that is not 32 bytes', () => {
    vi.stubEnv(ENV, randomBytes(16).toString('base64'));
    expect(() => box.seal('x', 'a')).toThrow(/32 bytes/);
  });

  it('fails loudly outside tests when the key is unset', () => {
    vi.stubEnv(ENV, '');
    vi.stubEnv('NODE_ENV', 'production');
    expect(() => box.seal('x', 'a')).toThrow(`${ENV} is required`);
  });
});
