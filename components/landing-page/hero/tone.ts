/**
 * The hero's ground, and the ink that sits on it.
 *
 * Cream only. The lab explored an espresso fork behind a sun/moon switch, and
 * the page ships the brand default instead — so the second ground is gone, and
 * with it every `dark ? … : …` it forced through the card components.
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

export interface CardInk {
  strong: string;
  muted: string;
  rule: string;
  ruleFaint: string;
}

/**
 * Ink for a meal card.
 *
 * At rest the card is plain white stock and takes normal ink. Hovered, its
 * painting runs at near-full strength and turns the card dark, so the type
 * flips light to follow it. That flip is why nothing has to be laid over the
 * text to keep it readable.
 */
export function cardInk(active: boolean): CardInk {
  return {
    strong: active ? 'text-nham-surface' : 'text-nham-text',
    muted: active ? 'text-nham-surface/90' : 'text-nham-text-muted',
    rule: active ? 'border-white/25' : 'border-nham-border',
    ruleFaint: active ? 'border-white/20' : 'border-nham-border/50',
  };
}
