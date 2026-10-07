import type { GenericLlmMessage } from '@/lib/ai/cache/chat-session';
import type { KeyPool } from './types';

export type FallbackProvider = 'claude' | 'openai';

export class KeyPoolExhaustedError extends Error {
  readonly nextAvailableInMs: number | null;

  constructor(nextAvailableInMs: number | null) {
    const hint =
      nextAvailableInMs != null
        ? ` Earliest key recovers in ${Math.ceil(nextAvailableInMs / 1000)}s.`
        : '';
    super(
      `All Gemini API keys in pool are currently quarantined or revoked.${hint}`
    );
    this.name = 'KeyPoolExhaustedError';
    this.nextAvailableInMs = nextAvailableInMs;
  }
}

export interface RouterExecutionOptions<T> {
  primaryPool: KeyPool;
  messages: GenericLlmMessage[];
  executePrimary: (key: string, messages: GenericLlmMessage[]) => Promise<T>;
  executeFallback?: (
    provider: FallbackProvider,
    messages: GenericLlmMessage[]
  ) => Promise<T>;
  fallbackProvider?: FallbackProvider;
  abortSignal?: AbortSignal;
  onRotation?: (event: {
    fromKey: string;
    toKey?: string;
    toFallback?: boolean;
    reason: string;
  }) => void;
}

function getErrorStatus(error: unknown): number | null {
  if (
    error &&
    typeof error === 'object' &&
    'status' in error &&
    typeof (error as { status?: unknown }).status === 'number'
  ) {
    return (error as { status: number }).status;
  }
  if (error instanceof Error) {
    const match = error.message.match(/\b(401|403|408|429|500|502|503|504)\b/);
    if (match) return Number.parseInt(match[1], 10);
    if (error.message.includes('RESOURCE_EXHAUSTED')) return 429;
    if (error.message.includes('API_KEY_INVALID')) return 401;
  }
  return null;
}

/**
 * Executes an AI call with automatic in-process key rotation and Tier-2 fallback.
 * Guarantees zero context loss by forwarding the complete normalized messages array.
 */
export async function executeWithFailover<T>(
  opts: RouterExecutionOptions<T>
): Promise<T> {
  const {
    primaryPool,
    messages,
    executePrimary,
    executeFallback,
    abortSignal,
  } = opts;
  const maxAttempts =
    Math.max(1, primaryPool.size()) + (executeFallback ? 1 : 0);

  let attempts = 0;

  while (attempts < maxAttempts) {
    if (abortSignal?.aborted) {
      throw abortSignal.reason instanceof Error
        ? abortSignal.reason
        : new DOMException('The operation was aborted', 'AbortError');
    }

    const acquired = primaryPool.acquireKey();

    if (acquired) {
      attempts++;
      try {
        const result = await executePrimary(acquired.key, messages);
        primaryPool.markSuccess(acquired.key);
        return result;
      } catch (err) {
        if (abortSignal?.aborted) {
          throw abortSignal.reason instanceof Error
            ? abortSignal.reason
            : new DOMException('The operation was aborted', 'AbortError');
        }

        const status = getErrorStatus(err);
        const errMsg = err instanceof Error ? err.message : String(err);

        if (status === 401 || status === 403) {
          primaryPool.markRevoked(acquired.key, errMsg);
          opts.onRotation?.({
            fromKey: acquired.key,
            reason: `Revoked (${status}): ${errMsg}`,
          });
          continue;
        }

        if (status === 429) {
          primaryPool.markQuarantine(acquired.key, errMsg);
          opts.onRotation?.({
            fromKey: acquired.key,
            reason: `429 Quota Exceeded`,
          });
          continue;
        }

        // For non-quota errors (e.g. 400 Bad Request, ZodError), do not quarantine key
        throw err;
      }
    }

    // Primary pool is exhausted (all keys in cooldown or revoked)
    if (executeFallback) {
      const fallbackTarget = opts.fallbackProvider ?? 'claude';
      opts.onRotation?.({
        fromKey: 'pool_exhausted',
        toFallback: true,
        reason: 'All primary keys quarantined; routing to fallback',
      });
      return await executeFallback(fallbackTarget, messages);
    }

    const snapshot = primaryPool.getSnapshot();
    throw new KeyPoolExhaustedError(snapshot.nextAvailableInMs);
  }

  const snapshot = primaryPool.getSnapshot();
  throw new KeyPoolExhaustedError(snapshot.nextAvailableInMs);
}
