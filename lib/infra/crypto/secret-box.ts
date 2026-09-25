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
const TAG_BYTES = 16;
const KEY_BYTES = 32;

// Unit tests must be able to seal without a real key; every other environment
// needs a real one (the same stance as the rate-limit pepper).
const TEST_KEY = Buffer.alloc(KEY_BYTES, 0x5a);

/**
 * The 32-byte key held (base64) in `envName`, or `null` when it is unset or
 * malformed. Validated eagerly so a caller can refuse work it could not seal
 * — e.g. before spending a single-use Apple authorization code.
 */
export function resolveSecretBoxKey(envName: string): Buffer | null {
  const raw = process.env[envName];
  if (!raw) return process.env.NODE_ENV === 'test' ? TEST_KEY : null;
  const key = Buffer.from(raw, 'base64');
  // Buffer.from skips invalid characters silently; the round trip catches a
  // value that only decodes to 32 bytes by accident.
  if (key.length !== KEY_BYTES || key.toString('base64') !== raw.trim()) {
    console.error(`${envName} must be ${KEY_BYTES} bytes, base64-encoded`);
    return null;
  }
  return key;
}

export function seal(key: Buffer, plaintext: string, aad: string): string {
  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from(aad, 'utf8'));
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const encoded = [iv, ciphertext, cipher.getAuthTag()].map((part) =>
    part.toString('base64url')
  );
  return [VERSION, ...encoded].join(':');
}

/** Throws on a wrong key, a tampered value, a wrong `aad` or a bad shape. */
export function open(key: Buffer, sealed: string, aad: string): string {
  const parts = sealed.split(':');
  if (parts.length !== 4 || parts[0] !== VERSION) {
    throw new Error('secret_box_unsupported_format');
  }
  const [iv, ciphertext, tag] = parts
    .slice(1)
    .map((part) => Buffer.from(part, 'base64url'));
  if (iv.length !== IV_BYTES || tag.length !== TAG_BYTES) {
    throw new Error('secret_box_unsupported_format');
  }
  const decipher = createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAAD(Buffer.from(aad, 'utf8'));
  decipher.setAuthTag(tag);
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString('utf8');
}
