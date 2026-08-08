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
 * Both strings spell the hex out in full rather than composing it from a
 * shared constant, because Tailwind extracts classes by scanning source text —
 * a `bg-[${YELLOW}]` template would compile to nothing at all.
 */

/** Marker pen, for a run of text or a number sitting inside a line. */
export const HIGHLIGHT_MARK =
  'rounded-[0.25rem] bg-[#f8d546] px-1 text-nham-text';

/** The same ink as a standalone pill, for a label with nothing around it. */
export const HIGHLIGHT_BADGE =
  'rounded-full bg-[#f8d546] px-2.5 py-1 font-sans-display font-semibold text-[11px] text-nham-text';
