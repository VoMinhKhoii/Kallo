/**
 * Copies trace lines to the kallo-trace-ingest Worker, which keeps them in
 * Cloudflare D1 for the admin dashboard (admin.kallo.fit). Telemetry must never
 * fail or slow a meal analysis, so this is fire-and-forget: `send` only queues,
 * one POST per request is in flight at a time with everything queued since
 * batched behind it, each POST is time-bounded, and a failure is logged once
 * and drops the rest of that request's trace. No retries.
 *
 * Cloud Run throttles CPU once a response has ended, so a send still queued
 * then can stall or be lost; the dashboard falls back to the stdout copy.
 */

export const INGEST_TIMEOUT_MS = 3_000;
const MAX_BATCH_EVENTS = 64;
// The Worker accepts 2.5 MB; leave room for the JSON envelope.
const MAX_BATCH_BYTES = 2_000_000;
// Queued across all requests; past this, new lines are dropped.
const MAX_QUEUED_BYTES = 16_000_000;
// A failed request stays failed this long, past any trace still emitting.
const FAILED_TTL_MS = 120_000;

interface Queue {
  events: { at: string; line: string; bytes: number }[];
  bytes: number;
  sending: boolean;
  failed: boolean;
}

export interface IngestSinkOptions {
  url: string;
  secret: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}

export function createIngestSink(options: IngestSinkOptions) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const timeoutMs = options.timeoutMs ?? INGEST_TIMEOUT_MS;
  const queues = new Map<string, Queue>();
  const failed = new Map<string, number>(); // requestId -> expiry
  let queuedBytes = 0;

  function fail(requestId: string, queue: Queue, reason: string) {
    if (!queue.failed)
      console.warn(
        `[trace-ingest] dropped trace ${requestId}: ${reason}`.slice(0, 300)
      );
    queue.failed = true;
    failed.set(requestId, Date.now() + FAILED_TTL_MS);
    queuedBytes -= queue.bytes;
    queue.events = [];
    queue.bytes = 0;
  }

  async function post(requestId: string, queue: Queue): Promise<void> {
    const batch: { at: string; line: string }[] = [];
    let bytes = 0;
    while (
      queue.events.length &&
      batch.length < MAX_BATCH_EVENTS &&
      (batch.length === 0 || bytes + queue.events[0].bytes <= MAX_BATCH_BYTES)
    ) {
      const event = queue.events.shift() as Queue['events'][number];
      bytes += event.bytes;
      batch.push({ at: event.at, line: event.line });
    }
    queue.bytes -= bytes;
    queuedBytes -= bytes;
    try {
      const response = await fetchImpl(options.url, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${options.secret}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ events: batch }),
        cache: 'no-store',
        signal: AbortSignal.timeout(timeoutMs),
      });
      // Never wait on the body; release the connection.
      void response.body?.cancel().catch(() => {});
      if (!response.ok) fail(requestId, queue, `HTTP ${response.status}`);
    } catch (error) {
      // TimeoutError for the 3 s bound; a network code (ECONNREFUSED…)
      // otherwise, which Node's fetch puts on `cause`.
      const e = error as { code?: unknown; cause?: { code?: unknown } } | null;
      const code = e?.code ?? e?.cause?.code;
      fail(
        requestId,
        queue,
        typeof code === 'string'
          ? code
          : error instanceof Error
            ? error.name
            : 'request failed'
      );
    }
  }

  async function drain(requestId: string, queue: Queue): Promise<void> {
    queue.sending = true;
    try {
      while (queue.events.length && !queue.failed) await post(requestId, queue);
    } finally {
      queue.sending = false;
      queues.delete(requestId);
    }
  }

  return {
    /** Queue one line (trailing newline allowed). Never throws, never awaits. */
    send(requestId: string, line: string): void {
      try {
        const now = Date.now();
        if (failed.size > 256)
          for (const [id, expiry] of failed)
            if (expiry < now) failed.delete(id);
        if ((failed.get(requestId) ?? 0) > now) return;
        let queue = queues.get(requestId);
        const trimmed = line.endsWith('\n') ? line.slice(0, -1) : line;
        // The line travels as a JSON string inside JSON: count it encoded
        // (quotes and backslashes double) plus its {"at":…,"line":…} wrapper.
        const bytes = Buffer.byteLength(JSON.stringify(trimmed)) + 48;
        if (queuedBytes + bytes > MAX_QUEUED_BYTES) {
          fail(
            requestId,
            queue ?? { events: [], bytes: 0, sending: false, failed: false },
            'queue full'
          );
          return;
        }
        if (!queue) {
          queue = { events: [], bytes: 0, sending: false, failed: false };
          queues.set(requestId, queue);
        }
        queue.events.push({
          at: new Date(now).toISOString(),
          line: trimmed,
          bytes,
        });
        queue.bytes += bytes;
        queuedBytes += bytes;
        if (!queue.sending) void drain(requestId, queue);
      } catch {
        // Telemetry must never change the meal outcome.
      }
    },
    /** Test hook: resolves once nothing is queued or in flight. */
    async idle(): Promise<void> {
      while (queues.size) await new Promise((r) => setTimeout(r, 5));
    },
  };
}

/** The sink from TRACE_INGEST_URL + TRACE_INGEST_SECRET, or null when either is unset. */
export function ingestSinkFromEnv(): ReturnType<
  typeof createIngestSink
> | null {
  const url = process.env.TRACE_INGEST_URL?.trim();
  const secret = process.env.TRACE_INGEST_SECRET?.trim();
  if (!url || !secret) return null;
  try {
    if (
      new URL(url).protocol !== 'https:' &&
      process.env.NODE_ENV === 'production'
    )
      return null;
  } catch {
    return null;
  }
  return createIngestSink({ url, secret });
}
