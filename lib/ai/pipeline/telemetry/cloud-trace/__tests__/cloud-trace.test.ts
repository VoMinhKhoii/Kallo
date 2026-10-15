import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  createTraceCapture,
  TRACE_ENTRY_BYTES,
  TRACE_TOTAL_BYTES,
} from '@/lib/ai/pipeline/telemetry/cloud-trace/cloud-trace';

afterEach(() => {
  vi.unstubAllEnvs();
  vi.useRealTimers();
});
function fixture() {
  const lines: string[] = [];
  const capture = createTraceCapture((line) => {
    lines.push(line);
    return true;
  });
  capture.start('synthetic-request', {
    rawInput: 'Synthetic meal',
    profile: 'stable',
  });
  return {
    capture,
    lines,
    events: () => lines.map((line) => JSON.parse(line)),
  };
}

describe('bounded Cloud Logging capture', () => {
  it('emits synchronous single-line structured events with monotonic sequence', () => {
    const { capture, events } = fixture();
    expect(
      capture.emit('synthetic-request', 'stage', { stage: 'matching' })
    ).toBeUndefined();
    const summary = capture.finish('synthetic-request', { status: 'success' });
    expect(summary.traceLogged).toBe(true);
    expect(events().map((event) => event.seq)).toEqual([1, 2, 3]);
    expect(events()[0]).toMatchObject({
      kind: 'kallo_trace_v1',
      severity: 'INFO',
      type: 'request',
      part: 1,
      parts: 1,
    });
  });

  it('never waits for a drain or a promise, and stops on stdout backpressure', () => {
    const write = vi.fn(() => false);
    const capture = createTraceCapture(write);
    expect(
      capture.start('r', { rawInput: 'Synthetic', profile: 'stable' })
    ).toBeUndefined();
    capture.emit('r', 'stage', {});
    expect(write).toHaveBeenCalledTimes(1);
    expect(capture.finish('r', {}).traceLogged).toBe(false);
  });

  it('never throws for stdout failures, cycles, getters, BigInt, or missing traces', () => {
    const bad = createTraceCapture(() => {
      throw new Error('closed stdout');
    });
    expect(() =>
      bad.start('r', { rawInput: 'Synthetic', profile: 'stable' })
    ).not.toThrow();
    expect(() => bad.finish('r', {})).not.toThrow();
    const { capture } = fixture();
    const circular: Record<string, unknown> = { big: BigInt(1) };
    circular.self = circular;
    expect(() =>
      capture.emit('synthetic-request', 'stage', circular)
    ).not.toThrow();
    expect(() =>
      capture.emit('synthetic-request', 'stage', {
        get bad() {
          throw new Error('getter');
        },
      })
    ).not.toThrow();
    expect(() => capture.emit(null, 'llm', {})).not.toThrow();
    expect(capture.finish('synthetic-request', {}).traceLogged).toBe(false);
  });

  it('reassembles oversized Unicode and escaped text without splitting surrogate pairs', () => {
    const { capture, lines, events } = fixture();
    const response = 'đồ ăn 🥗 " \\ \n'.repeat(22_000);
    capture.emit('synthetic-request', 'llm', { response });
    const parts = events().filter((event) => event.type === 'llm');
    expect(parts.length).toBeGreaterThan(1);
    expect(parts.map((event) => event.part)).toEqual(
      parts.map((_, index) => index + 1)
    );
    expect(new Set(parts.map((event) => event.eventId)).size).toBe(1);
    expect(parts.every((event) => event.parts === parts.length)).toBe(true);
    expect(JSON.parse(parts.map((event) => event.payload).join(''))).toEqual({
      response,
    });
    expect(
      lines.every((line) => Buffer.byteLength(line) <= TRACE_ENTRY_BYTES)
    ).toBe(true);
    expect(lines.every((line) => line.split('\n').length === 2)).toBe(true);
  });

  it('caps total emitted bytes at 2 MB and marks truncation', () => {
    const { capture, lines, events } = fixture();
    for (let i = 0; i < 30; i++)
      capture.emit('synthetic-request', 'llm', {
        response: 'x'.repeat(180_000),
      });
    expect(capture.finish('synthetic-request', {}).traceLogged).toBe(false);
    expect(
      lines.reduce((sum, line) => sum + Buffer.byteLength(line), 0)
    ).toBeLessThanOrEqual(TRACE_TOTAL_BYTES);
    expect(events().some((event) => event.truncated)).toBe(true);
  });

  it('bounds oversized individual inputs and strips context, identities, images and URLs', () => {
    const { capture, lines, events } = fixture();
    capture.emit('synthetic-request', 'stage', {
      userId: 'private-user',
      user_context: { secret: true },
      image: 'private-image',
      inputTokens: 42,
      input: 'synthetic@example.test https://example.test/?signature=private',
      output: 'x'.repeat(3_000_000),
    });
    const text = lines.join('');
    expect(text).not.toContain('private-user');
    expect(text).not.toContain('private-image');
    expect(text).not.toContain('example.test');
    expect(text).not.toContain('user_context');
    expect(events().some((event) => event.truncated)).toBe(true);
  });

  it('disabled capture still collects model summary without writing stdout', () => {
    vi.stubEnv('TRACE_LOG_ENABLED', 'false');
    const { capture, lines } = fixture();
    capture.emit('synthetic-request', 'llm', { model: 'synthetic-model' });
    expect(capture.finish('synthetic-request', {})).toMatchObject({
      models: ['synthetic-model'],
      traceLogged: false,
    });
    expect(lines).toHaveLength(0);
  });

  it('preserves shared references and usage counters without reporting a cycle', () => {
    const { capture, events } = fixture();
    const macro = { low: 1, mid: 2, high: 3 };
    capture.emit('synthetic-request', 'final', {
      macro,
      again: macro,
      inputTokens: 12,
      cachedTokens: 4,
    });
    expect(events()[1]).toMatchObject({
      macro,
      again: macro,
      inputTokens: 12,
      cachedTokens: 4,
      truncated: false,
    });
    expect(capture.finish('synthetic-request', {}).traceLogged).toBe(true);
  });

  it('isolates concurrent traces and retains late billed attempts until the TTL sweep', () => {
    vi.useFakeTimers();
    const { capture, events } = fixture();
    capture.start('other', { rawInput: 'Other synthetic', profile: 'haiku' });
    capture.emit('other', 'llm', { model: 'claude-haiku-5-5' });
    expect(capture.finish('synthetic-request', {}).models).toEqual([]);
    expect(capture.finish('other', {}).models).toEqual(['claude-haiku-5-5']);
    const count = events().length;
    capture.emit('other', 'llm', {});
    expect(events()).toHaveLength(count + 1);
    vi.advanceTimersByTime(120_001);
    capture.start('fresh', { rawInput: 'Synthetic fresh', profile: 'stable' });
    capture.emit('other', 'llm', {});
    expect(events()).toHaveLength(count + 2);
  });
});
