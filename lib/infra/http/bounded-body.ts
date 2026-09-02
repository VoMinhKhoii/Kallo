import { Errors } from '@/lib/core/errors/catalog';

/**
 * Read a request body with a hard byte ceiling.
 *
 * `request.arrayBuffer()` / `request.json()` buffer whatever arrives. On an
 * unauthenticated route that is an out-of-memory lever: one client, one
 * connection, as many bytes as it cares to send. Every handler that reads a
 * body from a stranger goes through here instead.
 *
 * Two checks, because either alone is escapable:
 *
 *  1. **`content-length` prefilter** — refuses an honest oversized upload
 *     before a single byte is read. Cheap, and the only one that can reject
 *     without touching the socket.
 *  2. **Streaming cap** — counts what actually arrives and cancels the reader
 *     the moment the cap is passed, so a LYING or ABSENT `content-length`
 *     (chunked transfer encoding sets none) buys nothing.
 *
 * The cap is on RECEIVED bytes, not on the decoded string: a caller that wants
 * a 64 KB JSON document is protecting its memory, not its parser.
 */

const TOO_LARGE_MESSAGE = 'Request body is too large.';

/**
 * Read at most `maxBytes` of the body. Throws `PayloadTooLargeError` (413) the
 * moment that is exceeded; returns an empty view when there is no body at all.
 */
export async function readBoundedBody(
  request: Request,
  maxBytes: number
): Promise<Uint8Array<ArrayBuffer>> {
  const contentLength = request.headers.get('content-length');
  if (
    contentLength &&
    /^\d+$/.test(contentLength) &&
    Number(contentLength) > maxBytes
  ) {
    throw Errors.payloadTooLarge(TOO_LARGE_MESSAGE);
  }

  if (!request.body) return new Uint8Array(0);

  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maxBytes) {
      await reader.cancel();
      throw Errors.payloadTooLarge(TOO_LARGE_MESSAGE);
    }
    chunks.push(value);
  }

  // Always copied into a fresh buffer rather than returning a single chunk
  // as-is: a stream chunk can be a view onto a larger pooled ArrayBuffer, and
  // handing that to `fetch` would send bytes we never counted.
  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return body;
}

/**
 * `readBoundedBody`, then UTF-8 decode and `JSON.parse`.
 *
 * Returns `unknown` on purpose — the caller validates with its Zod contract.
 * A malformed body throws `SyntaxError`, exactly as `request.json()` does, so
 * swapping this in changes nothing but the ceiling.
 */
export async function readBoundedJson(
  request: Request,
  maxBytes: number
): Promise<unknown> {
  const body = await readBoundedBody(request, maxBytes);
  return JSON.parse(new TextDecoder().decode(body)) as unknown;
}
