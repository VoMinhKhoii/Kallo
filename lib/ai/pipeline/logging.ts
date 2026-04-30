import { eq } from 'drizzle-orm';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import { pipelineRequests } from '@/lib/db/schema';
import type { UserContext } from '../types';

/**
 * Fire-and-forget INSERT into pipeline_requests before the pipeline starts.
 * Generates the requestId synchronously (crypto.randomUUID) so the caller
 * never awaits the DB write — the INSERT is fully fire-and-forget.
 * Returns the pre-generated requestId for correlation with logPipelineEnd.
 */
export function logPipelineStart(
  userId: string,
  rawInput: string,
  userContext: UserContext,
  db: PostgresJsDatabase<any>
): string {
  const requestId = crypto.randomUUID();

  db.insert(pipelineRequests)
    .values({
      id: requestId,
      userId,
      rawInput,
      userContextJson: userContext as unknown as Record<string, unknown>,
    })
    .catch((err) => {
      console.error('[pipeline-logging] Failed to create request log:', err);
    });

  return requestId;
}

/**
 * Fire-and-forget UPDATE to record pipeline outcome.
 * No-op if requestId is null (DB write failed during start).
 * Never blocks the response — all errors are caught and logged only.
 *
 * @param promptVersionsUsed - When non-null, persisted on the row so replays
 *   can reproduce the exact prompt versions used in this request.
 */
export function logPipelineEnd(
  requestId: string | null,
  status: 'success' | 'error',
  durationMs: number,
  db: PostgresJsDatabase<any>,
  error?: string,
  promptVersionsUsed?: Record<string, string> | null
): void {
  if (!requestId) return;

  const extra = promptVersionsUsed ? { promptVersionsUsed } : {};

  db.update(pipelineRequests)
    .set({ status, durationMs, error: error ?? null, ...extra })
    .where(eq(pipelineRequests.id, requestId))
    .catch((err) => {
      console.error('[pipeline-logging] Failed to update request log:', err);
    });
}
