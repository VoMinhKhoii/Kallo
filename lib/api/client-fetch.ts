// ---------------------------------------------------------------------------
// Browser edge — the fetch wrapper every `/api/v1/*` client module shares.
// ---------------------------------------------------------------------------
// The counterpart to `handleRouteError` (lib/api/respond.ts): the route handler
// serializes failures into `{ error: { code, status, retryable, message } }`,
// and this reads that envelope back out as an `ApiError`. Client-side only —
// deliberately free of `next/server` and of the server AppError hierarchy.

import { parseApiError } from '@/lib/errors/client';

/**
 * Fetch JSON from an API route. Non-ok responses throw the parsed error
 * envelope; a failure body that is not JSON throws the null-body `ApiError`
 * (`UNKNOWN` / 500 / non-retryable).
 */
export async function request<T>(
  input: string,
  init?: RequestInit
): Promise<T> {
  const response = await fetch(input, init);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw parseApiError(body);
  }
  return response.json() as Promise<T>;
}

/** `request` with a JSON-encoded POST body. */
export function postJson<T>(url: string, body: unknown): Promise<T> {
  return request<T>(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
}
