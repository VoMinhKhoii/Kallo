import { randomUUID } from 'node:crypto';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import { ingestSinkFromEnv } from '@/lib/ai/pipeline/telemetry/cloud-trace/ingest-sink';
import { serializeTrace } from '@/lib/ai/pipeline/telemetry/cloud-trace/serialize';
import type { PipelineResult } from '@/lib/ai/types/result';

export const TRACE_ENTRY_BYTES = 200_000;
export const TRACE_TOTAL_BYTES = 2_000_000;
type TraceType = 'request' | 'stage' | 'llm' | 'final';
interface TraceState {
  seq: number;
  bytes: number;
  truncated: boolean;
  logged: boolean;
  enabled: boolean;
  expires: number;
  preview: string;
  profile: string;
  models: Set<string>;
  finished: boolean;
}

/** Bounded metadata even for aborted requests; no retained payloads or I/O promises. */
export function createTraceCapture(
  write: (line: string) => boolean = (line) => {
    if (
      process.stdout.writableNeedDrain ||
      process.stdout.destroyed ||
      process.stdout.writableEnded
    )
      return false;
    // Writable errors are also emitted after the write callback (e.g. EPIPE).
    // A callback alone does not prevent an unhandled stream error.
    if (process.stdout.listenerCount('error') === 0)
      process.stdout.on('error', () => {});
    return process.stdout.write(line, () => {});
  },
  /** A second copy of every line written, e.g. to the D1 ingest Worker. */
  forward?: (requestId: string, line: string) => void
) {
  const traces = new Map<string, TraceState>();
  const out = (requestId: string, line: string): boolean => {
    const written = write(line);
    try {
      forward?.(requestId, line);
    } catch {
      // The copy is best-effort; stdout capture carries on.
    }
    return written;
  };
  function emit(
    requestId: string | null | undefined,
    type: TraceType,
    payload: Record<string, unknown>
  ): void {
    try {
      if (!requestId) return;
      const state = traces.get(requestId);
      if (!state) return;
      if (type === 'llm' && typeof payload.model === 'string')
        state.models.add(payload.model);
      if (!state.enabled) return;
      const serialized = serializeTrace(payload);
      state.truncated ||= serialized.truncated;
      const eventId = randomUUID();
      const seq = ++state.seq;
      const envelope = {
        severity: 'INFO',
        message: 'kallo_trace_v1',
        kind: 'kallo_trace_v1',
        requestId,
        eventId,
        seq,
        type,
      };
      const single = JSON.stringify({
        ...JSON.parse(serialized.json),
        ...envelope,
        part: 1,
        parts: 1,
        truncated: state.truncated,
      });
      // 30k UTF-16 units fit even when every character needs a six-byte JSON escape.
      const chunks: string[] = [];
      if (Buffer.byteLength(single) + 1 > TRACE_ENTRY_BYTES) {
        for (let start = 0; start < serialized.json.length; ) {
          let end = Math.min(start + 30_000, serialized.json.length);
          const last = serialized.json.charCodeAt(end - 1);
          if (last >= 0xd800 && last <= 0xdbff && end < serialized.json.length)
            end--;
          chunks.push(serialized.json.slice(start, end));
          start = end;
        }
      }
      const parts = chunks.length || 1;
      for (let part = 1; part <= parts; part++) {
        let line = chunks.length
          ? JSON.stringify({
              ...envelope,
              part,
              parts,
              payload: chunks[part - 1],
              truncated: state.truncated,
            })
          : single;
        let size = Buffer.byteLength(line) + 1;
        // Reserve a final marker even if a large event consumes the remaining budget.
        if (state.bytes + size > TRACE_TOTAL_BYTES - 1024) {
          state.truncated = true;
          state.enabled = false;
          line = JSON.stringify({ ...envelope, part, parts, truncated: true });
          size = Buffer.byteLength(line) + 1;
          if (state.bytes + size > TRACE_TOTAL_BYTES) return;
          state.bytes += size;
          out(requestId, `${line}\n`);
          return;
        }
        state.bytes += size;
        if (!out(requestId, `${line}\n`)) {
          state.truncated = true;
          state.enabled = false;
          return;
        }
        state.logged = true;
      }
    } catch {
      // Telemetry must never change the meal outcome.
      if (requestId) {
        const state = traces.get(requestId);
        if (state) {
          state.truncated = true;
          state.enabled = false;
        }
      }
    }
  }
  return {
    start(
      requestId: string,
      payload: Record<string, unknown> & { rawInput: string; profile: string }
    ): void {
      try {
        const now = Date.now();
        for (const [id, state] of traces)
          if (state.expires < now) traces.delete(id);
        if (traces.size >= 1024) return;
        traces.set(requestId, {
          seq: 0,
          bytes: 0,
          truncated: false,
          logged: false,
          enabled: readBooleanEnv('TRACE_LOG_ENABLED', true),
          expires: now + 120_000,
          preview: payload.rawInput.slice(0, 160),
          profile: payload.profile,
          models: new Set(),
          finished: false,
        });
        emit(requestId, 'request', payload);
      } catch {}
    },
    emit,
    finish(requestId: string, payload: Record<string, unknown>) {
      const state = traces.get(requestId);
      if (!state?.finished) emit(requestId, 'final', payload);
      // Deadline-abandoned rescue/shadow attempts may still report billable
      // usage after final. Keep their counters until the bounded TTL sweep.
      if (state) state.finished = true;
      return {
        mealName: state?.preview ?? null,
        modelProfile: state?.profile ?? null,
        models: state ? [...state.models] : null,
        traceLogged: state ? state.logged && !state.truncated : false,
      };
    },
  };
}

// Read from env until both TRACE_INGEST_* values are set, then kept.
let sink: ReturnType<typeof ingestSinkFromEnv> | undefined;
export const cloudTrace = createTraceCapture(undefined, (requestId, line) => {
  sink ??= ingestSinkFromEnv();
  sink?.send(requestId, line);
});

/** Small final facts, independent of whether the analysis is saved as a meal. */
export function traceResultSummary(result?: PipelineResult) {
  if (!result) return null;
  const n = result.boundedNutrition;
  return {
    kcal: n.caloriesKcal,
    protein: n.proteinG,
    carbs: n.carbohydrateG,
    fat: n.fatG,
    items: result.mealItems.map((item) => ({
      name: item.name,
      grams: item.ingredients.reduce((sum, ing) => sum + ing.estimatedGrams, 0),
      kcal: item.boundedNutrition.caloriesKcal,
      protein: item.boundedNutrition.proteinG,
      carbs: item.boundedNutrition.carbohydrateG,
      fat: item.boundedNutrition.fatG,
    })),
  };
}
