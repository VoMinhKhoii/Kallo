import { AsyncLocalStorage } from 'node:async_hooks';
import { attemptCostUsd } from './pricing';

/** One model attempt's token counts, as the provider layer reports them. */
export interface AttemptSpendTokens {
  inputTokens: number | null;
  outputTokens: number | null;
  cachedTokens: number | null;
  cacheWriteTokens: number | null;
  thoughtTokens: number | null;
}

/** Receives the cost of every model attempt made inside `runMetered`. */
export interface SpendMeter {
  /** `null`: the attempt reported no usage, or its model is unpriced. */
  record(costUsd: number | null): void;
}

const meters = new AsyncLocalStorage<SpendMeter>();

/**
 * Run `work` so every model attempt it makes — however deep, and in anything
 * it starts without awaiting (dish rescue, a chunked Call 2) — is reported to
 * `meter`. A nested `runMetered` takes over for its own work, which is how a
 * shadow run started inside a meal is billed to the shadow and not the meal.
 */
export function runMetered<T>(
  meter: SpendMeter,
  work: () => Promise<T>
): Promise<T> {
  return meters.run(meter, work);
}

/**
 * Report one finished model attempt to the meter in scope, if any. Called by
 * the provider layer for every attempt, so no pipeline stage can spend money
 * the brake does not see. Same pricing rule as the budget rows: no usage at
 * all is an unknown cost, not a free one.
 */
export function meterAttemptSpend(
  model: string,
  tokens: AttemptSpendTokens
): void {
  const meter = meters.getStore();
  if (!meter) return;

  meter.record(
    tokens.inputTokens == null && tokens.outputTokens == null
      ? null
      : attemptCostUsd(model, {
          inputTokens: tokens.inputTokens ?? 0,
          cachedTokens: tokens.cachedTokens ?? 0,
          cacheWriteTokens: tokens.cacheWriteTokens ?? 0,
          outputTokens: tokens.outputTokens ?? 0,
          thoughtTokens: tokens.thoughtTokens ?? 0,
        })
  );
}
