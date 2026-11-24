import { createHash } from 'node:crypto';

/**
 * A `fetch` for the server's Supabase clients and `/api/supabase-proxy` that
 * sends one session refresh per refresh token, however many requests ask for it
 * at once.
 *
 * A browser tab that comes back after its hour-long access token expired
 * fires a dozen API calls together, each carrying the same expired cookie,
 * while the browser client refreshes through `/api/supabase-proxy`. Concurrent
 * refreshes of the same token now share one upstream call, and a successful
 * answer is reused for `REUSE_MS` (Supabase Auth's own reuse window for a
 * refresh token), so a request that started just before the browser saw the
 * new cookies gets the same session instead of another round trip. The key is
 * a hash of origin + pathname + `apikey` + refresh token, so only a holder of
 * that token and API key can receive its result. Failures are never reused.
 * Every other request passes straight through.
 */

export const REUSE_MS = 10_000;

/** Bound on the shared upstream refresh so a hung GoTrue call cannot poison waiters. */
const UPSTREAM_TIMEOUT_MS = 15_000;

const NULL_BODY_STATUSES = new Set([204, 205, 304]);
const STRIPPED_HEADERS = new Set([
  'content-encoding',
  'content-length',
  'transfer-encoding',
]);

interface SharedAnswer {
  status: number;
  statusText: string;
  headers: [string, string][];
  body: string;
}

interface Entry {
  answer: Promise<SharedAnswer>;
  /** Set once a successful answer arrived; reused until this time. */
  reuseUntil?: number;
}

const STATE_KEY = Symbol.for('kallo.auth.sharedRefreshes');
function entries(): Map<string, Entry> {
  const store = globalThis as typeof globalThis & {
    [STATE_KEY]?: Map<string, Entry>;
  };
  store[STATE_KEY] ??= new Map();
  return store[STATE_KEY];
}

/** Clear the process-wide refresh cache between unit tests. */
export function resetSharedRefreshesForTests(): void {
  entries().clear();
}

function parseRefreshUrl(input: string | URL): URL | null {
  try {
    const url = input instanceof URL ? input : new URL(input);
    if (
      url.pathname === '/auth/v1/token' &&
      url.searchParams.get('grant_type') === 'refresh_token'
    ) {
      return url;
    }
    return null;
  } catch {
    return null;
  }
}

function readBodyText(body: BodyInit | null | undefined): string | null {
  if (typeof body === 'string') return body;
  if (body instanceof Uint8Array) {
    return new TextDecoder().decode(body);
  }
  return null;
}

function readApiKey(headers: HeadersInit | undefined): string {
  if (!headers) return '';
  try {
    return (
      (headers instanceof Headers ? headers : new Headers(headers)).get(
        'apikey'
      ) ?? ''
    );
  } catch {
    return '';
  }
}

function canonicalRefreshToken(bodyText: string): string {
  try {
    const parsed = JSON.parse(bodyText) as { refresh_token?: unknown };
    if (
      parsed &&
      typeof parsed === 'object' &&
      typeof parsed.refresh_token === 'string' &&
      parsed.refresh_token.length > 0
    ) {
      return `rt:${parsed.refresh_token}`;
    }
  } catch {
    // Non-JSON bodies still key on their exact bytes.
  }
  return `raw:${bodyText}`;
}

function abortError(signal: AbortSignal): unknown {
  return (
    signal.reason ??
    new DOMException('The operation was aborted.', 'AbortError')
  );
}

function awaitWithSignal<T>(
  promise: Promise<T>,
  signal: AbortSignal | null | undefined
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(abortError(signal));
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(abortError(signal));
    signal.addEventListener('abort', onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      }
    );
  });
}

function toResponse(answer: SharedAnswer): Response {
  return new Response(
    NULL_BODY_STATUSES.has(answer.status) ? null : answer.body,
    {
      status: answer.status,
      statusText: answer.statusText,
      headers: answer.headers,
    }
  );
}

export const sharedRefreshFetch: typeof fetch = async (input, init) => {
  if (input instanceof Request || init?.method?.toUpperCase() !== 'POST') {
    return fetch(input, init);
  }
  const url = parseRefreshUrl(input);
  const bodyText = url ? readBodyText(init.body) : null;
  if (!url || bodyText === null) return fetch(input, init);

  const callerSignal = init.signal;
  if (callerSignal?.aborted) {
    throw abortError(callerSignal);
  }

  const key = createHash('sha256')
    .update(
      `${url.origin}${url.pathname}\0${readApiKey(init.headers)}\0${canonicalRefreshToken(bodyText)}`
    )
    .digest('hex');
  const all = entries();
  const now = Date.now();
  const existing = all.get(key);
  if (
    existing &&
    (existing.reuseUntil === undefined || existing.reuseUntil > now)
  ) {
    return toResponse(await awaitWithSignal(existing.answer, callerSignal));
  }

  // Detach the leader's AbortSignal so one caller's abort cannot kill sibling
  // waiters, and bound the shared upstream call with a fixed timeout.
  const { signal: _callerSignal, ...upstreamInit } = init;
  const entry: Entry = {
    answer: fetch(input, {
      ...upstreamInit,
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }).then(async (response) => ({
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()].filter(
        ([name]) => !STRIPPED_HEADERS.has(name.toLowerCase())
      ),
      body: await response.text(),
    })),
  };
  all.set(key, entry);
  entry.answer.then(
    (answer) => {
      if (answer.status >= 200 && answer.status < 300) {
        entry.reuseUntil = Date.now() + REUSE_MS;
        setTimeout(() => {
          if (all.get(key) === entry) all.delete(key);
        }, REUSE_MS).unref?.();
      } else if (all.get(key) === entry) {
        all.delete(key);
      }
    },
    () => {
      if (all.get(key) === entry) all.delete(key);
    }
  );
  return toResponse(await awaitWithSignal(entry.answer, callerSignal));
};
