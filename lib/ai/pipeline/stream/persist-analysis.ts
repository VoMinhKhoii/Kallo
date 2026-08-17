import { sql } from 'drizzle-orm';
import { db } from '@/lib/infra/db';
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
        expiresAt: sql`now() + interval '30 minutes'`,
      },
    })
    .returning({ id: pendingAnalyses.id });
}
