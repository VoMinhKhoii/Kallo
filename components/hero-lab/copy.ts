/**
 * Copy for the hero lab.
 *
 * Kept separate from `components/landing-lab/copy.ts` so this surface can move
 * without dragging the retiring globe lab with it. Still hardcoded English —
 * it moves into `messages/{en,vi}.json` when a direction is chosen.
 */
export const HERO_COPY = {
  title: 'You describe,',
  titleHighlight: 'we derive.',
  subtitle:
    "Tell Kallo what you ate the way you'd tell a friend. It helps split into real ingredients and derives calories/macros from trusted data.",
  cardsHint:
    'Eyeballed or weighed to the gram — both go in the same way. Hover a meal to see it.',
  beta: 'Free while in beta · born in Vietnam, built for every kitchen',
} as const;
