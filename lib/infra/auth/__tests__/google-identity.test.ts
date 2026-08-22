import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  createNoncePair,
  loadGoogleIdentity,
  resetGoogleIdentityLoader,
} from '@/lib/infra/auth/google-identity';

/** SHA-256 hex of `value`, computed independently of the helper under test. */
async function sha256Hex(value: string): Promise<string> {
  const digest = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(value)
  );
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function injectedScripts(): HTMLScriptElement[] {
  return Array.from(
    document.querySelectorAll<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    )
  );
}

describe('createNoncePair', () => {
  it('hashes the raw nonce the way Supabase re-hashes it', async () => {
    const { raw, hashed } = await createNoncePair();

    // 32 random bytes, hex-encoded — the same shape the Flutter Apple flow
    // sends, so both clients hash identically.
    expect(raw).toMatch(/^[0-9a-f]{64}$/);
    expect(hashed).toBe(await sha256Hex(raw));
  });

  it('never reuses a nonce across page loads', async () => {
    const [first, second] = await Promise.all([
      createNoncePair(),
      createNoncePair(),
    ]);

    expect(first.raw).not.toBe(second.raw);
  });
});

describe('loadGoogleIdentity', () => {
  beforeEach(() => {
    resetGoogleIdentityLoader();
    for (const script of injectedScripts()) script.remove();
    window.google = undefined;
  });

  afterEach(() => {
    window.google = undefined;
  });

  it('injects the GIS script once and resolves its id namespace', async () => {
    const api = { initialize: vi.fn(), renderButton: vi.fn(), cancel: vi.fn() };

    const first = loadGoogleIdentity();
    const second = loadGoogleIdentity();

    const [script] = injectedScripts();
    expect(injectedScripts()).toHaveLength(1);
    window.google = { accounts: { id: api } };
    script?.onload?.(new Event('load'));

    await expect(first).resolves.toBe(api);
    // The button mounts on several pages; the memo keeps them on one script.
    await expect(second).resolves.toBe(api);
  });

  it('rejects and cleans up when the script loads without accounts.id', async () => {
    // A proxy or captive portal can answer the request with something that
    // isn't GIS. Both failure paths must leave the document clean enough for
    // a later attempt to inject a fresh script.
    const broken = loadGoogleIdentity();
    const [script] = injectedScripts();
    script?.onload?.(new Event('load'));

    await expect(broken).rejects.toThrow(/without accounts\.id/);
    expect(injectedScripts()).toHaveLength(0);
    loadGoogleIdentity();
    expect(injectedScripts()).toHaveLength(1);
  });

  it('drops the memo when the script is blocked so a retry can inject again', async () => {
    const blocked = loadGoogleIdentity();
    const [script] = injectedScripts();
    script?.onerror?.(new Event('error'));

    await expect(blocked).rejects.toThrow(/failed to load/);
    // Ad blockers are the common case here — the caller falls back to the
    // redirect flow, but a later attempt must be able to try again.
    expect(injectedScripts()).toHaveLength(0);
    loadGoogleIdentity();
    expect(injectedScripts()).toHaveLength(1);
  });
});
