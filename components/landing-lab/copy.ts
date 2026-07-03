/**
 * Shared, hardcoded English copy for the /v1../v4 landing prototypes.
 *
 * These pages exist so the founder can compare four design directions on
 * identical content — copy lives here once so no variant can drift. The
 * winning direction gets rebuilt on the production page with full
 * next-intl (en + vi) copy; this file is deleted with the lab.
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
  derivation: {
    eyebrow: 'The derivation',
    title: 'From a sentence,',
    titleHighlight: 'to a number you can trust.',
    steps: [
      {
        title: "Say it like you'd say it",
        text: 'One sentence, any language, half-remembered portions and all. No search box, no barcode, no weighing.',
      },
      {
        title: 'It splits into real ingredients',
        text: 'Nhẩm decomposes the sentence into ingredients and dish components, matched against curated food-composition data.',
      },
      {
        title: 'Your context sharpens it',
        text: "How you cook, how you portion, what you're working toward — the estimate tightens around your kitchen, not an average one.",
      },
      {
        title: 'You get honest bounds',
        text: "A calorie and macro estimate that admits it's an estimate — bounded, grounded, and counted conservatively when you're cutting.",
      },
    ],
  },
} as const;
