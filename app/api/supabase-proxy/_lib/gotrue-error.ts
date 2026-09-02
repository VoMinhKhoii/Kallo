/**
 * Errors this proxy generates ITSELF, spoken in GoTrue's dialect.
 *
 * The clients on the other side of this route are supabase-js and
 * supabase-flutter. Neither knows it is talking to a proxy: it points its
 * `SUPABASE_URL` here, and everything it gets back is fed to gotrue's error
 * handler. Answering a rate-limited signup with our own
 * `{error:{code:'RATE_LIMITED', …}}` envelope would surface in both apps as
 * the generic "something went wrong" line, because that is what an
 * unrecognised body produces — the users would see the wrong copy for the one
 * failure we most want them to understand.
 *
 * The shape below is GoTrue's own (`{code, error_code, msg}`, api version
 * 2024-01-01 onward), verified against `@supabase/auth-js`'s `handleError`:
 *
 *  - the error CODE is read from `data.code` when the response carries an
 *    `X-Supabase-Api-Version` of 2024-01-01 or later AND that field is a
 *    STRING, otherwise from `data.error_code`. GoTrue puts the numeric HTTP
 *    status in `code`, so real responses always resolve through `error_code` —
 *    and so do these, whether or not a version header is present.
 *  - the MESSAGE is read from `msg`, then `message`, then `error_description`,
 *    then `error`.
 *
 * `over_request_rate_limit` is the code the FLUTTER client maps to its
 * localized "too many attempts" copy
 * (`apps/mobile-flutter/lib/features/auth/providers/auth_form_controller.dart`
 * — it also falls back on `statusCode == '429'`). The web forms did not: they
 * showed "Invalid email or password" / "Could not create account" for a
 * throttled request until `components/auth/sign-{in,up}-form.tsx` grew the
 * same branch. Speaking this dialect is what makes both of those possible;
 * it does not by itself make the copy correct on either client.
 */

interface GoTrueErrorInput {
  status: number;
  /** GoTrue's string error code, e.g. `over_request_rate_limit`. */
  errorCode: string;
  message: string;
  /** Seconds to wait. Emitted as `Retry-After` when present. */
  retryAfterSeconds?: number;
}

export function gotrueErrorResponse({
  status,
  errorCode,
  message,
  retryAfterSeconds,
}: GoTrueErrorInput): Response {
  const headers = new Headers({ 'content-type': 'application/json' });
  if (retryAfterSeconds != null) {
    headers.set('retry-after', String(retryAfterSeconds));
  }

  return new Response(
    // `code` is the numeric status, exactly as GoTrue emits it.
    JSON.stringify({ code: status, error_code: errorCode, msg: message }),
    { status, headers }
  );
}

/** 429: our own limiter refused the request before it reached Supabase. */
export function rateLimitedResponse(retryAfterSeconds?: number): Response {
  return gotrueErrorResponse({
    status: 429,
    errorCode: 'over_request_rate_limit',
    message: 'Request rate limit reached',
    retryAfterSeconds,
  });
}

/**
 * 503: back off, but DO NOT sign out.
 *
 * Two callers. The first is a fail-closed limiter outage (no auth policy is
 * `closed` today, so that arm is a guard against a future one silently leaking
 * our own envelope into an auth client). The second is a deliberate refusal of
 * a token REFRESH: 503 is in auth-js's `NETWORK_ERROR_CODES`, so `handleError`
 * raises `AuthRetryableFetchError` and the client retries later with the
 * session intact, where a 429 would have destroyed it.
 *
 * That short-circuit happens BEFORE the response body is read, so on this path
 * supabase-js never sees `error_code` or `msg` at all — the status is the whole
 * message. The body is still shaped correctly for the readers that do parse it
 * (supabase-flutter's `AuthException`, our own tests, a human with curl).
 */
export function limiterUnavailableResponse(
  retryAfterSeconds?: number
): Response {
  return gotrueErrorResponse({
    status: 503,
    errorCode: 'service_unavailable',
    message: 'Authentication is temporarily unavailable',
    retryAfterSeconds,
  });
}

/**
 * 400: the request cannot be keyed, so it is not forwarded.
 *
 * `validation_failed` is GoTrue's own code for a body it will not act on, and
 * that is exactly what this is: a mail-sending or password-grant request that
 * named no recipient, or a refresh whose body carries no usable token. Refusing
 * locally keeps traffic we could not put a name to off the single upstream
 * bucket every proxied user shares.
 */
export function validationFailedResponse(message: string): Response {
  return gotrueErrorResponse({
    status: 400,
    errorCode: 'validation_failed',
    message,
  });
}

/** 413: the body blew the proxy's cap before anything was forwarded. */
export function payloadTooLargeResponse(): Response {
  return gotrueErrorResponse({
    status: 413,
    errorCode: 'payload_too_large',
    message: 'Request body is too large',
  });
}
