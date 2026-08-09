/**
 * The stack's geometry — five numbers that only work as a set.
 *
 * They live together because they are coupled, and because two of the couplings
 * fail SILENTLY. Nothing throws, nothing looks obviously broken; the section
 * just stops feeling right, which is far harder to find later than a crash.
 *
 *   1. `STACK_TOP_REM` must equal `HEADING_TOP_REM + HEADING_REM` in
 *      `understanding-section.tsx`, or the gap between title and first card
 *      changes mid-scroll and reads as a stutter.
 *   2. `CARD_REM` must clear the tallest panel, or a card spills into the next
 *      one's flow slot during the deal-in.
 *   3. `TITLE_BAND_REM` must be at least the largest height drop between
 *      neighbouring panels, or a card fails to fully cover the one it lands on
 *      and a stripe of the card below shows under it.
 *
 * All three are measured in the browser, not derived — re-measure whenever
 * these cards gain content, change padding, or change type size.
 */

/**
 * Height of the title band, and therefore the stack's step.
 *
 * These are the same number on purpose: each card rests exactly one band lower
 * than the one before it, so the sliver every buried card still shows is its
 * own title rather than an anonymous strip of beige. Change one and the other
 * has to move with it.
 */
export const TITLE_BAND_REM = 5;

/**
 * Where the first card comes to rest: directly under the pinned section
 * heading, never over it.
 *
 * This must be EXACTLY `HEADING_TOP_REM + HEADING_REM`, both in
 * `understanding-section.tsx`. Not approximately: the first card sits flush
 * under the heading box in flow and at this offset once pinned, so any
 * difference between the two shows up as the gap changing mid-scroll.
 */
export const STACK_TOP_REM = 15.5;

/**
 * The height of each card's sticky WRAPPER — not of the card you can see.
 *
 * This is what makes the pile leave in one piece. Release happens at
 * `top + height + marginBottom`; the margins cancel out the differing `top`s,
 * but only if `height` is the same for every card. Sizing the visible panel to
 * one height would pool a different amount of empty beige under each, since
 * they naturally differ. So the wrapper is held level and the panel inside
 * keeps its own height with consistent padding.
 *
 * It has to clear the TALLEST panel at ANY width, and the tallest is not at the
 * widest screen — at `md` two cards share the width, sentences wrap, and the
 * panels grow. Measured: 22.9rem at 1728px, 26.58rem at 820px. The value
 * carries about a rem of headroom over that worst case on purpose, because a
 * shorter wrapper does not warn you — the card simply spills into the next
 * one's flow slot during the deal-in.
 *
 * Re-measure after ANY content change. Taking the note line out dropped the
 * `md` worst case to 24.79rem and this to 25.75; putting it back took it
 * straight past that, which is exactly the silent failure this comment is
 * warning about.
 *
 * Shrinking this is the only thing that shortens the sweep a covering card
 * makes across the card beneath it (sweep = CARD_REM + STACK_GAP_REM +
 * (n-2-i)·TITLE_BAND_REM), so it is worth keeping tight — but never tighter
 * than the `md` measurement above.
 */
export const CARD_REM = 27.5;

/**
 * The scroll position, in rem down the container, at which every card lets go.
 *
 * Exported because the section heading has to join the same group — it is a
 * sticky sibling in the same container, so if its threshold differs it either
 * gets left behind after the pile has gone or leaves before it.
 */
export function stackReleaseRem(total: number) {
  return (
    STACK_TOP_REM + CARD_REM + STACK_GAP_REM + (total - 1) * TITLE_BAND_REM
  );
}

/** Flow gap under the last card, added to every card's margin equally. */
export const STACK_GAP_REM = 1.5;
