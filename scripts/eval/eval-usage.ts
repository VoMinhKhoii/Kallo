import { AsyncLocalStorage } from 'node:async_hooks';
import { costUsd, type TokenUsage } from '@/lib/ai/cost/pricing';
import type {
  GeminiAttemptMetadata,
  GeminiClient,
} from '@/lib/ai/provider/provider';
import type { EvalCaseUsage } from './eval-types';

/**
 * Per-case token capture for the eval harness. Every attempt the pipeline
 * makes (Call 1, Call 2, retries, chunks) is appended to the store of the case
 * that is running, so concurrent cases never mix their counts.
 */
const caseAttempts = new AsyncLocalStorage<TokenUsage[]>();

function record(metadata: GeminiAttemptMetadata) {
  caseAttempts.getStore()?.push({
    model: metadata.model,
    inputTokens: metadata.inputTokens,
    outputTokens: metadata.outputTokens,
    cachedTokens: metadata.cachedTokens,
    thoughtTokens: metadata.thoughtTokens,
  });
}

function chain(
  own?: (metadata: GeminiAttemptMetadata) => void
): (metadata: GeminiAttemptMetadata) => void {
  return (metadata) => {
    record(metadata);
    own?.(metadata);
  };
}

/** Wrap a client so its LLM attempts are counted against the running case. */
export function withUsageCapture(client: GeminiClient): GeminiClient {
  return {
    generateStructuredOutput: (params, opts) =>
      client.generateStructuredOutput(params, {
        ...opts,
        onAttemptComplete: chain(opts?.onAttemptComplete),
      }),
    generateStructuredOutputStream: (params, opts) =>
      client.generateStructuredOutputStream(params, {
        ...opts,
        onAttemptComplete: chain(opts?.onAttemptComplete),
      }),
    generateEmbedding: (text) => client.generateEmbedding(text),
    generateEmbeddingBatch: (texts) => client.generateEmbeddingBatch(texts),
  };
}

/**
 * Start counting for one case: calls made inside `run` land in `summary()`.
 * Attempts still in flight when a case times out keep landing in its store.
 */
export function createCaseUsage() {
  const attempts: TokenUsage[] = [];
  return {
    run: <T>(fn: () => Promise<T>) => caseAttempts.run(attempts, fn),
    summary: () => summarizeAttempts(attempts),
  };
}

/**
 * Observed USD per 1,000 cases — whole pipeline (Call 1 + Call 2 + retries),
 * or null when any case called a model without a rate on file.
 */
export function costPer1kCases(
  results: Array<{ usage: EvalCaseUsage }>
): number | null {
  if (results.length === 0) return null;
  let total = 0;
  for (const { usage } of results) {
    if (usage.costUsd == null) return null;
    total += usage.costUsd;
  }
  return (total / results.length) * 1000;
}

export function summarizeAttempts(attempts: TokenUsage[]): EvalCaseUsage {
  const sum = (pick: (a: TokenUsage) => number | null | undefined) =>
    attempts.reduce((total, a) => total + (pick(a) ?? 0), 0);
  const costs = attempts.map(costUsd);
  return {
    calls: attempts.length,
    inputTokens: sum((a) => a.inputTokens),
    outputTokens: sum((a) => a.outputTokens),
    cachedTokens: sum((a) => a.cachedTokens),
    thoughtTokens: sum((a) => a.thoughtTokens),
    costUsd: costs.some((c) => c == null)
      ? null
      : costs.reduce<number>((total, c) => total + (c ?? 0), 0),
  };
}
