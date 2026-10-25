import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTraceCapture } from '@/lib/ai/pipeline/telemetry/cloud-trace/cloud-trace';
import {
  createIngestSink,
  ingestSinkFromEnv,
} from '@/lib/ai/pipeline/telemetry/cloud-trace/ingest-sink';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

const URL = 'https://ingest.example.test/v1/events';
const SECRET = 's'.repeat(40);

/** A fetch whose responses the test releases one at a time. */
function gatedFetch(status = 200) {
  const calls: {
    body: { events: { at: string; line: string }[] };
    init: RequestInit;
  }[] = [];
  const gates: (() => void)[] = [];
  const fetchImpl = vi.fn((_url: string, init: RequestInit) => {
    calls.push({ body: JSON.parse(String(init.body)), init });
    return new Promise<Response>((resolve) =>
      gates.push(() => resolve(new Response('{}', { status })))
    );
  }) as unknown as typeof fetch;
  return {
    fetchImpl,
    calls,
    release: async () => {
      gates.shift()?.();
      await new Promise((r) => setTimeout(r, 0));
    },
  };
}

describe('trace ingest sink', () => {
  it('sends the first line at once and batches the rest behind it', async () => {
    const f = gatedFetch();
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl: f.fetchImpl,
    });
    sink.send('req-1', 'line-1\n');
    sink.send('req-1', 'line-2\n');
    sink.send('req-1', 'line-3\n');
    expect(f.calls).toHaveLength(1);
    expect(f.calls[0].body.events.map((e) => e.line)).toEqual(['line-1']);
    expect(new Headers(f.calls[0].init.headers).get('authorization')).toBe(
      `Bearer ${SECRET}`
    );
    expect(Number.isFinite(Date.parse(f.calls[0].body.events[0].at))).toBe(
      true
    );
    await f.release();
    expect(f.calls).toHaveLength(2);
    expect(f.calls[1].body.events.map((e) => e.line)).toEqual([
      'line-2',
      'line-3',
    ]);
    await f.release();
    await sink.idle();
    expect(f.calls).toHaveLength(2);
  });

  it('keeps requests independent', () => {
    const f = gatedFetch();
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl: f.fetchImpl,
    });
    sink.send('req-1', 'a');
    sink.send('req-2', 'b');
    expect(f.calls.map((c) => c.body.events[0].line)).toEqual(['a', 'b']);
  });

  it('caps a batch at 64 lines', async () => {
    const f = gatedFetch();
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl: f.fetchImpl,
    });
    for (let i = 0; i < 100; i++) sink.send('req-1', `line-${i}`);
    await f.release();
    await f.release();
    expect(f.calls.map((c) => c.body.events.length)).toEqual([1, 64, 35]);
  });

  it('keeps every POST under the Worker body limit, counting JSON escaping', async () => {
    const f = gatedFetch();
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl: f.fetchImpl,
    });
    // Quote-heavy lines double when encoded as JSON strings.
    const heavy = JSON.stringify({ response: '"'.repeat(90_000) });
    for (let i = 0; i < 40; i++) sink.send('req-1', heavy);
    for (let i = 0; i < 40 && f.calls.length < 40; i++) await f.release();
    const sizes = f.calls.map((c) => Buffer.byteLength(String(c.init.body)));
    expect(sizes.reduce((n, s) => n + s, 0)).toBeGreaterThan(5_000_000);
    expect(Math.max(...sizes)).toBeLessThanOrEqual(2_500_000);
  });

  it('a failed send logs once and drops the rest of that trace', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const f = gatedFetch(503);
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl: f.fetchImpl,
    });
    sink.send('req-1', 'a');
    sink.send('req-1', 'b');
    await f.release();
    sink.send('req-1', 'c');
    await sink.idle();
    expect(f.calls).toHaveLength(1);
    expect(warn).toHaveBeenCalledTimes(1);
    expect(String(warn.mock.calls[0][0])).toContain('HTTP 503');
    // Another request still sends.
    sink.send('req-2', 'd');
    expect(f.calls).toHaveLength(2);
  });

  it('never throws, even when fetch throws synchronously', async () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn(() => {
      throw new TypeError('boom');
    }) as unknown as typeof fetch;
    const sink = createIngestSink({ url: URL, secret: SECRET, fetchImpl });
    expect(() => sink.send('req-1', 'a')).not.toThrow();
    await sink.idle();
  });

  it('times out a hung Worker', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const fetchImpl = vi.fn(
      (_url: string, init: RequestInit) =>
        new Promise<Response>((_, reject) =>
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          )
        )
    ) as unknown as typeof fetch;
    const sink = createIngestSink({
      url: URL,
      secret: SECRET,
      fetchImpl,
      timeoutMs: 20,
    });
    sink.send('req-1', 'a');
    await sink.idle();
    expect(String(warn.mock.calls[0][0])).toContain('TimeoutError');
  });
});

describe('ingestSinkFromEnv', () => {
  it('is off unless both values are set, and https-only in production', () => {
    expect(ingestSinkFromEnv()).toBeNull();
    vi.stubEnv('TRACE_INGEST_URL', URL);
    expect(ingestSinkFromEnv()).toBeNull();
    vi.stubEnv('TRACE_INGEST_SECRET', SECRET);
    expect(ingestSinkFromEnv()).not.toBeNull();
    vi.stubEnv('NODE_ENV', 'production');
    vi.stubEnv('TRACE_INGEST_URL', 'http://ingest.example.test/v1/events');
    expect(ingestSinkFromEnv()).toBeNull();
    vi.stubEnv('TRACE_INGEST_URL', 'not a url');
    expect(ingestSinkFromEnv()).toBeNull();
  });
});

describe('trace capture forwarding', () => {
  it('forwards exactly the lines written to stdout', () => {
    const written: string[] = [];
    const forwarded: [string, string][] = [];
    const capture = createTraceCapture(
      (line) => {
        written.push(line);
        return true;
      },
      (requestId, line) => forwarded.push([requestId, line])
    );
    capture.start('synthetic-request', {
      rawInput: 'Synthetic meal',
      profile: 'stable',
    });
    capture.emit('synthetic-request', 'stage', {
      stage: 'matching',
      output: [],
    });
    capture.finish('synthetic-request', { status: 'success' });
    expect(written).toHaveLength(3);
    expect(forwarded).toEqual(
      written.map((line) => ['synthetic-request', line])
    );
  });

  it('a throwing forwarder never changes the capture', () => {
    const written: string[] = [];
    const capture = createTraceCapture(
      (line) => {
        written.push(line);
        return true;
      },
      () => {
        throw new Error('sink bug');
      }
    );
    capture.start('synthetic-request', {
      rawInput: 'Synthetic meal',
      profile: 'stable',
    });
    capture.emit('synthetic-request', 'stage', {
      stage: 'matching',
      output: [],
    });
    // Both the request and the stage line still reach stdout.
    expect(written).toHaveLength(2);
    expect(capture.finish('synthetic-request', {}).traceLogged).toBe(true);
  });
});
