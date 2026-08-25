import { Errors } from '@/lib/core/errors/catalog';
import { serializeError } from '@/lib/core/errors/serialize';

/**
 * JSON 404 for any `/api/*` path that no route handler owns.
 *
 * Without this, an unmatched API path falls through to Next's HTML 404 — so a
 * client that mistyped an endpoint, or an agent probing the surface, gets a
 * page of markup where every other response on `/api` is JSON. It cannot parse
 * that, and the status is the only signal it gets.
 *
 * A root-level catch-all is the lowest-priority match in the App Router
 * (static > dynamic > catch-all), so this cannot shadow a real route. The
 * exception is a *deeper* path under one that exists — `/api/v1/meals/x/y` —
 * which lands here and is correct: there is no handler for it either.
 *
 * The envelope is the one every `/api/v1` route already returns
 * (`lib/core/errors/app-error.ts`), so a client needs no second parser.
 */
export const dynamic = 'force-dynamic';

function notFound(request: Request) {
  const { pathname } = new URL(request.url);
  return serializeError(
    Errors.notFound(
      `No API endpoint at ${pathname}. The published surface is described at /openapi.json.`
    )
  );
}

export const GET = notFound;
export const POST = notFound;
export const PUT = notFound;
export const PATCH = notFound;
export const DELETE = notFound;
export const HEAD = notFound;
export const OPTIONS = notFound;
