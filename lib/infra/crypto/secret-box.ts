// ---------------------------------------------------------------------------
// Secret box — AES-256-GCM for credentials we must hold at rest
// ---------------------------------------------------------------------------
// For the few third-party credentials the server has to keep (today: the Sign
// in with Apple refresh token, needed to revoke it when the account is
// deleted). A database read or dump alone must not yield a usable token, so
// the value is sealed under a key that lives only in the runtime environment.
//
// Output is `v1:<iv>:<ciphertext>:<tag>` (base64url). The version prefix is
// what makes a key or algorithm rotation an explicit migration — a `v2` reader
// can tell old rows apart instead of failing every open. `aad` binds the
// ciphertext to its context (e.g. the owning user id), so a sealed value
// copied onto another row does not open there.

import 'server-only';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

const VERSION = 'v1';
const IV_BYTES = 12;
const KEY_BYTES = 32;

// Unit tests must be able to seal without a real key; every other environment
// fails loudly without one (the same stance as the rate-limit pepper).
const TEST_KEY = Buffer.alloc(KEY_BYTES, 0x5a);

function resolveKey(envName: string): Buffer {
  const raw = process.env[envName];
  if (raw) {
    const key = Buffer.from(raw, 'base64');
    if (key.length !== KEY_BYTES) {
      throw new Error(`${envName} must be ${KEY_BYTES} bytes, base64-encoded`);
    }
    return key;
  }
  if (process.env.NODE_ENV === 'test') return TEST_KEY;
  throw new Error(`${envName} is required`);
}

function encode(buffer: Buffer): string {
  return buffer.toString('base64url');
}

export interface SecretBox {
  /** Whether a key is available — lets a caller skip work it cannot seal. */
  isConfigured(): boolean;
  seal(plaintext: string, aad: string): string;
  /** Throws on a wrong key, a tampered value, a wrong `aad` or a bad shape. */
  open(sealed: string, aad: string): string;
}

/** A box keyed by `envName`. The key is read per call, never cached. */
export function secretBox(envName: string): SecretBox {
  return {
    isConfigured() {
      return Boolean(process.env[envName]) || process.env.NODE_ENV === 'test';
    },
    seal(plaintext, aad) {
      const iv = randomBytes(IV_BYTES);
      const cipher = createCipheriv('aes-256-gcm', resolveKey(envName), iv);
      cipher.setAAD(Buffer.from(aad, 'utf8'));
      const ciphertext = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
      ]);
      return [
        VERSION,
        encode(iv),
        encode(ciphertext),
        encode(cipher.getAuthTag()),
      ].join(':');
    },
    open(sealed, aad) {
      const parts = sealed.split(':');
      if (parts.length !== 4 || parts[0] !== VERSION) {
        throw new Error('secret_box_unsupported_format');
      }
      const [, iv, ciphertext, tag] = parts.map((part) =>
        Buffer.from(part, 'base64url')
      );
      if (iv.length !== IV_BYTES || tag.length !== 16) {
        throw new Error('secret_box_unsupported_format');
      }
      const decipher = createDecipheriv('aes-256-gcm', resolveKey(envName), iv);
      decipher.setAAD(Buffer.from(aad, 'utf8'));
      decipher.setAuthTag(tag);
      return Buffer.concat([
        decipher.update(ciphertext),
        decipher.final(),
      ]).toString('utf8');
    },
  };
}
