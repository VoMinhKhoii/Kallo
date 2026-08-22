'use server';

import { resolveRelogSources } from '@/lib/actions/meals/relog/resolve-sources';
import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import { upsertPendingAnalysis } from '@/lib/ai/pipeline/stream/persist-analysis';
import {
  type StageRelogAnalysisInput,
  stageRelogAnalysisSchema,
} from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import type { ParsedMeal } from '@/lib/core/types/meal';
import { buildRelogPipelineResult } from '@/lib/domain/logging/relog/build-relog-pipeline-result';
import { buildRelogRawInput } from '@/lib/domain/logging/relog/relog';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import { db } from '@/lib/infra/db/client';
import {
  RELOG_WRITE_ROUTE,
  withRelogGuard,
} from '@/lib/infra/rate-limit/relog-guard';

/**
 * WEB pure-relog: stage the picked dishes as a `pending_analyses` row so they
 * land in the SAME editable review card AI meals use, then let the ordinary
 * confirm path save them. Deterministic — no AI pipeline, no provider spend, no
 * billing gate or analysis guard (those defend AI cost, which this never
 * incurs). Mirrors `stageCheatRepeatAction`, which likewise stages a pending
 * card from a plain server action without streaming.
 *
 * BOTH clients go through here: the web composer calls this action directly and
 * the Flutter composer posts to `/api/v1/meals/relog/stage`, so a pure-relog
 * submit produces the same editable card on either surface. The instant-save
 * `relogMealItemsAction` remains for callers that want a committed meal with no
 * review step.
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

  // Throttled HERE, not at the route: the web composer calls this action
  // directly. This path opens a transaction holding `FOR UPDATE` on the source
  // meals and writes a fat `pending_analyses` row, so an unthrottled caller
  // starves the pool for every other surface.
  //
  // The SAME key as `relogMealItemsAction`, deliberately. `checkAnalysisGuards`
  // keys its window and in-flight counters on this string, so a distinct one
  // would give a user an independent `concurrentUser: 1` budget per write
  // action — two simultaneous transactions, each holding `FOR UPDATE` on its
  // source meals. `DB_POOL_MAX` defaults to 2, so that is the whole pool, which
  // is precisely the starvation the guard exists to prevent.
  return withRelogGuard('write', RELOG_WRITE_ROUTE, user.id, async () => {
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
  });
}
