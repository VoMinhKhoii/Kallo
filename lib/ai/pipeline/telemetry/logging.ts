import { eq } from 'drizzle-orm';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db';
import { pipelineRequests } from '@/lib/infra/db/schema';

export interface LogPipelineStartArgs {
  userId: string;
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  /** When set, caller controls the requestId (used by replay). */
  requestId?: string;
  /** Marks the row as a dry-run replay of the given original request. */
  replayOfRequestId?: string;
  /** When true, persists the row with dry_run=true (no real Gemini call). */
  dryRun?: boolean;
}

/**
 * Awaitable INSERT into pipeline_requests before the pipeline starts.
 * Awaits the DB write so child trace inserts (stage_logs, llm_calls)
 * have a parent row to FK against.
 * Returns the requestId for correlation with logPipelineEnd.
 * Throws if the parent row cannot be created.
 */
export async function logPipelineStart(
  args: LogPipelineStartArgs
): Promise<string> {
  const id = args.requestId ?? crypto.randomUUID();

  try {
    await args.db.insert(pipelineRequests).values({
      id,
      userId: args.userId,
      rawInput: args.rawInput,
      userContextJson: args.userContext as unknown as Record<string, unknown>,
      ...(args.replayOfRequestId
        ? { replayOfRequestId: args.replayOfRequestId }
        : {}),
      ...(args.dryRun ? { dryRun: true } : {}),
    });
  } catch (err) {
    console.error('[pipeline-logging] Failed to create request log:', err);
    throw err;
  }

  return id;
}

/**
 * Awaitable UPDATE to record pipeline final state.
 * Use on the replay path where the redirect MUST land on a terminal-state row.
 * The production path keeps using the fire-and-forget logPipelineEnd.
 */
export async function setPipelineFinalState(args: {
  db: AppDb;
  requestId: string;
  status: 'success' | 'error';
  durationMs: number;
  errorMessage?: string;
  promptVersionsUsed?: Record<string, string> | null;
}): Promise<void> {
  await args.db
    .update(pipelineRequests)
    .set({
      status: args.status,
      durationMs: args.durationMs,
      error: args.errorMessage ?? null,
      promptVersionsUsed: args.promptVersionsUsed ?? null,
    })
    .where(eq(pipelineRequests.id, args.requestId));
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
  db: AppDb,
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
