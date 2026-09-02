import type {
  RateLimitConsumeInput,
  RateLimitConsumeRow,
  RateLimitConsumer,
} from '../types';

/**
 * A REFERENCE MODEL of `public.rate_limit_consume`, not an oracle.
 *
 * Postgres is the definition; this exists so `consume.ts` can be tested for
 * flow (prefilter, failMode, key order) without a database, and so the
 * plpgsql's own semantics are written down twice — once in SQL and once here.
 * When the two disagree, the SQL is right and this file is the bug. The DB
 * test (`rate-limit-consume.db.test.ts`) is what actually pins the SQL.
 *
 * Mirrored exactly: UTC-truncated windows, rollover FORWARD only, unenforced
 * windows never incremented, a blocked call consuming nothing, minute > hour >
 * day precedence for `reason`, and `retry_after` measured to the LATEST end
 * among all exhausted windows.
 */

type WindowKind = 'minute' | 'hour' | 'day';

interface CounterRow {
  minuteStart: number;
  minuteCount: number;
  hourStart: number;
  hourCount: number;
  dayStart: number;
  dayCount: number;
}

const WINDOW_MS: Record<WindowKind, number> = {
  minute: 60_000,
  hour: 3_600_000,
  day: 86_400_000,
};

function truncate(nowMs: number, kind: WindowKind) {
  return Math.floor(nowMs / WINDOW_MS[kind]) * WINDOW_MS[kind];
}

function normalizeLimit(limit: number | undefined) {
  return limit == null || limit <= 0 ? null : limit;
}

function rolled(storedStart: number, storedCount: number, start: number) {
  return storedStart < start ? 0 : storedCount;
}

export function createInMemoryRateLimitConsumer(): RateLimitConsumer & {
  rows: Map<string, CounterRow>;
} {
  const rows = new Map<string, CounterRow>();
  // Serializes calls the way the row lock serializes them in Postgres, so a
  // concurrency test measures the LIMIT, not JS interleaving.
  let queue: Promise<unknown> = Promise.resolve();

  function step(input: RateLimitConsumeInput): RateLimitConsumeRow {
    const nowMs = (input.now ?? new Date()).getTime();
    const starts = {
      minute: truncate(nowMs, 'minute'),
      hour: truncate(nowMs, 'hour'),
      day: truncate(nowMs, 'day'),
    };
    const limits = {
      minute: normalizeLimit(input.limits.perMinute),
      hour: normalizeLimit(input.limits.perHour),
      day: normalizeLimit(input.limits.perDay),
    };
    const key = `${input.keyKind}|${input.keyHash}|${input.route}`;
    const stored = rows.get(key);
    const counts = {
      minute: stored
        ? rolled(stored.minuteStart, stored.minuteCount, starts.minute)
        : 0,
      hour: stored
        ? rolled(stored.hourStart, stored.hourCount, starts.hour)
        : 0,
      day: stored ? rolled(stored.dayStart, stored.dayCount, starts.day) : 0,
    };
    const effectiveStarts = {
      minute: Math.max(stored?.minuteStart ?? starts.minute, starts.minute),
      hour: Math.max(stored?.hourStart ?? starts.hour, starts.hour),
      day: Math.max(stored?.dayStart ?? starts.day, starts.day),
    };

    // `reason` is the smallest exhausted window (the diagnosis); the wait is
    // the LATEST end among every exhausted window, so a client that honours
    // Retry-After is actually admitted when it comes back. Mirrors the
    // plpgsql — see the comment block above the blocked path there.
    let reason: WindowKind | null = null;
    let windowEnd = 0;

    for (const kind of ['minute', 'hour', 'day'] as const) {
      const limit = limits[kind];
      if (limit == null || counts[kind] < limit) continue;

      reason ??= kind;
      windowEnd = Math.max(windowEnd, effectiveStarts[kind] + WINDOW_MS[kind]);
    }

    if (reason) {
      return {
        allowed: false,
        reason,
        retry_after_seconds: Math.max(1, Math.ceil((windowEnd - nowMs) / 1000)),
        remaining_minute:
          limits.minute == null
            ? null
            : Math.max(0, limits.minute - counts.minute),
        remaining_hour:
          limits.hour == null ? null : Math.max(0, limits.hour - counts.hour),
        remaining_day:
          limits.day == null ? null : Math.max(0, limits.day - counts.day),
      };
    }

    // Unenforced windows are never incremented — that is what removes the
    // int-overflow path on a route that only bounds one window.
    const next = {
      minute: limits.minute == null ? counts.minute : counts.minute + 1,
      hour: limits.hour == null ? counts.hour : counts.hour + 1,
      day: limits.day == null ? counts.day : counts.day + 1,
    };

    rows.set(key, {
      minuteStart: effectiveStarts.minute,
      minuteCount: next.minute,
      hourStart: effectiveStarts.hour,
      hourCount: next.hour,
      dayStart: effectiveStarts.day,
      dayCount: next.day,
    });

    return {
      allowed: true,
      reason: null,
      retry_after_seconds: null,
      remaining_minute:
        limits.minute == null ? null : limits.minute - next.minute,
      remaining_hour: limits.hour == null ? null : limits.hour - next.hour,
      remaining_day: limits.day == null ? null : limits.day - next.day,
    };
  }

  return {
    rows,
    consume(input) {
      const run = queue.then(() => step(input));
      queue = run.then(
        () => undefined,
        () => undefined
      );
      return run;
    },
  };
}
