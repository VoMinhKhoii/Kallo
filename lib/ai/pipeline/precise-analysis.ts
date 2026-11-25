/**
 * A typed meal's precise analysis as the app shows it: the pipeline, with the
 * plain read run beside it, and the result held near that read
 * (`plain-read/hold.ts`). No streaming framing, relog picks or persistence:
 * the app's precise branch (`stream/precise-branch.ts`) adds those around this,
 * and offline callers (the SEO page capture) call this directly, so a number
 * they publish is the number the app would show for the same meal.
 */
import {
  type AnalyzeMealTraceContext,
  analyzeMeal,
} from '@/lib/ai/pipeline/analyze-meal';
import type { AnalyzeMealV2Options } from '@/lib/ai/pipeline/grounded/orchestrator';
import {
  type HoldResult,
  holdToPlainRead,
} from '@/lib/ai/pipeline/plain-read/hold';
import { startPlainRead } from '@/lib/ai/pipeline/plain-read/plain-read';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineResponse } from '@/lib/ai/types/result';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { AppDb } from '@/lib/infra/db/client';

export interface PreciseAnalysis {
  /** The pipeline's response; on success its data is already held. */
  response: PipelineResponse;
  /** The hold applied, or null when there was nothing to hold (a failed or
   *  unresolved run, or the caller hung up). */
  hold: HoldResult | null;
}

export async function runPreciseAnalysis(args: {
  rawInput: string;
  userContext: UserContext;
  db: AppDb;
  gemini: GeminiClient;
  /** A hang-up cancels the read at once and skips the hold. */
  signal: AbortSignal;
  onEvent?: (event: StreamEvent) => void;
  traceContext?: AnalyzeMealTraceContext;
  onPlainReadAttemptComplete?: StreamOptions['onAttemptComplete'];
  onDiagnostics?: AnalyzeMealV2Options['onDiagnostics'];
}): Promise<PreciseAnalysis> {
  const plainRead = startPlainRead({
    gemini: args.gemini,
    mealText: args.rawInput,
    profile: args.userContext,
    signal: args.signal,
    onAttemptComplete: args.onPlainReadAttemptComplete,
  });
  // Every exit below, early or not, ends the read.
  try {
    const response = await analyzeMeal(
      args.rawInput,
      args.userContext,
      args.db,
      args.gemini,
      args.onEvent,
      args.traceContext,
      { onDiagnostics: args.onDiagnostics }
    );
    if (args.signal.aborted || !response.success || response.unresolved) {
      return { response, hold: null };
    }
    const read = await plainRead.settle();
    // A hang-up while the read settled is not a missed read.
    if (args.signal.aborted) return { response, hold: null };
    const hold = holdToPlainRead(response.data, { read });
    return { response: { ...response, data: hold.result }, hold };
  } finally {
    plainRead.abort();
  }
}
