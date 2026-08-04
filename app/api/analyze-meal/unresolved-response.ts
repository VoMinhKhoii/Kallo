/**
 * Terminal SSE outcome for a v2 analysis whose completeness gate returned
 * `unresolved`. Only one case reaches here now: a transient Call-2 chunk
 * failure. There is no portion ask-back — a shaky estimate ships and the user
 * corrects it with the visual portion picker.
 */

import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import type { StreamEvent } from '@/lib/ai/streaming';
import type { db as appDb } from '@/lib/db';

export async function emitPartialFailure(args: {
  emit: (event: StreamEvent) => void;
  requestId: string;
  db: typeof appDb;
  startTime: number;
  promptVersionsUsed: Record<string, string> | null;
}): Promise<void> {
  // A Call-2 chunk failed after retries — transient infra, not a gap in the
  // user's input. Emit a retryable error; nothing is staged for confirm.
  logPipelineEnd(
    args.requestId,
    'error',
    Date.now() - args.startTime,
    args.db,
    'chunk_failure',
    args.promptVersionsUsed
  );
  args.emit({
    type: 'error',
    code: 'partial_analysis_failure',
    message:
      'Part of your meal could not be analyzed just now. Please try again.',
    retryable: true,
  });
}
