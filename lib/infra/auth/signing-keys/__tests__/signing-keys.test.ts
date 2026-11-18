import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  REFRESH_AFTER_MS,
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
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('signingKeys', () => {
  it('loads the project keys once and reuses them', async () => {
    fetchMock.mockResolvedValue(jwksResponse([KEY_A]));

    expect(await signingKeys(0)).toEqual({ keys: [KEY_A] });
    expect(await signingKeys(1000)).toEqual({ keys: [KEY_A] });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(
      'https://ref.supabase.co/auth/v1/.well-known/jwks.json'
    );
  });

  it('shares one fetch between callers that arrive before it answers', async () => {
    let answer!: (response: Response) => void;
    fetchMock.mockReturnValue(
      new Promise<Response>((resolve) => {
        answer = resolve;
      })
    );

    const calls = [signingKeys(0), signingKeys(0), signingKeys(0)];
    answer(jwksResponse([KEY_A]));

    expect(await Promise.all(calls)).toEqual([
      { keys: [KEY_A] },
      { keys: [KEY_A] },
      { keys: [KEY_A] },
    ]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('refreshes stale keys in the background while serving the old ones', async () => {
    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    await signingKeys(0);

    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A, KEY_B]));
    // Past the refresh age: answers at once with what it has...
    expect(await signingKeys(REFRESH_AFTER_MS + 1)).toEqual({ keys: [KEY_A] });
    // ...and the refresh it started lands for the next caller.
    await vi.waitFor(async () => {
      expect(await signingKeys(REFRESH_AFTER_MS + 2)).toEqual({
        keys: [KEY_A, KEY_B],
      });
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('keeps the keys it has when a refresh fails', async () => {
    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    await signingKeys(0);
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});

    fetchMock.mockRejectedValueOnce(new TypeError('fetch failed'));
    await signingKeys(REFRESH_AFTER_MS + 1);
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledTimes(2));

    expect(await signingKeys(REFRESH_AFTER_MS + 2)).toEqual({ keys: [KEY_A] });
    quiet.mockRestore();
  });

  it('returns nothing when the first load fails, so auth-js fetches itself', async () => {
    const quiet = vi.spyOn(console, 'warn').mockImplementation(() => {});
    fetchMock.mockResolvedValueOnce(new Response('down', { status: 503 }));

    expect(await signingKeys(0)).toBeUndefined();

    fetchMock.mockResolvedValueOnce(jwksResponse([KEY_A]));
    expect(await signingKeys(1)).toEqual({ keys: [KEY_A] });
    quiet.mockRestore();
  });
});
