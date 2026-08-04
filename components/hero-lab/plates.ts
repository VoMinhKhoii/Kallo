/**
 * Manifest for the generated ground artwork in `public/hero-lab/`.
 *
 * These are the full-bleed grounds behind the calm variants. The meal-card
 * variants carry their artwork per card instead — see `meal-art.ts`.
 *
 * Every plate is abstract and warm. They may suggest light, heat or gathering;
 * they never depict a meal. The brand rule is "no photography in the product",
 * and a painting carries the warmth a food photo would without pretending to
 * show a dish the app never saw.
 */
export interface Plate {
  src: string;
  /** How it composites over its ground. */
  blend: 'multiply' | 'screen' | 'normal';
  /** Resting opacity — tuned per medium so text stays legible on top. */
  opacity: number;
}

export const GROUND = {
  /** v1 — sweeping gouache, morning light, on cream. */
  gouache: {
    src: '/hero-lab/gouache-cream.webp',
    blend: 'multiply',
    opacity: 0.55,
  },
  /** v2 — charcoal and graphite with ember accents, on near-black. */
  charcoal: {
    src: '/hero-lab/charcoal-dark.webp',
    blend: 'screen',
    opacity: 0.72,
  },
} as const satisfies Record<string, Plate>;
