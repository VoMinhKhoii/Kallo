import type {
  CheatSliderLevels,
  CheatSliderSpec,
  StagedCheatAnalysis,
} from '@/lib/core/types/cheat';
import { withLevelsAsDefaults } from '@/lib/domain/cheat/slider-nutrition';
import type { AppDb, AppTransaction } from '@/lib/infra/db/client';
import { pendingAnalyses } from '@/lib/infra/db/schema';

/**
 * Re-open an existing cheat occasion's sliders as a fresh staged analysis.
 *
 * The single persistence seam for both re-stage paths — `stageCheatRepeatAction`
 * re-opens MY own past occasion, `stageCheatInviteAction` re-opens a friend's
 * under the authority of an invite — so the two can never drift on what a
 * re-staged cheat card actually is.
 *
 * The authority to read the source, and the instant to stamp, are the callers'
 * business entirely; by the time anything reaches here both have been settled.
 * What is shared is the rest: the recorded levels become the new card's
 * DEFAULTS, so it opens where the last one landed rather than at the model's
 * guess, and nothing is logged until the user confirms — this writes a
 * `pending_analyses` row and the ordinary `confirmAndSaveMealAction` ->
 * `confirmCheatMeal` path takes it from there, untouched.
 */
export async function stageCheatSliders(
  tx: AppDb | AppTransaction,
  options: {
    userId: string;
    spec: CheatSliderSpec;
    /** Where the source occasion's sliders were left. */
    levels: CheatSliderLevels;
    rawInput: string;
    loggedAt: Date;
    /**
     * The meal-share invite this card came from, when it came from one.
     *
     * Only `stageCheatInviteAction` passes it. Taking a cheat offer spends the
     * invite at stage time, so the card has to remember which offer it owes —
     * discarding it hands that offer back (`releaseInvite`) and confirming it
     * binds the offer to the new meal (`bindInviteToMeal`). A re-log of my own
     * past occasion has no invite and leaves this null.
     */
    sourceInviteId?: string;
  }
): Promise<StagedCheatAnalysis> {
  const { userId, spec, levels, rawInput, loggedAt, sourceInviteId } = options;
  const repeatSpec = withLevelsAsDefaults(spec, levels);

  const [inserted] = await tx
    .insert(pendingAnalyses)
    .values({
      userId,
      pipelineResult: { entryMode: 'cheat', spec: repeatSpec },
      rawInput,
      entryMode: 'cheat',
      loggedAt,
      sourceInviteId,
    })
    .returning({ id: pendingAnalyses.id });

  return {
    analysisId: inserted.id,
    spec: repeatSpec,
    rawInput,
    loggedAt: loggedAt.toISOString(),
  };
}
