/**
 * Copy for the hero lab.
 *
 * Still hardcoded English — it moves into `messages/{en,vi}.json` when a
 * direction is chosen and this stops being a lab surface.
 */
export const HERO_COPY = {
  /** Split so `describe` and `derive` can be underlined without the punctuation. */
  headline: [
    { lead: 'You', word: 'describe', tail: ',' },
    { lead: 'we', word: 'derive', tail: '.' },
  ],
  subtitle:
    "Tell Kallo what you ate the way you'd tell a friend. It helps split into real ingredients and derives calories/macros from trusted data.",
  cardsHint:
    'Eyeballed or weighed to the gram — both go in the same way. Hover a meal to see it.',
  beta: 'Free while in beta · born in Vietnam, built for every kitchen',
} as const;
