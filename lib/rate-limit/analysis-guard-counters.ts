import { and, eq, gt, lt, sql } from 'drizzle-orm';
import type { AppDb } from '@/lib/db';
import {
  analysisInFlightLimits,
  analysisRateLimitWindows,
} from '@/lib/db/schema';
import { readPositiveInteger } from './analysis-guard-limits';
import type {
  AnalysisGuardBlockedResult,
  AnalysisRateLimitWindowKind,
} from './analysis-guard-types';

export type GuardMutationDb = Pick<AppDb, 'insert' | 'update'>;

export interface AnalysisGuardKey {
  keyKind: 'user';
  keyHash: string;
  route: string;
}

interface IncrementWindowCounterInput extends AnalysisGuardKey {
  windowKind: AnalysisRateLimitWindowKind;
  windowStart: Date;
  now: Date;
}

/**
 * Bump the minute/hour/day counters in ONE statement and return each new count
 * by window kind.
 *
 * They used to go one round trip at a time inside the guard's transaction —
 * three sequential waits on a path that every guarded request pays, and the
 * relog picker pays on a 300ms debounce while you type. The three rows differ
 * only in `window_kind`/`window_start`, so a multi-row upsert is the same work
 * for Postgres and a third of the latency.
 *
 * Keyed by kind on the way back rather than by position: `RETURNING` makes no
 * ordering promise, and reading a minute count as a day count would silently
 * mis-throttle.
 */
export async function incrementWindowCounters(
  guardDb: GuardMutationDb,
  inputs: readonly IncrementWindowCounterInput[]
): Promise<Map<AnalysisRateLimitWindowKind, number>> {
  if (inputs.length === 0) return new Map();

  const rows = await guardDb
    .insert(analysisRateLimitWindows)
    .values(
      inputs.map((input) => ({
        keyKind: input.keyKind,
        keyHash: input.keyHash,
        route: input.route,
        windowKind: input.windowKind,
        windowStart: input.windowStart,
        count: 1,
        createdAt: input.now,
        updatedAt: input.now,
      }))
    )
    .onConflictDoUpdate({
      target: [
        analysisRateLimitWindows.keyKind,
        analysisRateLimitWindows.keyHash,
        analysisRateLimitWindows.route,
        analysisRateLimitWindows.windowKind,
        analysisRateLimitWindows.windowStart,
      ],
      set: {
        count: sql`${analysisRateLimitWindows.count} + 1`,
        updatedAt: inputs[0].now,
      },
    })
    .returning({
      windowKind: analysisRateLimitWindows.windowKind,
      count: analysisRateLimitWindows.count,
    });

  return new Map<AnalysisRateLimitWindowKind, number>(
    rows.map((row) => [
      row.windowKind as AnalysisRateLimitWindowKind,
      row.count,
    ])
  );
}

export async function incrementWindowCounter(
  guardDb: GuardMutationDb,
  input: IncrementWindowCounterInput
) {
  const [row] = await guardDb
    .insert(analysisRateLimitWindows)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      windowKind: input.windowKind,
      windowStart: input.windowStart,
      count: 1,
      createdAt: input.now,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisRateLimitWindows.keyKind,
        analysisRateLimitWindows.keyHash,
        analysisRateLimitWindows.route,
        analysisRateLimitWindows.windowKind,
        analysisRateLimitWindows.windowStart,
      ],
      set: {
        count: sql`${analysisRateLimitWindows.count} + 1`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisRateLimitWindows.count });

  return row.count;
}

export async function incrementInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  const [row] = await guardDb
    .insert(analysisInFlightLimits)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      count: 1,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisInFlightLimits.keyKind,
        analysisInFlightLimits.keyHash,
        analysisInFlightLimits.route,
      ],
      set: {
        count: sql`${analysisInFlightLimits.count} + 1`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisInFlightLimits.count });

  return row.count;
}

const DEFAULT_IN_FLIGHT_STALE_AFTER_SECONDS = 90;

function getInFlightStaleAfterSeconds() {
  return readPositiveInteger(
    process.env.ANALYSIS_IN_FLIGHT_STALE_AFTER_SECONDS,
    DEFAULT_IN_FLIGHT_STALE_AFTER_SECONDS
  );
}

export async function resetStaleInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  const staleBefore = new Date(
    input.now.getTime() - getInFlightStaleAfterSeconds() * 1000
  );

  await guardDb
    .update(analysisInFlightLimits)
    .set({
      count: 0,
      // Keep the threshold timestamp so the next upsert can move the row to
      // "active now" in the same transaction without preserving stale age.
      updatedAt: staleBefore,
    })
    .where(
      and(
        eq(analysisInFlightLimits.keyKind, input.keyKind),
        eq(analysisInFlightLimits.keyHash, input.keyHash),
        eq(analysisInFlightLimits.route, input.route),
        gt(analysisInFlightLimits.count, 0),
        lt(analysisInFlightLimits.updatedAt, staleBefore)
      )
    );
}

export async function decrementInFlightCounter(
  guardDb: GuardMutationDb,
  input: AnalysisGuardKey & { now: Date }
) {
  await guardDb
    .insert(analysisInFlightLimits)
    .values({
      keyKind: input.keyKind,
      keyHash: input.keyHash,
      route: input.route,
      count: 0,
      updatedAt: input.now,
    })
    .onConflictDoUpdate({
      target: [
        analysisInFlightLimits.keyKind,
        analysisInFlightLimits.keyHash,
        analysisInFlightLimits.route,
      ],
      set: {
        count: sql`greatest(${analysisInFlightLimits.count} - 1, 0)`,
        updatedAt: input.now,
      },
    })
    .returning({ count: analysisInFlightLimits.count });
}

export class AnalysisGuardBlockedError extends Error {
  constructor(public readonly result: AnalysisGuardBlockedResult) {
    super(result.reason);
  }
}
