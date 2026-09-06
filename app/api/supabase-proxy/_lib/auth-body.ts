import { z } from 'zod';

/**
 * Reading an attacker-controlled auth body the way GoTrue reads it.
 *
 * Everything the classifier decides — who gets mailed, which account is being
 * brute-forced — is read out of a body the caller wrote. So the reader has to
 * match the SERVER that will act on it, not the shape our own clients happen to
 * send. Two mismatches were live bypasses:
 *
 *  - **Case.** GoTrue is Go, and `encoding/json` binds struct fields
 *    case-insensitively: `{"Email":…}` and `{"EMAIL":…}` mail the same
 *    stranger that `{"email":…}` does. An exact-key lookup here returned "no
 *    recipient", so the per-recipient mail-bombing budget was never consumed —
 *    the one control that rotating IPs cannot escape.
 *  - **Encoding.** Go's `r.FormValue` / `ParseForm` also accept
 *    `application/x-www-form-urlencoded`, so the same request re-encoded as
 *    `email=victim%40x.com` reached upstream unkeyed.
 *
 * The `content-type` header is NOT consulted when choosing a parser: it is
 * chosen by the same attacker as the body, so trusting it would just move the
 * bypass one header over. JSON is tried first, form encoding second — being
 * MORE permissive than upstream is safe here, because the only consequence is
 * keying a request GoTrue may then reject anyway.
 *
 * Nothing in this module throws. A body we cannot read is upstream's to
 * reject; all that is lost locally is a key, and the caller decides whether
 * losing it is allowed (see `requiresTarget` in `auth-path-policy.ts`).
 */

/** supabase-js sends ~700 bytes of JWT; 2 KB is generous for one token. */
const refreshToken = z.string().min(1).max(2048);

function decode(body: Uint8Array): string | null {
  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(body);
  } catch {
    return null;
  }
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' &&
      parsed !== null &&
      !Array.isArray(parsed)
      ? (parsed as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/**
 * Best-effort parse of an (already bounded) body into a plain object.
 *
 * Returns `undefined` when there is nothing usable — never throws, and never
 * returns an array or a primitive, so every downstream lookup is a plain
 * property read on an object whose own keys we enumerate ourselves.
 */
export function parseAuthBody(
  body: Uint8Array | undefined
): Record<string, unknown> | undefined {
  if (!body || body.byteLength === 0) return undefined;

  const text = decode(body);
  if (text === null) return undefined;

  const json = parseJsonObject(text);
  if (json) return json;

  // URLSearchParams never throws: garbage becomes one key with an empty value,
  // which no lookup below asks for. Take the FIRST value of each repeated key,
  // not the last: Go's `Request.FormValue` (what GoTrue calls) returns the
  // first, so `email=victim@x.com&email=attacker@x.com` mails `victim` upstream
  // and must key the recipient budget on `victim` too. `Object.fromEntries`
  // (used over a plain `form[key] =` assignment) keeps the same safe
  // own-property construction as the JSON path, so a `__proto__` key stays an
  // own key rather than reaching the prototype setter.
  const seen = new Set<string>();
  const entries: [string, string][] = [];
  for (const [key, value] of new URLSearchParams(text)) {
    if (seen.has(key)) continue;
    seen.add(key);
    entries.push([key, value]);
  }
  return Object.fromEntries(entries);
}

/**
 * A field by name, matched case-insensitively over the body's OWN keys.
 *
 * Own keys only (`Object.keys`), so a `__proto__` payload in the JSON cannot
 * make an inherited property look like a caller-supplied field.
 */
export function readBodyField(
  body: Record<string, unknown> | undefined,
  name: string
): unknown {
  if (!body) return undefined;

  for (const key of Object.keys(body)) {
    if (key.toLowerCase() === name) return body[key];
  }

  return undefined;
}

/**
 * Does this body carry a plausible refresh token?
 *
 * Deliberately strict, and deliberately JSON-only, for two reasons:
 *
 *  1. **Shared egress.** A refusal here never reaches Supabase, so junk aimed
 *     at `?grant_type=refresh_token` cannot burn the one per-IP bucket every
 *     proxied user shares upstream (this service's Cloud Run egress address).
 *  2. **Grant confusion.** Go's `ParseForm` merges the request body into
 *     `r.Form` with the body taking PRECEDENCE over the query string, so a
 *     form-encoded `grant_type=password` body sent to
 *     `?grant_type=refresh_token` would be a password grant upstream and a
 *     cheap memory-bucket `refresh` to us. Requiring the refresh class to be
 *     JSON removes the ambiguity instead of trying to out-guess it.
 */
export function hasValidRefreshToken(body: Uint8Array | undefined): boolean {
  if (!body || body.byteLength === 0) return false;

  const text = decode(body);
  if (text === null) return false;

  const json = parseJsonObject(text);
  if (!json) return false;

  return refreshToken.safeParse(readBodyField(json, 'refresh_token')).success;
}
