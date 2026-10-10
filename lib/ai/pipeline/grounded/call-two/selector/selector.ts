/**
 * The candidate selector: one small LLM call per ingredient, beside Call 2,
 * that ranks the same candidates Call 2 sees, judged only against the user's
 * own words. Its pick replaces Call 2's only when the two
 * rows share a state (raw/cooked), so the grams Call 2 estimated keep their
 * basis, and Call 2's macros are rescaled to the new row. A "none" from Call 2
 * is kept: its grams are as-eaten, and a raw or dry row would inflate them.
 *
 * Measured on the Meal Arena benchmark (ttr DEV-129): about +4–5.6 first pick
 * across three train runs, and part of the shipped test config.
 */
import { z } from 'zod';
import { readBooleanEnv } from '@/lib/ai/pipeline/config/feature-flags';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedEstimation,
  GroundedIngredientEstimate,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import { pairIngredientsWithGrounded } from '@/lib/ai/pipeline/resolve/verdicts';
import type {
  MatchCandidate,
  MealItemWithCandidates,
} from '@/lib/ai/prompts/build/grounded-candidates';
import type { GeminiClient, StreamOptions } from '@/lib/ai/provider/provider';
import { mapWithConcurrency } from '@/lib/core/async/map-with-concurrency';
import { SELECTOR_SYSTEM_PROMPT, selectorUserMessage } from './prompt';

/** How long the selector may run past Call 2 before its open calls are dropped. */
const GRACE_MS = 3_000;
/** Selector calls in flight at once, so a large meal cannot crowd out Call 2. */
const CONCURRENCY = 6;

/** `CANDIDATE_SELECTOR_ENABLED=false` turns the selector off (Call 2 alone picks). */
export function isCandidateSelectorEnabled(): boolean {
  return readBooleanEnv('CANDIDATE_SELECTOR_ENABLED', true);
}

/**
 * Start one selector call per ingredient with two or more candidates. Call
 * `settle(deadlineAt)` after Call 2: it waits up to `GRACE_MS`, and never past
 * Call 2's own stage deadline, for the calls still open, aborts the rest, and
 * returns the picks by flat ingredient index.
 */
export function startCandidateSelector(args: {
  gemini: GeminiClient;
  model: string;
  mealText: string;
  mealItems: MealItemWithCandidates[];
  onAttemptComplete?: StreamOptions['onAttemptComplete'];
}): {
  settle: (deadlineAt: number) => Promise<Map<number, string>>;
  abort: () => void;
} {
  const controller = new AbortController();
  const picks = new Map<number, string>();
  const choices = args.mealItems
    .flatMap((mi) => mi.ingredients.map((ing) => ({ ing, dish: mi.mealItem })))
    .map((entry, flat) => ({ ...entry, flat }))
    .filter(({ ing }) => ing.candidates.length >= 2);
  const ask = async ({ ing, dish, flat }: (typeof choices)[number]) => {
    if (controller.signal.aborted) return;
    const ids = ing.candidates.map((c) => c.id);
    const out = await args.gemini.generateStructuredOutput(
      {
        schema: z.object({
          ranking: z.array(z.enum([ids[0], ...ids.slice(1), 'none'])),
        }),
        systemPrompt: SELECTOR_SYSTEM_PROMPT,
        userMessage: selectorUserMessage(args.mealText, ing, dish),
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
  };
  const done = mapWithConcurrency(choices, ask, CONCURRENCY).then((results) => {
    const failed = results.filter((r) => r.status === 'rejected').length;
    if (failed > 0 && !controller.signal.aborted)
      console.warn(`[selector] ${failed} of ${choices.length} calls failed`);
  });

  return {
    async settle(deadlineAt) {
      const wait = Math.max(0, Math.min(GRACE_MS, deadlineAt - Date.now()));
      let timer: ReturnType<typeof setTimeout> | undefined;
      await Promise.race([
        done,
        new Promise((resolve) => {
          timer = setTimeout(resolve, wait);
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
      if (!ground || !pick || !current || current === pick) return;
      const rowOf = (id: string) => candidates[flat]?.find((c) => c.id === id);
      const from = rowOf(current);
      const to = rowOf(pick);
      if (!from || !to || !massEquivalent(from, to)) return;
      ground.selectedCandidateId = pick;
      rescaleMacros(ground, from, to);
      overrides++;
    }
  );
  return { grounded, overrides };
}

/** Points of inedible share two rows may differ by and still share grams. */
const REFUSE_TOLERANCE = 5;

/**
 * Call 2's grams (`grossG`, `refusePct`) are scoped to its row: the same
 * state (raw/cooked) and the same inedible share (bone-in vs boneless), so
 * only a row matching both can take them over.
 */
function massEquivalent(from: MatchCandidate, to: MatchCandidate): boolean {
  return (
    from.dbState === to.dbState &&
    Math.abs((from.inediblePct ?? 0) - (to.inediblePct ?? 0)) <=
      REFUSE_TOLERANCE
  );
}

const MACRO_FIELDS = [
  ['proteinG', 'per100gProteinG'],
  ['carbohydrateG', 'per100gCarbohydrateG'],
  ['fatG', 'per100gFatG'],
] as const;

/**
 * Call 2 wrote its macro triples for the row it picked: that row's value at
 * Call 2's edible mass, plus Call 2's own adjustments (frying oil, prep notes).
 * Move the base to the new row and keep the adjustment as the same offset,
 * so an additive frying oil is not multiplied by the new row's density.
 */
function rescaleMacros(
  ground: GroundedIngredientEstimate,
  from: MatchCandidate,
  to: MatchCandidate
): void {
  const edibleG = ground.grossG * (1 - (ground.refusePct ?? 0) / 100);
  for (const [field, per100] of MACRO_FIELDS) {
    const before = from[per100];
    const after = to[per100];
    if (before == null || after == null) continue;
    const shift = ((after - before) * edibleG) / 100;
    const t = ground[field];
    const move = (v: number) => Math.max(0, v + shift);
    ground[field] = { low: move(t.low), mid: move(t.mid), high: move(t.high) };
  }
}
