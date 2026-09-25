/**
 * The page's marker yellow.
 *
 * Deliberately outside the warm palette. Everything here is cream, beige and
 * umber, so an on-palette tint disappears into the card — which is exactly what
 * happened to the accent this replaced. It earns its keep by being the only
 * foreign colour on the page, which also means it may only ever mark the thing
 * that changed: the words a user added, the macro they moved. Add a third use
 * and it stops meaning anything. (The pricing card's "Save N%" is no longer
 * one of them — it rides on the Premium buy button, in the gold family — and
 * the in-app Premium chip is its own soft blue, `--kallo-premium-*`.)
 *
 * The colour itself is the `--kallo-highlight` token in `app/globals.css`, not
 * a hex written here — this string only chooses its shape.
 */

/** Marker pen, for a run of text or a number sitting inside a line. */
export const HIGHLIGHT_MARK =
  'rounded-[0.25rem] bg-kallo-highlight px-1 text-kallo-text';
