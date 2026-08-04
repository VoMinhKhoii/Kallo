/**
 * The two grounds the hero lab is explored on. `cream` is the brand default
 * (#f9f9f7 paper); `espresso` is the dark fork, hardcoded rather than routed
 * through next-themes because these are lab surfaces — the whole point is to
 * see both grounds side by side without flipping a global theme.
 */
export type HeroTone = 'cream' | 'espresso';

export const HERO_TONE = {
  cream: {
    ground: 'bg-nham-surface',
    ink: 'text-nham-text',
    body: 'text-nham-text-soft',
    faint: 'text-nham-text-muted',
    eyebrowShell: 'border-nham-border bg-white/70',
    eyebrowText: 'text-nham-text-muted',
    hairline: 'bg-nham-border',
    veil: 'radial-gradient(62% 56% at 50% 44%, rgba(249,249,247,0.95) 0%, rgba(249,249,247,0.72) 44%, rgba(249,249,247,0) 80%)',
  },
  espresso: {
    ground: 'bg-[#1C1810]',
    ink: 'text-nham-surface',
    body: 'text-[#C6B8A3]',
    faint: 'text-[#9C8F7C]',
    eyebrowShell: 'border-white/12 bg-white/[0.06]',
    eyebrowText: 'text-[#B8A88E]',
    hairline: 'bg-white/10',
    veil: 'radial-gradient(62% 56% at 50% 44%, rgba(28,24,16,0.92) 0%, rgba(28,24,16,0.66) 44%, rgba(28,24,16,0) 80%)',
  },
} as const;

/** The one easing curve every hero-lab motion uses — heavy, decelerating. */
export const HERO_EASE = [0.32, 0.72, 0, 1] as const;

export interface CardInk {
  strong: string;
  muted: string;
  rule: string;
  ruleFaint: string;
}

/**
 * Ink for a meal card. Hovered, the type is always light: on cream the
 * chiaroscuro painting runs at full strength and turns the card dark, and on
 * espresso the light painting is held back far enough that the card stays
 * dark. Two routes to the same place, which is why nothing has to be laid
 * over the text.
 */
export function cardInk(dark: boolean, active: boolean): CardInk {
  const light = active ? true : dark;
  return {
    strong: light ? 'text-nham-surface' : 'text-nham-text',
    muted: active
      ? 'text-nham-surface/90'
      : dark
        ? 'text-[#B8A88E]'
        : 'text-nham-text-muted',
    rule: light ? 'border-white/25' : 'border-nham-border',
    ruleFaint: light ? 'border-white/20' : 'border-nham-border/50',
  };
}
