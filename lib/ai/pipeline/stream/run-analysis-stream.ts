/**
 * The `/api/analyze-meal` SSE state machine.
 *
 * One pass over a single meal submission: pick the cheat or precise branch and
 * frame it. What lives here is the part shared by both — the abort check, the
 * provider client, the run's telemetry state, and the guarantee that nothing
 * escapes as a rejection.
 *
 *   • every stage re-checks `signal.aborted` and returns SILENTLY, because a
 *     hung-up client has no reader for anything we would emit;
 *   • errors never propagate: anything thrown becomes a terminal `error` event,
 *     so the caller's `finally` can release its guard and close the stream
 *     unconditionally.
 *
 * The ordering rules WITHIN an outcome live with that outcome, in
 * `cheat-branch.ts` and `precise-branch.ts`.
 */
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import { createGeminiClient } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming';
import { runCheatBranch } from './cheat-branch';
import { runPreciseBranch } from './precise-branch';
import { toStreamErrorEvent } from './stream-errors';
import type { AnalysisStreamContext } from './types';

export async function runAnalysisStream({
  emit,
  ctx,
}: {
  emit: (event: StreamEvent) => void;
  ctx: AnalysisStreamContext;
}): Promise<void> {
  const startTime = Date.now();
  const promptVersionsUsed = new Map<string, string>();

  try {
    if (ctx.signal.aborted) {
      return;
    }

    const run = {
      emit,
      ctx,
      gemini: createGeminiClient(ctx.geminiConfig),
      startTime,
      promptVersionsUsed,
    };

    await (ctx.mode === 'cheat' ? runCheatBranch(run) : runPreciseBranch(run));
  } catch (error) {
    console.error('[analyze-meal] Stream error:', error);
    const pvu =
      promptVersionsUsed.size > 0
        ? Object.fromEntries(promptVersionsUsed)
        : null;
    logPipelineEnd(
      ctx.requestId,
      'error',
      Date.now() - startTime,
      ctx.db,
      error instanceof Error ? error.message : 'unknown',
      pvu
    );

    emit(toStreamErrorEvent(error));
  }
}
