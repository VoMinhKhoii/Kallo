/**
 * The page's marker yellow, and the two shapes it comes in.
 *
 * Deliberately outside the warm palette. Everything here is cream, beige and
 * umber, so an on-palette tint disappears into the card — which is exactly what
 * happened to the accent this replaced. It earns its keep by being the only
 * foreign colour on the page, which also means it may only ever mark the thing
 * that changed: the words a user added, the macro they moved, the saving a
 * yearly plan makes. Add a third use and it stops meaning anything.
 *
 * SANCTIONED ADDITIONAL USE — the Premium chip
 * (`components/billing/premium-chip.tsx`) wears the badge shape on gated entry
 * points inside the app. It stays within the rule rather than breaking it: the
 * chip marks the one thing that changed about that control — it now costs
 * money — and it is deliberately the same ink as the pricing card's "Save …%"
 * pill, so the mark a user learns on the landing page keeps its meaning after
 * they sign in. Nothing else may claim this colour.
 *
 * The colour itself is the `--kallo-highlight` token in `app/globals.css`, not
 * a hex written here — these two strings only choose its shape.
 */

/** Marker pen, for a run of text or a number sitting inside a line. */
export const HIGHLIGHT_MARK =
  'rounded-[0.25rem] bg-kallo-highlight px-1 text-kallo-text';

/** The same ink as a standalone pill, for a label with nothing around it. */
export const HIGHLIGHT_BADGE =
  'rounded-full bg-kallo-highlight px-2.5 py-1 font-sans-display font-semibold text-[11px] text-kallo-text';
