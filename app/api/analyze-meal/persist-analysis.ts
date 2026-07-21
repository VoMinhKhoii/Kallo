import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { pendingAnalyses } from '@/lib/db/schema';

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
