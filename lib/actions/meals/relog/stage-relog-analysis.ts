'use server';

import { upsertPendingAnalysis } from '@/app/api/analyze-meal/persist-analysis';
import { resolveRelogSources } from '@/lib/actions/meals/relog/resolve-sources';
import { toParsedMeal } from '@/lib/ai/mappers';
import {
  type StageRelogAnalysisInput,
  stageRelogAnalysisSchema,
} from '@/lib/api/contracts/meals';
import { requireAuthAndProfile } from '@/lib/auth';
import { getUtcInstantForLocalDate } from '@/lib/date/local-day';
import { db } from '@/lib/db';
import { buildRelogPipelineResult } from '@/lib/logging/relog/build-relog-pipeline-result';
import { buildRelogRawInput } from '@/lib/logging/relog/relog';
import type { ParsedMeal } from '@/lib/types/meal';

/**
 * WEB pure-relog: stage the picked dishes as a `pending_analyses` row so they
 * land in the SAME editable review card AI meals use, then let the ordinary
 * confirm path save them. Deterministic — no AI pipeline, no provider spend, no
 * billing gate or analysis guard (those defend AI cost, which this never
 * incurs). Mirrors `stageCheatRepeatAction`, which likewise stages a pending
 * card from a plain server action without streaming.
 *
 * The mobile client keeps the instant-save `relogMealItemsAction`; this is the
 * web replacement for that path.
 *
 * The resolve runs in a short transaction with `FOR UPDATE` on the source meals
 * (like the direct writer): without it, a concurrent split-share could halve a
 * source's `meal_items` and set `portion_factor < 1` between the eligibility
 * check and the row read, and we'd snapshot the halved rows under the full dish
 * name. The lock closes that window; the copied numbers are frozen into the
 * pending row, so nothing after commit can corrupt them.
 */
export async function stageRelogAnalysisAction(
  input: StageRelogAnalysisInput
): Promise<{
  analysisId: string;
  parsedMeal: ParsedMeal;
  rawInput: string;
  loggedAt: string;
}> {
  const parsed = stageRelogAnalysisSchema.parse(input);
  const { user } = await requireAuthAndProfile();

  const { dishes, sourceConfidences } = await db.transaction((tx) =>
    resolveRelogSources(tx, user.id, parsed.items, { lock: true })
  );

  const pipelineResult = buildRelogPipelineResult(dishes, sourceConfidences);
  const rawInput = buildRelogRawInput(dishes.map((d) => d.name));
  const loggedAt = getUtcInstantForLocalDate(
    parsed.loggedDate,
    parsed.timezoneOffset
  );

  const [inserted] = await upsertPendingAnalysis({
    userId: user.id,
    pipelineResult,
    rawInput,
    entryMode: 'precise',
    loggedAt,
    attemptId: parsed.attemptId,
  });

  return {
    analysisId: inserted.id,
    parsedMeal: toParsedMeal(pipelineResult),
    rawInput,
    loggedAt: loggedAt.toISOString(),
  };
}
