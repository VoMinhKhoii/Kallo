import { createHash } from 'node:crypto';

/**
 * A `fetch` for the server's Supabase clients that sends one session refresh
 * per refresh token, however many requests ask for it at once.
 *
 * A browser tab that comes back after its hour-long access token expired
 * fires a dozen API calls together, each carrying the same expired cookie.
 * Each server request used to refresh that session on its own: 11 refreshes
 * of one token on 2026-11-18, which Supabase Auth on the free box answered one
 * after another, so every call in the burst waited about 1.2 s.
 *
 * Concurrent refreshes of the same token now share one call, and a successful
 * answer is reused for `REUSE_MS` (Supabase Auth's own reuse window for a
 * refresh token), so a request that started just before the browser saw the
 * new cookies gets the same session instead of another round trip. The key is
 * a hash of the request body, which holds the refresh token itself: only a
 * holder of that token can receive its result. Failures are never reused.
 * Every other request passes straight through.
 */

export const REUSE_MS = 10_000;

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

function requestUrl(input: Parameters<typeof fetch>[0]): string {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.href;
  return input.url;
}

function parseRefreshUrl(input: Parameters<typeof fetch>[0]): URL | null {
  try {
    const url = input instanceof URL ? input : new URL(requestUrl(input));
    if (
      url.pathname.endsWith('/token') &&
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
  if (headers instanceof Headers) return headers.get('apikey') ?? '';
  if (Array.isArray(headers)) {
    const match = headers.find(([name]) => name.toLowerCase() === 'apikey');
    return match?.[1] ?? '';
  }
  for (const [name, value] of Object.entries(headers)) {
    if (name.toLowerCase() === 'apikey') return value ?? '';
  }
  return '';
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

function toResponse(answer: SharedAnswer): Response {
  return new Response(answer.body, {
    status: answer.status,
    statusText: answer.statusText,
    headers: answer.headers,
  });
}

export const sharedRefreshFetch: typeof fetch = async (input, init) => {
  if (init?.method?.toUpperCase() !== 'POST') return fetch(input, init);
  const url = parseRefreshUrl(input);
  const bodyText = url ? readBodyText(init.body) : null;
  if (!url || bodyText === null) return fetch(input, init);

  const key = createHash('sha256')
    .update(
      `${url.origin}\0${readApiKey(init.headers)}\0${canonicalRefreshToken(bodyText)}`
    )
    .digest('hex');
  const all = entries();
  const now = Date.now();
  const existing = all.get(key);
  if (
    existing &&
    (existing.reuseUntil === undefined || existing.reuseUntil > now)
  ) {
    return toResponse(await existing.answer);
  }

  const entry: Entry = {
    answer: fetch(input, init).then(async (response) => ({
      status: response.status,
      statusText: response.statusText,
      headers: [...response.headers.entries()],
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
  return toResponse(await entry.answer);
};
