import { toParsedMeal } from '@/lib/ai/adapters/parsed-meal';
import type { PipelineResult } from '@/lib/ai/types/result';
import type { CheatSliderSpec } from '@/lib/core/types/cheat';
import type { PendingMealConfirmation } from '../types';

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
