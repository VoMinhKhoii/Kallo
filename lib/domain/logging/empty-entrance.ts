/**
 * How the logging surface introduces itself on load, in three beats.
 *
 * The input first, because it is the thing you came to use; then the light
 * behind it; then the question, sliding up into the space above. Played in that
 * order it reads as the page waking up around the input. Played together it is
 * just three things fading in.
 *
 * The delays live here rather than in the three components so they cannot drift
 * out of sequence — a beat that overlaps its predecessor loses the effect
 * entirely.
 */
export const EMPTY_ENTRANCE = {
  input: 0,
  glow: 0.22,
  prompt: 0.45,
} as const;

/** The house ease — the same curve the streaming ticker flips on. */
export const ENTRANCE_EASE = [0.16, 1, 0.3, 1] as const;
