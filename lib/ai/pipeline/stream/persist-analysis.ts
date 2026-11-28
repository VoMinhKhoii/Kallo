import { sql } from 'drizzle-orm';
import { withDeadline } from '@/lib/core/async/with-deadline';
import { Errors } from '@/lib/core/errors/catalog';
import { db } from '@/lib/infra/db/client';
import { pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * Bound the awaited insert so a stalled DB connection (the `max: 2` pool can
 * starve under a saturated Supabase pooler) can't leave the SSE stream open
 * forever between `stage: assembling` and `analysis_complete`. On timeout the
 * stream emits an `error` terminal event and closes, instead of hanging.
 */
export const PERSIST_DEADLINE_MS =
  Number(process.env.ANALYZE_PERSIST_DEADLINE_MS) || 15_000;

interface StagePendingAnalysis {
  userId: string;
  pipelineResult: unknown;
  rawInput: string;
  entryMode: 'precise' | 'cheat';
  loggedAt: Date;
  attemptId?: string;
  /** Copied onto the meal at confirm so its AI spend can be joined back. */
  pipelineRequestId?: string;
}

/**
 * Stage a pending analysis, upserting on (user_id, attempt_id) so a re-analysis
 * of the same logging attempt (retry, double-fired clarify) supersedes its row
 * instead of leaving an orphan that renders as a duplicate "unsaved" card. A
 * NULL attemptId can't conflict (NULLs are distinct), so it always inserts.
 * expiresAt is refreshed so a renewed card gets a full window.
 */
export function upsertPendingAnalysis(values: StagePendingAnalysis) {
  return db
    .insert(pendingAnalyses)
    .values(values)
    .onConflictDoUpdate({
      target: [pendingAnalyses.userId, pendingAnalyses.attemptId],
      set: {
        pipelineResult: values.pipelineResult,
        rawInput: values.rawInput,
        entryMode: values.entryMode,
        loggedAt: values.loggedAt,
        pipelineRequestId: values.pipelineRequestId ?? null,
        expiresAt: sql`now() + interval '30 minutes'`,
      },
    })
    .returning({ id: pendingAnalyses.id });
}

/**
 * Stamp the meal, then stage it, inside ONE {@link PERSIST_DEADLINE_MS}: the
 * route's 60 s ends right after the pipeline's 45 s plus this budget.
 *
 * The stamp is awaited on its own, so a stamp that times out, or that the
 * client outlives, writes nothing. Returns null when the client left.
 */
export async function stampAndStage(
  run: { resolveLoggedAt: () => Promise<Date>; signal: AbortSignal },
  values: Omit<StagePendingAnalysis, 'loggedAt'>
): Promise<{ analysisId: string; loggedAt: Date } | null> {
  const deadline = Date.now() + PERSIST_DEADLINE_MS;
  const loggedAt = await withDeadline(
    run.resolveLoggedAt(),
    PERSIST_DEADLINE_MS
  );
  if (run.signal.aborted) return null;
  const left = deadline - Date.now();
  if (left <= 0) throw Errors.pipelineTimeout();
  const [inserted] = await withDeadline(
    upsertPendingAnalysis({ ...values, loggedAt }),
    left
  );
  return { analysisId: inserted.id, loggedAt };
}
