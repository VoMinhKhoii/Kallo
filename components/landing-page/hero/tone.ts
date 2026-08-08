/**
 * The hero's ground.
 *
 * Cream only. The lab explored an espresso fork behind a sun/moon switch, and
 * the page ships the brand default instead — so the second ground is gone, and
 * with it every `dark ? … : …` it forced through the card components.
 *
 * There is no `cardInk` here any more either. It existed to flip a card's type
 * to white once its painting turned the card dark; the cards now wear the
 * light paintings, stay light under them, and keep one ink throughout.
 *
 * The ground and the veil left too — they are the whole page's now, and live
 * in `../ambient-wash.tsx`. What is left is ink, which is still the hero's.
 */
/**
 * Two inks, not three. `faint` used to be the muted grey `#6E6D66`; on cream it
 * read as washed out rather than quiet, so everything secondary on this page is
 * now the soft near-black. Hierarchy comes from size and weight instead — which
 * is the same reason the cards separate by hairline rather than by opacity.
 */
export const HERO_GROUND = {
  ink: 'text-nham-text',
  body: 'text-nham-text-soft',
} as const;

/** The one easing curve every hero motion uses — heavy, decelerating. */
export const HERO_EASE = [0.32, 0.72, 0, 1] as const;
