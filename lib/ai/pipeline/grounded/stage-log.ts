/**
 * `pipeline_stage_logs` wrapper for the grounded run's four stages.
 *
 * Every stage (decomposition, matching, nutrition, assembly) runs inside
 * `withStageLogV2` so the admin `requests/[id]` timeline shows the same rows
 * for a v2 run that it shows for a v1 one.
 */
import { randomUUID } from 'node:crypto';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { logStage } from '@/lib/ai/pipeline/telemetry/trace';

/**
 * Wrap a v2 stage with optional `pipeline_stage_logs` persistence. When
 * `traceContext` is present, mirrors v1's `withStageLog` semantics so the
 * admin requests/[id] timeline populates for v2 runs. When absent, the fn
 * runs without any DB overhead.
 *
 * Errors are logged with status='error' before re-throwing so the parent
 * handler can map to a non-food / parse_error response.
 */
export async function withStageLogV2<T>(
  trace: AnalyzeMealTraceContext | undefined,
  stage: 'decomposition' | 'matching' | 'nutrition' | 'assembly',
  stageIndex: number,
  inputJson: unknown,
  fn: (ctx: { stageLogId: string }) => Promise<T>
): Promise<T> {
  if (!trace) return fn({ stageLogId: '' });
  const stageLogId = randomUUID();
  const t0 = Date.now();
  try {
    const result = await fn({ stageLogId });
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: result,
      status: 'success',
      durationMs: Date.now() - t0,
    });
    return result;
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    logStage({
      db: trace.db,
      requestId: trace.requestId,
      stageLogId,
      stage,
      stageIndex,
      inputJson,
      outputJson: null,
      status: 'error',
      error: message,
      durationMs: Date.now() - t0,
    });
    throw e;
  }
}
