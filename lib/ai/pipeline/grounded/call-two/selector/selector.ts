/**
 * The candidate selector: one small LLM call per ingredient, beside Call 2,
 * that ranks the whole retrieval pool (`CARD_K`) while Call 2 sees only the
 * first `CALL_TWO_CANDIDATES`. Its pick replaces Call 2's when the two rows
 * share a state (raw/cooked), or when Call 2 picked none, so the grams Call 2
 * estimated keep their basis.
 *
 * Measured on the Meal Arena benchmark (ttr DEV-129): about +4–5.6 first pick
 * across three train runs, and part of the shipped test config.
 */
import { z } from 'zod';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type { GroundedEstimation } from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import type { MealItemWithCandidates } from '@/lib/ai/prompts/build/grounded-candidates';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import { SELECTOR_SYSTEM_PROMPT, selectorUserMessage } from './prompt';

/** Candidates per ingredient Call 2 sees; the selector ranks all of them. */
export const CALL_TWO_CANDIDATES = 8;
/** How long the selector may run past Call 2 before its open calls are dropped. */
const GRACE_MS = 3_000;

/** `CANDIDATE_SELECTOR_ENABLED=false` turns the selector off (Call 2 alone picks). */
export function isCandidateSelectorEnabled(): boolean {
  return readBooleanEnv('CANDIDATE_SELECTOR_ENABLED', true);
}

/** The meal items as Call 2 sees them: each ingredient's first candidates. */
export function callTwoView(
  mealItems: MealItemWithCandidates[]
): MealItemWithCandidates[] {
  return mealItems.map((mi) => ({
    ...mi,
    ingredients: mi.ingredients.map((ing) => ({
      ...ing,
      candidates: ing.candidates.slice(0, CALL_TWO_CANDIDATES),
    })),
  }));
}

/**
 * Start one selector call per ingredient with two or more candidates. Call
 * `settle()` after Call 2: it waits up to `GRACE_MS` for the calls still open,
 * aborts the rest, and returns the picks by flat ingredient index.
 */
export function startCandidateSelector(args: {
  gemini: GeminiClient;
  model: string;
  mealText: string;
  mealItems: MealItemWithCandidates[];
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): { settle: () => Promise<Map<number, string>>; abort: () => void } {
  const controller = new AbortController();
  const picks = new Map<number, string>();
  const ingredients = args.mealItems.flatMap((mi) => mi.ingredients);
  const jobs = ingredients.map(async (ing, flat) => {
    if (ing.candidates.length < 2) return;
    const ids = ing.candidates.map((c) => c.id);
    const out = await args.gemini.generateStructuredOutput(
      {
        schema: z.object({
          ranking: z.array(z.enum([ids[0], ...ids.slice(1), 'none'])),
        }),
        systemPrompt: SELECTOR_SYSTEM_PROMPT,
        userMessage: selectorUserMessage(args.mealText, ing),
        model: args.model,
        temperature: 0,
        abortSignal: controller.signal,
      },
      args.onAttemptComplete
        ? { onAttemptComplete: args.onAttemptComplete }
        : undefined
    );
    const best = out.ranking.find((id) => id !== 'none');
    if (best) picks.set(flat, best);
  });
  const done = Promise.allSettled(jobs).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0 && !controller.signal.aborted)
      console.warn(`[selector] ${failed} of ${jobs.length} calls failed`);
  });

  return {
    async settle() {
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        done,
        new Promise((resolve) => {
          timer = setTimeout(resolve, GRACE_MS);
        }),
      ]);
      clearTimeout(timer);
      controller.abort();
      return picks;
    },
    abort: () => controller.abort(),
  };
}

/**
 * Apply the selector's picks to Call 2's estimation (a copy is returned).
 * Ingredients pair with their estimates exactly as resolution pairs them.
 */
export function applySelection(args: {
  decomposition: MealDecompositionV2;
  grounded: GroundedEstimation;
  mealItems: MealItemWithCandidates[];
  picks: Map<number, string>;
}): { grounded: GroundedEstimation; overrides: number } {
  const grounded = structuredClone(args.grounded);
  const candidates = args.mealItems.flatMap((mi) =>
    mi.ingredients.map((ing) => ing.candidates)
  );
  let overrides = 0;
  pairIngredientsWithGrounded(args.decomposition, grounded).forEach(
    ({ ground }, flat) => {
      const pick = args.picks.get(flat);
      const current = ground?.selectedCandidateId;
      if (!ground || !pick || current === pick) return;
      const stateOf = (id: string) =>
        candidates[flat]?.find((c) => c.id === id)?.dbState;
      if (current && current !== 'none' && stateOf(current) !== stateOf(pick))
        return;
      ground.selectedCandidateId = pick;
      delete ground.rejectReason;
      overrides++;
    }
  );
  return { grounded, overrides };
}
