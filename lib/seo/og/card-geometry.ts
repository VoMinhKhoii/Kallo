/**
 * Fixed geometry of the share card: the canvas, and the calorie ring drawn on
 * it. Satori lays out a fixed-size canvas with no viewport, so every dimension
 * here is an absolute pixel count rather than something responsive.
 */

/** 9:16 vertical card (Stories / Reels aspect). */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/**
 * The calorie-ring geometry from `components/shared/calorie-ring.tsx`, so the
 * shared card matches the in-app ring exactly. Duplicated rather than imported
 * because that component is a client component built on motion + CSS variables,
 * neither of which Satori can render.
 */
export const RING_VIEWBOX = 100;
export const RING_RADIUS = 46;
export const RING_CENTER = RING_VIEWBOX / 2;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** `strokeDashoffset` for a ring filled `sweep` of the way round (0–1). */
export function ringDashOffset(sweep: number): number {
  return RING_CIRCUMFERENCE * (1 - sweep);
}
