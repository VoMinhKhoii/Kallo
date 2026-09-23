import { z } from 'zod';

/**
 * Turn the catch-all segments Next hands the proxy into the ONE upstream path
 * it may forward, or `null` when the request must be refused.
 *
 * Why segments and not the joined string (KALLO-11): Next has already
 * percent-decoded each segment exactly once. Anything that still looks encoded
 * after that was encoded TWICE by the caller, and a second decoder further down
 * the line will act on it. The pentest's escape was exactly that:
 *
 *   /api/supabase-proxy/auth/v1/..%252F..%252Frest/v1/user_profiles
 *     → Next decodes once   → segment `..%2F..%2Frest`
 *     → `new URL()` keeps `%2F` as data, so the pathname still starts with
 *       `/auth/v1/` and the old prefix check passed
 *     → Supabase's gateway decodes `%2F` to `/`, collapses the `..`, and
 *       routes to PostgREST at `/rest/v1/user_profiles`.
 *
 * Two parsers disagreeing about what a path means (a "parser differential",
 * CWE-22 / CWE-172) cannot be fixed by teaching our side one more decoding
 * trick; the fix is to accept only segments on which every decoder agrees.
 * So each segment must be a plain token from the unreserved URL alphabet — no
 * `%`, `/`, `\`, `;`, whitespace or control bytes can get through — and the
 * upstream path is REBUILT from those validated tokens rather than resolved
 * from whatever string the caller sent.
 *
 * Every GoTrue path that auth-js and gotrue-dart call (`token`, `user`,
 * `factors/<uuid>/verify`, `user/identities/<uuid>`, `.well-known/jwks.json`,
 * …) is made of such tokens, so nothing legitimate is lost.
 */

/** RFC 3986 "unreserved" characters: never decoded differently by anyone. */
const SEGMENT = z
  .string()
  .regex(/^[A-Za-z0-9._~-]+$/)
  // `.` and `..` are dot-segments that URL resolvers collapse; a run of dots
  // is not one, but no GoTrue path is only dots, so refuse the whole family.
  .refine((segment) => !/^\.+$/.test(segment));

/**
 * Upper bound on depth. The deepest real path is 3 segments after `auth/v1`
 * (`factors/<id>/challenge`, `passkeys/authentication/options`); 10 in total
 * (8 after `auth/v1`) leaves room for GoTrue to grow without letting a caller
 * send an arbitrarily deep path.
 */
const Segments = z.array(SEGMENT).min(3).max(10);

/**
 * Admin-only surfaces, refused with the same 404 as anything outside
 * `auth/v1/`. `/admin/*` and `/invite` both require the service key, which no
 * client of this proxy holds — auth-js reaches `/invite` only through
 * `GoTrueAdminApi.inviteUserByEmail`. Forwarding them would mean an anonymous
 * caller gets to ask Supabase to mail an invitation, on a path with no
 * caller-supplied recipient budget behind it.
 *
 * Matched on the exact first segment after `auth/v1`, case-insensitively: the
 * old string-prefix compare let `auth/v1/Admin` through to an upstream router
 * whose case rules we do not control.
 */
const BLOCKED_HEADS = new Set(['admin', 'invite']);

export const AUTH_PATH_PREFIX = '/auth/v1/';

export function canonicalAuthPath(
  rawSegments: readonly string[]
): string | null {
  const parsed = Segments.safeParse(rawSegments);
  if (!parsed.success) return null;

  const [service, version, head, ...rest] = parsed.data;
  // Exact, case-sensitive: GoTrue is mounted at `/auth/v1`, nothing else.
  if (service !== 'auth' || version !== 'v1') return null;
  if (BLOCKED_HEADS.has(head.toLowerCase())) return null;

  // `encodeURIComponent` is the identity on the unreserved alphabet, so this
  // is belt and braces: the path is assembled from validated tokens only, and
  // would stay inert even if the alphabet above were ever widened.
  return `${AUTH_PATH_PREFIX}${[head, ...rest].map(encodeURIComponent).join('/')}`;
}
