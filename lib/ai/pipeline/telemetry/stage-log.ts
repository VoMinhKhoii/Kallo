import { randomUUID } from 'node:crypto';
import type { AnalyzeMealTraceContext } from '@/lib/ai/pipeline/analyze-meal';
import { logStage } from './trace';

export type StageName = 'decomposition' | 'matching' | 'nutrition' | 'assembly';

/**
 * Wraps a pipeline stage with logStage instrumentation. No-op when trace is undefined.
 */
export async function withStageLog<T>(
  trace: AnalyzeMealTraceContext | undefined,
  stage: StageName,
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
