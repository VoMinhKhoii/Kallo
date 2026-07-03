/**
 * Hardcoded English copy for the /v3 landing prototype — the cuisine
 * globe, winner of the four-direction design lab. It gets rebuilt on the
 * production page with full next-intl (en + vi) copy; this file is
 * deleted with the lab.
 */

export const LAB_COPY = {
  badge: 'Any meal, any language',
  title: 'You describe,',
  titleHighlight: 'we derive.',
  subtitle:
    "Tell Nhẩm what you ate the way you'd tell a friend — phở bò, avocado toast, last night's leftovers. It splits the sentence into real ingredients and derives calories and macros from food-composition data.",
  cta: 'Get started',
  ctaSecondary: 'See how it works',
  beta: 'Free while in beta · born in Vietnam, built for every kitchen',
  demo: {
    placeholder: 'Describe any meal…',
    send: 'Derive nutrition',
    analysis: 'Derivation',
    total: 'Estimated total',
    unit: 'kcal',
    phaseMatching: 'Matching ingredients…',
    phaseEstimating: 'Deriving nutrition…',
    save: 'Save this meal',
    tryAnother: 'Or try one of these',
  },
  globe: {
    eyebrow: 'Taste the world',
    title: 'Every kitchen,',
    titleHighlight: 'one sentence away.',
    hint: 'Spin the globe — hover a country to taste its kitchen.',
    hintTouch: 'Spin the globe — tap a country to taste its kitchen.',
    hintSub: 'The raised countries have a story waiting.',
    genericTitle: 'Every kitchen counts',
    genericBody:
      "Nhẩm speaks your food language too — type any dish the way you'd say it.",
    chipCaption: "log it like you'd say it",
  },
} as const;
