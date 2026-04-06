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
 */
export function logPipelineEnd(
  requestId: string | null,
  status: 'success' | 'error',
  durationMs: number,
  db: PostgresJsDatabase<any>,
  error?: string
): void {
  if (!requestId) return;

  db.update(pipelineRequests)
    .set({ status, durationMs, error: error ?? null })
    .where(eq(pipelineRequests.id, requestId))
    .catch((err) => {
      console.error('[pipeline-logging] Failed to update request log:', err);
    });
}
