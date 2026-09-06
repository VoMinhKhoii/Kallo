import { describe, expect, it } from 'vitest';
import { PayloadTooLargeError } from '@/lib/core/errors/app-error';
import {
  readBoundedBody,
  readBoundedJson,
} from '@/lib/infra/http/bounded-body';

/**
 * The cap has to hold against a body that LIES about its size, which is the
 * only case that matters: an honest `content-length` is refused by any naive
 * check, and chunked transfer encoding sets no length header at all.
 */

/** A request whose stream emits `chunks` and whose headers say `declared`. */
function streamingRequest(chunks: string[], declared?: string): Request {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      for (const chunk of chunks) controller.enqueue(encoder.encode(chunk));
      controller.close();
    },
  });

  return new Request('http://localhost/x', {
    method: 'POST',
    body: stream,
    headers: declared ? { 'content-length': declared } : {},
    // Undici requires this for a streaming body; it is not part of the test.
    duplex: 'half',
  } as RequestInit & { duplex: 'half' });
}

describe('readBoundedBody', () => {
  it('returns a body that is exactly at the cap', async () => {
    const body = 'x'.repeat(64);
    const bytes = await readBoundedBody(streamingRequest([body]), 64);

    expect(new TextDecoder().decode(bytes)).toBe(body);
  });

  it('joins multiple chunks into one buffer', async () => {
    const bytes = await readBoundedBody(
      streamingRequest(['ab', 'cd', 'ef']),
      8
    );

    expect(new TextDecoder().decode(bytes)).toBe('abcdef');
  });

  it('rejects on the content-length header without reading the body', async () => {
    // A stream that never yields and never closes. If the prefilter did not
    // reject before touching it, this call would hang until the test timeout —
    // which is the point: it proves the header alone ended the request.
    const request = new Request('http://localhost/x', {
      method: 'POST',
      body: new ReadableStream<Uint8Array>({
        pull: () => new Promise(() => {}),
      }),
      headers: { 'content-length': '2048' },
      duplex: 'half',
    } as RequestInit & { duplex: 'half' });

    await expect(readBoundedBody(request, 1024)).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });

  it('rejects mid-stream when the content-length header lies', async () => {
    // Header says 4 bytes (under the cap); the stream sends 40.
    const request = streamingRequest(['x'.repeat(40)], '4');

    await expect(readBoundedBody(request, 8)).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });

  it('rejects mid-stream when no content-length is sent at all', async () => {
    const request = streamingRequest(['x'.repeat(4), 'x'.repeat(4), 'x']);

    await expect(readBoundedBody(request, 8)).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });

  it('returns an empty view when the request carries no body', async () => {
    const request = new Request('http://localhost/x', { method: 'GET' });

    expect(await readBoundedBody(request, 1024)).toEqual(new Uint8Array(0));
  });

  it('carries a 413 that is not retryable', async () => {
    expect.assertions(3);

    try {
      await readBoundedBody(streamingRequest(['xxx']), 1);
    } catch (thrown) {
      const error = thrown as PayloadTooLargeError;
      expect(error.status).toBe(413);
      expect(error.code).toBe('PAYLOAD_TOO_LARGE');
      expect(error.retryable).toBe(false);
    }
  });
});

describe('readBoundedJson', () => {
  it('parses a body inside the cap', async () => {
    const request = streamingRequest(['{"email":"a@b.co"}']);

    expect(await readBoundedJson(request, 1024)).toEqual({ email: 'a@b.co' });
  });

  it('propagates the 413 rather than a parse error', async () => {
    const request = streamingRequest(['{"email":"a@b.co"}']);

    await expect(readBoundedJson(request, 4)).rejects.toBeInstanceOf(
      PayloadTooLargeError
    );
  });

  it('throws SyntaxError on a malformed body, as request.json() does', async () => {
    const request = streamingRequest(['not json']);

    await expect(readBoundedJson(request, 1024)).rejects.toBeInstanceOf(
      SyntaxError
    );
  });
});
