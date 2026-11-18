import { constants } from 'node:perf_hooks';
import { describe, expect, it } from 'vitest';
import {
  describeGcPause,
  GC_PAUSE_LOG_MS,
} from '@/lib/infra/telemetry/monitoring/gc-pauses';

describe('describeGcPause', () => {
  it('stays quiet for the short pauses that happen all the time', () => {
    expect(
      describeGcPause(
        GC_PAUSE_LOG_MS - 1,
        constants.NODE_PERFORMANCE_GC_MINOR,
        1e8
      )
    ).toBeNull();
  });

  it('logs a long pause with its kind and the heap size', () => {
    const line = describeGcPause(
      212.4,
      constants.NODE_PERFORMANCE_GC_MAJOR,
      812_000_000
    );
    expect(JSON.parse(line ?? '')).toEqual({
      severity: 'WARNING',
      message: 'gc-pause',
      ms: 212,
      kind: 'major',
      heapUsedMb: 812,
    });
  });

  it('names an unknown kind rather than dropping the pause', () => {
    expect(JSON.parse(describeGcPause(80, undefined, 0) ?? '').kind).toBe(
      'unknown'
    );
  });
});
