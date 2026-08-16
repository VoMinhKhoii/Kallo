// ---------------------------------------------------------------------------
// Server HTTP edge — turn a thrown value into a Next `NextResponse`.
//
// Server-only by construction: it imports `next/server`. Client code that
// needs to read the resulting envelope uses `@/lib/errors/client` instead.
// ---------------------------------------------------------------------------

import { NextResponse } from 'next/server';
import { isAppError, RateLimitedError } from '@/lib/errors/app-error';
import { Errors } from '@/lib/errors/catalog';

/**
 * Serialize any thrown value into a NextResponse JSON payload.
 * - AppError → structured JSON with correct status
 * - Unknown  → generic 500
 */
export function serializeError(e: unknown): NextResponse {
  if (isAppError(e)) {
    return NextResponse.json(e.toJSON(), {
      status: e.status,
      // A 429 without `Retry-After` tells the client to back off but not for how
      // long, so it guesses — and a client that guesses low re-enters the limit
      // immediately. Carried on the error rather than added by each route so a
      // throttle stays correct wherever it is thrown from, including a Server
      // Action that never touches a Response.
      ...(e instanceof RateLimitedError && e.retryAfterSeconds != null
        ? { headers: { 'Retry-After': String(e.retryAfterSeconds) } }
        : {}),
    });
  }
  const fallback = Errors.internal(e);
  return NextResponse.json(fallback.toJSON(), { status: fallback.status });
}
