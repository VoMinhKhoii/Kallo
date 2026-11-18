import { connection } from 'next/server';
import { googleWebClientId } from '@/lib/infra/auth/google-client-id';
import { turnstileSiteKey } from '@/lib/infra/security/turnstile';

/**
 * The sign-in dialog's two public runtime values: the Google web client ID and
 * the Turnstile site key. Both are sent to every browser anyway (the Google
 * button and the Turnstile widget need them); they are runtime env vars only so
 * the Docker image does not bake them in.
 *
 * Static public pages fetch them here after load (`ClientAuthRequestConfig`)
 * instead of reading them during the render. Reading them in the render meant
 * calling `connection()`, which made every calorie, tool and comparison page
 * render per request: 69-169 ms on the server against 19-33 ms for a page with
 * no per-request part (prod, 2026-11-18).
 */
export async function GET(): Promise<Response> {
  // With Cache Components a GET handler that reads no request data is
  // prerendered at build time, and the Docker build has neither env var: it
  // would answer null for both, forever. Read them per request instead.
  await connection();
  return Response.json(
    {
      googleClientId: googleWebClientId(),
      turnstileSiteKey: turnstileSiteKey(),
    },
    // The same for every visitor and changes only with a deploy.
    { headers: { 'Cache-Control': 'public, max-age=300' } }
  );
}
