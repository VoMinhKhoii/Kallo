import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  preloadSigningKeys,
  REFRESH_AFTER_MS,
  RETRY_AFTER_FAILURE_MS,
  resetSigningKeysForTests,
  signingKeys,
} from '@/lib/infra/auth/signing-keys/signing-keys';

const KEY_A = { kty: 'EC', kid: 'a', key_ops: ['verify'] };
const KEY_B = { kty: 'EC', kid: 'b', key_ops: ['verify'] };

function jwksResponse(keys: unknown[]) {
  return new Response(JSON.stringify({ keys }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

const fetchMock = vi.fn();

beforeEach(() => {
  resetSigningKeysForTests();
  fetchMock.mockReset();
  vi.stubGlobal('fetch', fetchMock);
  vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://ref.supabase.co');
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('signingKeys', () => {
  it('hands out the keys loaded at boot, without fetching again', async () => {
    fetchMock.mockResolvedValue(jwksResponse([KEY_A]));
    await preloadSigningKeys(0);

    expect(signingKeys(1000)).toEqual({ keys: [KEY_A] });
    expect(signingKeys(2000)).toEqual({ keys: [KEY_A] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://ref.supabase.co/auth/v1/.well-known/jwks.json'
    );
  });

  it('never makes a request wait: with nothing held it answers at once and loads behind', async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );

    // Signed-out page views go through here too, so nothing may block them.
    expect(signingKeys(0)).toBeUndefined();
    expect(signingKeys(0)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    answer(jwksResponse([KEY_A]));
    await vi.waitFor(() => expect(signingKeys(1)).toEqual({ keys: [KEY_A] }));
  });

  it('refreshes stale keys in the background while serving the old ones', async () => {
    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    await preloadSigningKeys(0);

    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A, KEY_B]));
    expect(signingKeys(REFRESH_AFTER_MS + 1)).toEqual({ keys: [KEY_A] });
    await vi.waitFor(() =>
      expect(signingKeys(REFRESH_AFTER_MS + 2)).toEqual({
        keys: [KEY_A, KEY_B],
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the keys it has when a refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    await preloadSigningKeys(0);

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await preloadSigningKeys(REFRESH_AFTER_MS + 1);

    expect(signingKeys(REFRESH_AFTER_MS + 2)).toEqual({ keys: [KEY_A] });
  });

  it('waits before trying again after a failed load, so an outage is not hit per request', async () => {
    fetchMock.mockResolvedValue(new Response('down', { status: 503 }));
    await preloadSigningKeys(0);

    expect(signingKeys(1)).toBeUndefined();
    expect(signingKeys(RETRY_AFTER_FAILURE_MS - 1)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    signingKeys(RETRY_AFTER_FAILURE_MS + 1);
    await vi.waitFor(() =>
      expect(signingKeys(RETRY_AFTER_FAILURE_MS + 2)).toEqual({
        keys: [KEY_A],
      })
    );
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('shares the keys between separately bundled copies of this module', async () => {
    // Next bundles instrumentation.ts apart from the routes: the boot preload
    // runs in one module copy and requests read another.
    fetchMock.mockResolvedValue(jwksResponse([KEY_A]));
    vi.resetModules();
    const bootCopy = await import('@/lib/infra/auth/signing-keys/signing-keys');
    vi.resetModules();
    const routeCopy = await import(
      '@/lib/infra/auth/signing-keys/signing-keys'
    );
    expect(routeCopy).not.toBe(bootCopy);

    await bootCopy.preloadSigningKeys(0);

    expect(routeCopy.signingKeys(1)).toEqual({ keys: [KEY_A] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('treats an empty key set as a failed load', async () => {
    fetchMock.mockResolvedValueOnce(jwksResponse([]));
    await preloadSigningKeys(0);

    expect(signingKeys(1)).toBeUndefined();
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
