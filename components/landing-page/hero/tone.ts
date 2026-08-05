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
 */
export const HERO_GROUND = {
  ground: 'bg-nham-surface',
  ink: 'text-nham-text',
  body: 'text-nham-text-soft',
  faint: 'text-nham-text-muted',
  /** Pulls the resting washes back under the type without dulling the edges. */
  veil: 'radial-gradient(62% 56% at 50% 44%, rgba(249,249,247,0.95) 0%, rgba(249,249,247,0.72) 44%, rgba(249,249,247,0) 80%)',
} as const;

/** The one easing curve every hero motion uses — heavy, decelerating. */
export const HERO_EASE = [0.32, 0.72, 0, 1] as const;
