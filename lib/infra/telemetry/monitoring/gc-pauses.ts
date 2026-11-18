import { constants, PerformanceObserver } from 'node:perf_hooks';

/**
 * Logs every garbage-collection pause long enough to be felt by a request.
 *
 * About one burst of app-launch calls in ten stalls by the same 200-300 ms on
 * every call at once (prod bench, 2026-11-18), while the database spans in
 * Sentry account for only part of it. A stop-the-world pause in this process
 * would look exactly like that: the instance holds the card-search index and
 * catalog (about 800 MB in use), so a full collection is not cheap. This turns
 * the guess into a measurement: one structured log line per pause of
 * `GC_PAUSE_LOG_MS` or more, which Cloud Logging lines up with the slow
 * requests by time. Nothing is logged for the short pauses that happen all
 * the time.
 */

export const GC_PAUSE_LOG_MS = 50;

const KINDS: Record<number, string> = {
  [constants.NODE_PERFORMANCE_GC_MINOR]: 'minor',
  [constants.NODE_PERFORMANCE_GC_MAJOR]: 'major',
  [constants.NODE_PERFORMANCE_GC_INCREMENTAL]: 'incremental',
  [constants.NODE_PERFORMANCE_GC_WEAKCB]: 'weakcb',
};

/** The log line for one GC entry, or null when the pause is too short to matter. */
export function describeGcPause(
  durationMs: number,
  kind: number | undefined,
  heapUsedBytes: number
): string | null {
  if (durationMs < GC_PAUSE_LOG_MS) return null;
  return JSON.stringify({
    severity: 'WARNING',
    message: 'gc-pause',
    ms: Math.round(durationMs),
    kind: (kind !== undefined && KINDS[kind]) || 'unknown',
    heapUsedMb: Math.round(heapUsedBytes / 1e6),
  });
}

/** Starts watching. Call once per process (instrumentation.ts). */
export function watchGcPauses(log: (line: string) => void = console.warn) {
  const observer = new PerformanceObserver((list) => {
    for (const entry of list.getEntries()) {
      const detail = (entry as { detail?: { kind?: number } }).detail;
      const line = describeGcPause(
        entry.duration,
        detail?.kind,
        process.memoryUsage().heapUsed
      );
      if (line) log(line);
    }
  });
  observer.observe({ entryTypes: ['gc'] });
  return observer;
}
