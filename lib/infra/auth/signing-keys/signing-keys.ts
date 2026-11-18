import type { JWK } from '@supabase/supabase-js';

/**
 * The project's public token-signing keys (JWKS), held for the life of the
 * process so checking a token never waits on the network.
 *
 * auth-js caches these keys for only ten minutes, and on a miss every request
 * fetches them for itself. At a few users a day nearly every visit arrives
 * after a quiet ten minutes, so a phone opening the app sent about seven
 * fetches at once to the Auth server on the free database box. Sentry traced
 * the fetch in 36 of 48 slow API requests, where it took 73% of the request
 * (p50 145 ms, p95 1.1 s) — the single largest cause of slow reads.
 *
 * Here the keys load once (at boot, see `instrumentation.ts`), every caller
 * shares the one load in flight, and after `REFRESH_AFTER_MS` the next request
 * starts a refresh in the background while still using the keys it has. A
 * token signed by a key missing from this set (a rotation newer than the last
 * refresh) is not rejected here: auth-js does not find its `kid` in the keys we
 * pass and fetches the set itself, exactly as it did before.
 */

interface SigningKeys {
  keys: JWK[];
}

/** Background refresh after this long, so a rotation is picked up quickly. */
export const REFRESH_AFTER_MS = 10 * 60 * 1000;
/** A key fetch slower than this is abandoned; auth-js then fetches itself. */
export const FETCH_TIMEOUT_MS = 3000;

let cached: { value: SigningKeys; loadedAt: number } | undefined;
let loading: Promise<SigningKeys | undefined> | undefined;

async function fetchKeys(): Promise<SigningKeys | undefined> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  const response = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
  const body = (await response.json()) as Partial<SigningKeys>;
  if (!Array.isArray(body.keys) || body.keys.length === 0) return undefined;
  return { keys: body.keys };
}

function load(now: number): Promise<SigningKeys | undefined> {
  loading ??= fetchKeys()
    .then((value) => {
      if (value) cached = { value, loadedAt: now };
      return value ?? cached?.value;
    })
    .catch((error: unknown) => {
      console.warn('[auth] signing key fetch failed', error);
      return cached?.value;
    })
    .finally(() => {
      loading = undefined;
    });
  return loading;
}

/**
 * The signing keys to hand `getClaims`, or undefined when none could be loaded
 * (auth-js then fetches them itself, as it always did).
 */
export async function signingKeys(
  now: number = Date.now()
): Promise<SigningKeys | undefined> {
  if (!cached) return load(now);
  if (now - cached.loadedAt > REFRESH_AFTER_MS) void load(now);
  return cached.value;
}

/** Starts the first load without waiting on it (server boot). */
export function preloadSigningKeys(): void {
  void signingKeys();
}

/** Test seam: forget everything. */
export function resetSigningKeysForTests(): void {
  cached = undefined;
  loading = undefined;
}
