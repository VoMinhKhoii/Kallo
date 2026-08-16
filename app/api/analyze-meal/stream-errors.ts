import type { StreamErrorEvent } from '@/lib/ai/streaming';
import { isAppError } from '@/lib/errors/app-error';

/**
 * Map a thrown value to a terminal SSE `error` event.
 *
 * A structured `AppError` (e.g. `PIPELINE_TIMEOUT` from the persist deadline)
 * carries its own code/message/retryable, so we surface those verbatim — the
 * client then shows an accurate, retryable message instead of a generic one.
 * Everything else falls back to internal/rate-limit heuristics.
 */
export function toStreamErrorEvent(error: unknown): StreamErrorEvent {
  if (isAppError(error)) {
    return {
      type: 'error',
      code: error.code.toLowerCase(),
      message: error.userMessage,
      retryable: error.retryable,
    };
  }

  const errorMessage =
    error instanceof Error ? error.message : 'Failed to process meal';
  const isRateLimit = errorMessage.includes('429');

  return {
    type: 'error',
    code: isRateLimit ? 'rate_limit' : 'internal',
    message: isRateLimit
      ? 'Rate limited — please wait a moment and try again'
      : 'Failed to process meal',
    retryable: !isRateLimit,
  };
}
