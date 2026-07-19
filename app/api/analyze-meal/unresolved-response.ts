/**
 * Terminal SSE outcomes for a v2 analysis whose completeness gate returned
 * `unresolved` — either a retryable partial-failure error (transient Call-2
 * chunk failure) or a precise clarify question. Returns true when the
 * outcome was emitted and the route should stop (nothing persists).
 */

import { getTranslations } from 'next-intl/server';
import { logPipelineEnd } from '@/lib/ai/pipeline/telemetry/logging';
import type { StreamEvent } from '@/lib/ai/streaming';
import type { PipelineUnresolved } from '@/lib/ai/types';
import type { db as appDb } from '@/lib/db';

export async function emitUnresolvedOutcome(args: {
  unresolved: PipelineUnresolved;
  locale: string;
  emit: (event: StreamEvent) => void;
  requestId: string;
  db: typeof appDb;
  startTime: number;
  promptVersionsUsed: Record<string, string> | null;
}): Promise<void> {
  const { unresolved, emit } = args;

  if (unresolved.reason === 'processing_incomplete') {
    // A Call-2 chunk failed after retries — transient infra, not a gap in
    // the user's input. A clarify question here would ask about a portion
    // the user already stated; emit a retryable error instead.
    logPipelineEnd(
      args.requestId,
      'error',
      Date.now() - args.startTime,
      args.db,
      'chunk_failure',
      args.promptVersionsUsed
    );
    emit({
      type: 'error',
      code: 'partial_analysis_failure',
      message:
        'Part of your meal could not be analyzed just now. Please try again.',
      retryable: true,
    });
    return;
  }

  const tClarify = await getTranslations({
    locale: args.locale,
    namespace: 'logging.clarify',
  });
  const question =
    unresolved.reason === 'ambiguous_food'
      ? tClarify('food', {
          ingredient: unresolved.ingredientName,
          mealItem: unresolved.mealItemName,
        })
      : tClarify('portion', {
          ingredient: unresolved.ingredientName,
          mealItem: unresolved.mealItemName,
        });
  emit({ type: 'clarify', question, reason: unresolved.reason });
  logPipelineEnd(
    args.requestId,
    'success',
    Date.now() - args.startTime,
    args.db,
    undefined,
    args.promptVersionsUsed
  );
}
