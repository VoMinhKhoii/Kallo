import { openApiDocument } from '@/lib/api/openapi/document';

/**
 * `/openapi.json` — the machine-readable description of the HTTP API.
 *
 * A fixed root path, like `/llms.txt` and `/robots.txt`: it is what an agent
 * guesses first, and `/en/openapi.json` is not a thing. `middleware.ts` lists
 * `/openapi.json` in `SKIP_INTL_PREFIXES` so next-intl does not rewrite it into
 * a locale that has no such route.
 *
 * Static: the document is assembled from source at build time and has no
 * per-request input.
 */
export const dynamic = 'force-static';

export function GET(): Response {
  return new Response(JSON.stringify(openApiDocument(), null, 2), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=0, must-revalidate',
      // CORS: a spec nobody can fetch from a browser-based agent is a spec
      // nobody uses. Read-only, public, and the same document for everyone.
      'Access-Control-Allow-Origin': '*',
    },
  });
}
