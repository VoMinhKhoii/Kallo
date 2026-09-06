import { and, eq } from 'drizzle-orm';
import {
  buildPersistedMeal,
  inferMealSlot,
} from '@/lib/actions/logging/persisted-meal';
import type {
  CheatSliderLevels,
  CheatSliderSpec,
  CheatSlidersPersisted,
} from '@/lib/core/types/cheat';
import { getBillingConfig } from '@/lib/domain/billing/billing';
import { assertFeatureAccess } from '@/lib/domain/billing/feature-gate';
import { resolveSliderNutrition } from '@/lib/domain/cheat/slider-nutrition';
import { type AppDb, db } from '@/lib/infra/db/client';
import { meals, pendingAnalyses } from '@/lib/infra/db/schema';
import { insertDefaultCircleShare } from './insert-default-share';
import { EMPTY_NUTRITION } from './shared';
import type { ConfirmMealResponse } from './types';

type DbTransaction = Parameters<Parameters<AppDb['transaction']>[0]>[0];

/**
 * Premium gate for the CONFIRM half of the cheat flow.
 *
 * Confirm is one action for both entry modes, and which branch it takes is
 * decided by a `pending_analyses` row the caller only names by id — so the gate
 * cannot be a plain `assertFeatureAccess` at the top of `confirmAndSaveMealAction`
 * without locking precise meals too. This resolves the mode first, then gates
 * only the cheat branch.
 *
 * Called BEFORE the confirm transaction opens: `DB_POOL_MAX` defaults to 2, so
 * an entitlement read inside an open transaction can deadlock the pool.
 *
 * Two deliberate non-throws:
 *  - kill-switch off ⇒ returns immediately, issuing NO query at all, so an
 *    unenforced build behaves byte-for-byte as before this gate existed;
 *  - unknown / missing / foreign pending row ⇒ returns quietly. The confirm
 *    action deletes-and-checks that same row moments later and raises its own
 *    "analysis không tồn tại" error; duplicating it here would only change
 *    which message a stale card gets.
 */
export async function assertCheatConfirmAllowed(
  userId: string,
  profileCreatedAt: Date,
  analysisId: string
): Promise<void> {
  if (!getBillingConfig().enforcementEnabled) return;

  const [pending] = await db
    .select({ entryMode: pendingAnalyses.entryMode })
    .from(pendingAnalyses)
    .where(
      and(
        eq(pendingAnalyses.id, analysisId),
        eq(pendingAnalyses.userId, userId)
      )
    )
    .limit(1);

  if (pending?.entryMode !== 'cheat') return;

  await assertFeatureAccess({ userId, profileCreatedAt }, 'cheat_meal');
}

/**
 * Cheat-meal confirm branch: recompute nutrition from the staged slider spec
 * + the user's chosen levels (server-authoritative), insert a single meal row
 * with zero meal_items, and store the spec/levels for re-edit.
 */
export async function confirmCheatMeal(args: {
  tx: DbTransaction;
  userId: string;
  pending: typeof pendingAnalyses.$inferSelect;
  mealId: string | undefined;
  levels: CheatSliderLevels;
}): Promise<ConfirmMealResponse> {
  const { tx, userId, pending, mealId } = args;
  const { spec } = pending.pipelineResult as {
    entryMode: 'cheat';
    spec: CheatSliderSpec;
  };
  const levels: CheatSliderLevels = args.levels;
  const resolved = resolveSliderNutrition(spec, levels);

  const loggedAt = pending.loggedAt;
  const mealSlot = spec.mealSlot ?? inferMealSlot(loggedAt);
  const persisted: CheatSlidersPersisted = { spec, levels };

  const [meal] = await tx
    .insert(meals)
    .values({
      ...(mealId ? { id: mealId } : {}),
      userId,
      rawInput: pending.rawInput,
      mealSlot,
      confidenceOverall: spec.confidence,
      loggedAt,
      entryMode: 'cheat',
      caloriesKcal: resolved.caloriesKcal,
      proteinG: resolved.proteinG,
      carbohydrateG: resolved.carbohydrateG,
      fatG: resolved.fatG,
      alcoholG: resolved.alcoholG,
      cheatSliders: persisted,
    })
    .returning({ id: meals.id });

  // Share to circle by default unless the profile-level opt-out is set (the
  // AFTER INSERT trigger fans out the meal_shared circle event). The user can
  // still opt this meal back out via the per-meal toggle, while
  // onConflictDoNothing preserves a prior explicit choice on the
  // re-confirm/edit path (existing meal id).
  const share = await insertDefaultCircleShare(tx, {
    mealId: meal.id,
    actorId: userId,
  });

  // Rebuild the saved cheat meal in the shape loadMealsByDate returns, so
  // the client reconciles its optimistic card from the confirm response
  // (same id → in-place overwrite, no day refetch) — mirroring the precise
  // path in confirmAndSaveMealAction. Cheat meals carry zero meal_items.
  const nutrition = {
    ...EMPTY_NUTRITION,
    caloriesKcal: resolved.caloriesKcal,
    proteinG: resolved.proteinG,
    carbohydrateG: resolved.carbohydrateG,
    fatG: resolved.fatG,
  };
  const savedMeal = buildPersistedMeal({
    id: meal.id,
    rawInput: pending.rawInput,
    mealSlot,
    confidenceOverall: spec.confidence,
    loggedAt: loggedAt.toISOString(),
    nutrition,
    mealItemGroups: [],
    entryMode: 'cheat',
    alcoholG: resolved.alcoholG,
    cheatSliders: persisted,
    share,
  });

  return { mealId: meal.id, meal: savedMeal };
}
