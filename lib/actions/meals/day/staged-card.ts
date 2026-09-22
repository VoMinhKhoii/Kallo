import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import type { PipelineResult } from '@/lib/ai/types/result';
import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { PendingMealConfirmation } from '../types';

/**
 * How many staged rows a read may pull payloads for before it stops asking.
 *
 * {@link toStagedCard} needs the whole `pipeline_result` JSONB — a few
 * kilobytes a row — and nothing bounds how many of those one user can have
 * live at once. `stageBarcodeMeal` inserts with a NULL `attempt_id`, so the
 * `(user_id, attempt_id)` unique index cannot collapse repeated scans, and
 * `stageBarcodeMealAction` runs no limiter of its own; the AI path allows 100
 * fresh attempts a day against a seven-day reaping horizon. A user who stages
 * and never confirms would otherwise make the timeline's date read grow
 * without limit, on every logging page load.
 *
 * It lives here, beside the decision it bounds, because a caller that hits the
 * cap has to fall back to something — and what that something is only makes
 * sense next to what the payload was for. `loadMealDates` reports the days it
 * could not reach as unknown rather than guessing they hold no card.
 *
 * Well clear of any ordinary user: the feed would be drawing hundreds of
 * unconfirmed cards before this bites.
 */
export const PENDING_SCAN_LIMIT = 200;

/** The columns any read needs before it can decide a staged row is renderable. */
export interface StagedCardRow {
  id: string;
  rawInput: string;
  loggedAt: Date;
  entryMode: string;
  pipelineResult: unknown;
}

/**
 * One staged card, or null when the stored payload cannot produce one.
 *
 * Every read that reports on staged cards has to agree on which of them are
 * real, and this is the only definition. The feed and the timeline drifted
 * apart twice — once over the reaping horizon, once over exactly this
 * renderability check — and each time the sidebar described a day the feed drew
 * differently. A shared function is what stops the third time.
 *
 * A malformed row must not throw: it would 500 the whole day load through the
 * Promise.all in loadLoggingDay. Such a row is un-confirmable anyway, since
 * confirm reads the same pipelineResult.
 */
export function toStagedCard(
  row: StagedCardRow
): PendingMealConfirmation | null {
  try {
    const base = {
      id: row.id,
      rawInput: row.rawInput,
      loggedAt: row.loggedAt.toISOString(),
    };

    // Cheat rows stage a slider spec, not a decomposition PipelineResult, so
    // toParsedMeal (which reads .mealItems) can't apply. Branch on entryMode,
    // mirroring confirmAndSaveMealAction.
    if (row.entryMode === 'cheat') {
      // Validate the staged spec rather than blindly destructuring: a malformed
      // payload (e.g. {}) wouldn't throw and would surface a card with
      // cheatSpec: undefined. Throwing routes it through the catch below, which
      // skips + logs it like any other malformed row.
      const spec = (row.pipelineResult as { spec?: unknown } | null)?.spec;
      if (
        !spec ||
        typeof spec !== 'object' ||
        !Array.isArray((spec as { sliders?: unknown }).sliders)
      ) {
        throw new Error('Malformed cheat pending analysis payload');
      }
      return { ...base, cheatSpec: spec as CheatSliderSpec };
    }

    return {
      ...base,
      parsedMeal: toParsedMeal(row.pipelineResult as PipelineResult),
    };
  } catch (error) {
    console.error(
      '[staged-card] Skipping pending analysis with malformed pipelineResult',
      { id: row.id, error }
    );
    return null;
  }
}
