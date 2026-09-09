import type {
  GeminiClient,
  GeminiProviderConfig,
} from '@/lib/ai/provider/provider';
import type { StreamEvent } from '@/lib/ai/streaming/types';
import type { PipelineResult } from '@/lib/ai/types/result';
import type { UserContext } from '@/lib/ai/types/user-context';
import type { CheatIntensity } from '@/lib/core/types/cheat';
import type { ComposerPickRef } from '@/lib/domain/logging/relog/relog';
import type { db as appDb } from '@/lib/infra/db/client';

/** Everything the stream needs that the pre-stream phase already resolved. */
export interface AnalysisStreamContext {
  /** Aborted when the client hangs up. */
  signal: AbortSignal;
  db: typeof appDb;
  /** Parent trace row, already inserted so child spans can FK against it. */
  requestId: string;
  userId: string;
  message: string;
  userContext: UserContext;
  loggedAt: Date;
  attemptId?: string;
  geminiConfig: GeminiProviderConfig;
  mode: 'precise' | 'cheat';
  cheatType?: string;
  clarifyAnswer?: string;
  cheatIntensity?: CheatIntensity;
  refs?: ComposerPickRef[];
  /**
   * What the saved meal is LABELLED with when relog picks are in play — the
   * user's sentence with the `/` markers stripped, in the order they typed it.
   * Absent (older clients) the label is rebuilt from `message` + the resolved
   * dish names, which appends the picks and reorders the sentence.
   */
  displayText?: string;
  /**
   * Folds the user's relog picks into a finished pipeline result.
   *
   * Injected rather than imported: resolving the picks goes through
   * `lib/actions/meals/relog/`, and `lib/ai/` sits below the actions layer —
   * importing upward would invert the dependency order in ARCHITECTURE.md.
   */
  mergeRelogRefs: (
    aiResult: PipelineResult,
    refs: ComposerPickRef[],
    userId: string
  ) => Promise<{ result: PipelineResult; dishNames: string[] }>;
}

/** One in-flight submission: the request context plus this run's own state. */
export interface StreamRun {
  emit: (event: StreamEvent) => void;
  ctx: AnalysisStreamContext;
  gemini: GeminiClient;
  /** Wall clock at the first stream event, for the `pipeline_requests` duration. */
  startTime: number;
  /** Filled in by the pipeline as prompts are chosen; read back for telemetry. */
  promptVersionsUsed: Map<string, string>;
}
