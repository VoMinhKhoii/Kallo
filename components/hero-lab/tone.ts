/**
 * The two grounds the hero lab is explored on. `cream` is the brand default
 * (#f9f9f7 paper); `espresso` is the dark fork, hardcoded rather than routed
 * through next-themes because these are lab surfaces — the whole point is to
 * see both grounds side by side without flipping a global theme.
 */
export type HeroTone = 'cream' | 'espresso' | 'shift';

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
  /**
   * The scroll-driven fork: every colour reads from a CSS variable that the
   * variant lerps cream→espresso as you scroll. Two colour stops and no clock —
   * the light version of the day/night machinery the globe lab carried.
   */
  shift: {
    ground: 'bg-[color:var(--hero-ground)]',
    ink: 'text-[color:var(--hero-ink)]',
    body: 'text-[color:var(--hero-body)]',
    faint: 'text-[color:var(--hero-faint)]',
    eyebrowShell:
      'border-[color:var(--hero-hairline)] bg-[color:var(--hero-ground)]',
    eyebrowText: 'text-[color:var(--hero-faint)]',
    hairline: 'bg-[color:var(--hero-hairline)]',
    veil: 'radial-gradient(62% 56% at 50% 44%, color-mix(in srgb, var(--hero-ground) 94%, transparent) 0%, color-mix(in srgb, var(--hero-ground) 70%, transparent) 44%, transparent 80%)',
  },
} as const;

/** The one easing curve every hero-lab motion uses — heavy, decelerating. */
export const HERO_EASE = [0.32, 0.72, 0, 1] as const;
