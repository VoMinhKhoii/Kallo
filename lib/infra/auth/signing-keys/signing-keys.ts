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
 * Nothing here is ever awaited by a request. The keys load at boot (see
 * `instrumentation.ts`) and refresh in the background once they are older than
 * `REFRESH_AFTER_MS`; a request takes whatever is held right now. With nothing
 * held yet (the first moments after a start, or the Auth server down), auth-js
 * fetches the keys itself, exactly as it always did — so a signed-out visitor
 * on a public page never waits on a key load. A token signed by a key missing
 * from the held set (a rotation newer than the last refresh) is not rejected
 * either: auth-js does not find its `kid` in the keys we pass and fetches.
 */

interface SigningKeys {
  keys: JWK[];
}

/** Background refresh after this long, so a rotation is picked up quickly. */
export const REFRESH_AFTER_MS = 10 * 60 * 1000;
/** After a failed load, wait this long before trying again. */
export const RETRY_AFTER_FAILURE_MS = 30 * 1000;
/** A key fetch slower than this is abandoned. */
export const FETCH_TIMEOUT_MS = 3000;

interface KeyState {
  held?: { value: SigningKeys; loadedAt: number };
  loading?: Promise<void>;
  failedAt?: number;
}

/**
 * One state per process, not per module copy. Next bundles `instrumentation.ts`
 * apart from the route handlers, so each gets its own copy of this module: kept
 * in module variables, the boot preload filled a copy no route ever read, and
 * the first request after a deploy still fetched the keys (seen in Sentry on
 * revision 00368).
 */
const STATE_KEY = Symbol.for('kallo.auth.signingKeys');
function keyState(): KeyState {
  const store = globalThis as typeof globalThis & { [STATE_KEY]?: KeyState };
  store[STATE_KEY] ??= {};
  return store[STATE_KEY];
}

async function fetchKeys(): Promise<SigningKeys | undefined> {
  const url = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/.well-known/jwks.json`;
  const response = await fetch(url, {
    headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '' },
    signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`JWKS fetch failed: ${response.status}`);
  const body = (await response.json()) as Partial<SigningKeys>;
  if (!Array.isArray(body.keys) || body.keys.length === 0) {
    throw new Error('JWKS fetch returned no keys');
  }
  return { keys: body.keys };
}

/** Starts one background load, unless one is running or just failed. */
function startLoad(now: number): Promise<void> {
  const state = keyState();
  if (state.loading) return state.loading;
  if (
    state.failedAt !== undefined &&
    now - state.failedAt < RETRY_AFTER_FAILURE_MS
  ) {
    return Promise.resolve();
  }
  state.loading = fetchKeys()
    .then((value) => {
      if (value) state.held = { value, loadedAt: now };
      state.failedAt = undefined;
    })
    .catch((error: unknown) => {
      // Keep whatever is held: a failed refresh never drops good keys.
      state.failedAt = now;
      console.warn('[auth] signing key fetch failed', error);
    })
    .finally(() => {
      state.loading = undefined;
    });
  return state.loading;
}

/**
 * The signing keys held right now, to hand `getClaims`, or undefined when none
 * are (auth-js then fetches them itself). Never waits: a missing or stale set
 * is loaded in the background for the requests after this one.
 */
export function signingKeys(now: number = Date.now()): SigningKeys | undefined {
  const { held } = keyState();
  if (!held || now - held.loadedAt > REFRESH_AFTER_MS) void startLoad(now);
  return held?.value;
}

/** Loads the keys at server boot, without holding up the start. */
export function preloadSigningKeys(now: number = Date.now()): Promise<void> {
  return startLoad(now);
}

/** Test seam: forget everything. */
export function resetSigningKeysForTests(): void {
  const state = keyState();
  state.held = undefined;
  state.loading = undefined;
  state.failedAt = undefined;
}
