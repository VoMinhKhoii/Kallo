/**
 * Run the plain read beside the pipeline and collect its total afterwards.
 *
 * Started with the analysis so it costs no wait on most meals (Sonnet's read:
 * p50 2.1 s, p99 5.5 s, against a 6.7 s p50 analysis). `settle()` waits at most
 * `GRACE_MS` past the pipeline, then aborts it and returns null — the meal is
 * then shown as computed. A read that fails the sanity gate is null too.
 */
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import { safeError } from '@/lib/core/errors/safe-error';
import {
  PLAIN_READ_MODEL,
  PLAIN_READ_SYSTEM_PROMPT,
  type PlainRead,
  plainReadSchema,
  plainReadUserMessage,
} from './prompt';

/** How long the read may run past the pipeline before the meal ships without it. */
export const GRACE_MS = 2_000;
/** A meal total outside this range is a broken read, not a meal. */
const MIN_READ_KCAL = 10;
const MAX_READ_KCAL = 8_000;
/** The listed foods must add up to the stated total within this share. */
const SUM_TOLERANCE = 0.25;

/** The read's total, or null when it is not a usable number. */
export function usableReadKcal(read: PlainRead): number | null {
  const total = read.totalKcal;
  if (!Number.isFinite(total)) return null;
  if (total < MIN_READ_KCAL || total > MAX_READ_KCAL) return null;
  // A total with no foods, or foods that do not add up to it, is not a read.
  const sum = read.foods.reduce((s, f) => s + f.kcal, 0);
  if (Math.abs(sum - total) > SUM_TOLERANCE * total) return null;
  return total;
}

export function startPlainRead(args: {
  gemini: GeminiClient;
  mealText: string;
  /** The request's signal: a client hang-up cancels the read at once. */
  signal: AbortSignal;
  /** Do not ask the model at all (a typed-weight meal); settles to null. */
  skip?: boolean;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): { settle: () => Promise<number | null>; abort: () => void } {
  if (args.skip) return { settle: async () => null, abort: () => {} };
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (args.signal.aborted) cancel();
  else args.signal.addEventListener('abort', cancel, { once: true });
  // Started inside a promise chain so even a synchronous throw from the
  // client lands in `.catch` below: the read must never fail the meal.
  const read: Promise<number | null> = Promise.resolve()
    .then(() =>
      args.gemini.generateStructuredOutput(
        {
          schema: plainReadSchema,
          systemPrompt: PLAIN_READ_SYSTEM_PROMPT,
          userMessage: plainReadUserMessage(args.mealText),
          model: PLAIN_READ_MODEL,
          abortSignal: controller.signal,
        },
        args.onAttemptComplete
          ? { onAttemptComplete: args.onAttemptComplete }
          : undefined
      )
    )
    .then(usableReadKcal)
    .catch((err) => {
      if (!controller.signal.aborted) {
        console.warn('[plain-read] read failed:', safeError(err));
      }
      return null;
    });

  return {
    async settle() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      let onAbort: (() => void) | undefined;
      const kcal = await Promise.race([
        read,
        new Promise<null>((resolve) => {
          timer = setTimeout(() => resolve(null), GRACE_MS);
          onAbort = () => resolve(null);
          if (controller.signal.aborted) onAbort();
          else controller.signal.addEventListener('abort', onAbort);
        }),
      ]);
      clearTimeout(timer);
      if (onAbort) controller.signal.removeEventListener('abort', onAbort);
      args.signal.removeEventListener('abort', cancel);
      cancel();
      return kcal;
    },
    abort: () => {
      args.signal.removeEventListener('abort', cancel);
      cancel();
    },
  };
}
