'use server';

import { resolveComposerPicks } from '@/lib/actions/meals/relog/resolve-picks';
import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import { upsertPendingAnalysis } from '@/lib/ai/pipeline/stream/persist-analysis';
import {
  type StageRelogAnalysisInput,
  stageRelogAnalysisSchema,
} from '@/lib/api/contracts/meals';
import { getUtcInstantForLocalDate } from '@/lib/core/date/local-day';
import type { ParsedMeal } from '@/lib/core/types/meal';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { buildPickPipelineResult } from '@/lib/domain/logging/relog/build-relog-pipeline-result';
import {
  buildRelogRawInput,
  relogRefsOf,
} from '@/lib/domain/logging/relog/relog';
import { requireAuthAndProfile } from '@/lib/infra/auth/session';
import {
  RELOG_WRITE_ROUTE,
  withRelogGuard,
} from '@/lib/infra/rate-limit/relog-guard';

/**
 * Pure PICKS: stage what the composer staged — past dishes, scanned products,
 * or both — as a `pending_analyses` row so they
 * land in the SAME editable review card AI meals use, then let the ordinary
 * confirm path save them. Deterministic — no AI pipeline, no provider spend, so
 * no analysis guard in the AI-cost sense. It IS billing-gated: relog is a
 * Premium-card feature, so `assertFeatureAccess(..., 'relog')` runs right after
 * auth and BEFORE the rate guard — a locked user must not spend rate budget on
 * a call that can only end in 402. Mirrors `stageCheatRepeatAction`, which
 * likewise stages a pending card from a plain server action without streaming.
 *
 * BOTH clients go through here: the web composer calls this action directly and
 * the Flutter composer posts to `/api/v1/meals/relog/stage`, so a pure-relog
 * submit produces the same editable card on either surface. The instant-save
 * `relogMealItemsAction` remains for callers that want a committed meal with no
 * review step.
 *
 * `resolveComposerPicks` owns the resolution — including the short transaction
 * holding `FOR UPDATE` on the source meals, without which a concurrent
 * split-share could halve a source's `meal_items` between the eligibility check
 * and the row read. It also resolves the composer's OTHER kind of pick, a
 * scanned product, so a scan-only submit lands as the same editable card.
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
  const { user, profile } = await requireAuthAndProfile();
  // Premium gate BEFORE the rate guard: a locked user must not burn their
  // (shared) relog write budget on a call that can only end in 402.
  //
  // Only when a RELOG pick is actually in the list. Barcode logging carries no
  // entitlement of its own anywhere else in the product (`/api/v1/barcode/log`
  // gates nothing), so a scan-only submit arriving through this action must not
  // become the one barcode path behind the paywall.
  if (relogRefsOf(parsed.items).length > 0) {
    await assertFeatureAccess(
      { userId: user.id, profileCreatedAt: profile.createdAt },
      'relog'
    );
  }

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
    const picks = await resolveComposerPicks(user.id, parsed.items);

    const pipelineResult = buildPickPipelineResult(
      picks.items,
      picks.confidence
    );
    // The composer's own sentence when the client sent it: joining the resolved
    // names puts every scanned product after every relogged dish, whatever
    // order they were typed in.
    const rawInput = buildRelogRawInput(
      parsed.displayText ? [parsed.displayText] : picks.names
    );
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
