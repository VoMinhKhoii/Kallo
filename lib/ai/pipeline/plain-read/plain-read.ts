/**
 * Run the plain read beside the pipeline and apply the hold / seeing rescue
 * afterwards (`apply()`).
 *
 * Started with the analysis so it costs no wait on most meals (Sonnet's read:
 * p50 2.1 s, p99 5.5 s, against a 6.7 s p50 analysis). `settle()` waits at most
 * `GRACE_MS` past the pipeline, then aborts it and returns null — the meal is
 * then shown as computed. A read that fails the sanity gate is null too.
 */
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import type { PipelineResult } from '@/lib/ai/types/result';
import { safeError } from '@/lib/core/errors/safe-error';
import { type HoldResult, holdToPlainRead } from './hold';
import {
  PLAIN_READ_MODEL,
  PLAIN_READ_SYSTEM_PROMPT,
  type PlainRead,
  type PlainReadProfile,
  plainReadSchema,
  plainReadUserMessage,
} from './prompt';
import { runSeeingRescue, shouldRunSeeingRescue } from './rescue/rescue';

/** How long the read may run past the pipeline before the meal ships without it. */
export const GRACE_MS = 2_000;
/** A meal total outside this range is a broken read, not a meal. */
const MIN_READ_KCAL = 10;
export const MAX_READ_KCAL = 8_000;
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
  profile: PlainReadProfile;
  /** The request's signal: a client hang-up cancels the read at once. */
  signal: AbortSignal;
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
  onRescueAttemptComplete?: StreamOptions['onAttemptComplete'];
}): {
  settle: () => Promise<PlainRead | null>;
  apply: (raw: PipelineResult) => Promise<HoldResult | null>;
  abort: () => void;
} {
  const controller = new AbortController();
  const cancel = () => controller.abort();
  if (args.signal.aborted) cancel();
  else args.signal.addEventListener('abort', cancel, { once: true });
  // Started inside a promise chain so even a synchronous throw from the
  // client lands in `.catch` below: the read must never fail the meal.
  const read: Promise<PlainRead | null> = Promise.resolve()
    .then(() =>
      args.gemini.generateStructuredOutput(
        {
          schema: plainReadSchema,
          systemPrompt: PLAIN_READ_SYSTEM_PROMPT,
          userMessage: plainReadUserMessage(args.mealText, args.profile),
          model: PLAIN_READ_MODEL,
          abortSignal: controller.signal,
        },
        args.onAttemptComplete
          ? { onAttemptComplete: args.onAttemptComplete }
          : undefined
      )
    )
    .then((answer) => (usableReadKcal(answer) == null ? null : answer))
    .catch((err) => {
      if (!controller.signal.aborted) {
        console.warn('[plain-read] read failed:', safeError(err));
      }
      return null;
    });

  async function settle(): Promise<PlainRead | null> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    let onAbort: (() => void) | undefined;
    const settled = await Promise.race([
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
    return settled;
  }

  return {
    settle,
    async apply(raw: PipelineResult): Promise<HoldResult | null> {
      const settledRead = await settle();
      if (args.signal.aborted) return null;
      const hold = holdToPlainRead(raw, { read: settledRead });
      if (settledRead && shouldRunSeeingRescue(hold)) {
        const rescued = await runSeeingRescue({
          raw,
          read: settledRead,
          hold,
          mealText: args.mealText,
          profile: args.profile,
          gemini: args.gemini,
          signal: args.signal,
          onAttemptComplete: args.onRescueAttemptComplete,
        });
        if (args.signal.aborted) return null;
        if (rescued) return rescued;
      }
      return hold;
    },
    abort: () => {
      args.signal.removeEventListener('abort', cancel);
      cancel();
    },
  };
}
