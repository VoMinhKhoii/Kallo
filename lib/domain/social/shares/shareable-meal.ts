// ---------------------------------------------------------------------------
// Shareable meal text — the objectionable-text filter at the share boundary
// ---------------------------------------------------------------------------
// A meal's `raw_input` is the Circle's main content: once a meal is shared,
// friends and group members read it verbatim. Logging a PRIVATE meal is never
// filtered — it is the person's own diary. The filter applies at the moment a
// meal becomes visible to someone else, and every such path goes through here:
//   - the per-meal toggle to 'circle' and a direct copy/split offer to friends
//     → `assertShareableMealText` (422 objectionable_content, the draft stays);
//   - auto-share on log (insertDefaultCircleShare) → `isShareableMealText`,
//     because a log must never fail for it: the meal is saved and simply stays
//     private.

import {
  assertAcceptableText,
  findObjectionableTerm,
} from '@/lib/domain/social/moderation/text-filter';

/** Whether a meal with this text may be shown to other people. */
export function isShareableMealText(
  rawInput: string | null | undefined
): boolean {
  return !rawInput || findObjectionableTerm(rawInput) === null;
}

/** Throw the 422 `objectionable_content` when this meal text may not be
 * shared. For the explicit share paths, where the person can edit and retry. */
export function assertShareableMealText(
  rawInput: string | null | undefined
): void {
  assertAcceptableText(rawInput);
}
