/**
 * Fixed geometry of the share card: the canvas, and the calorie ring drawn on
 * it. Satori lays out a fixed-size canvas with no viewport, so every dimension
 * here is an absolute pixel count rather than something responsive.
 */

/** 9:16 vertical card (Stories / Reels aspect). */
export const CARD_WIDTH = 1080;
export const CARD_HEIGHT = 1920;

/**
 * The share card's own calorie ring.
 *
 * The app's in-product surfaces have moved to the 240° gauge dial
 * (`components/shared/gauge/`); the card keeps the ring, because Satori lays
 * out a fixed canvas with no CSS variables and no motion, and because a share
 * card is read once at a glance rather than scanned against a target.
 */
export const RING_VIEWBOX = 100;
export const RING_RADIUS = 46;
export const RING_CENTER = RING_VIEWBOX / 2;
export const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

/** `strokeDashoffset` for a ring filled `sweep` of the way round (0–1). */
export function ringDashOffset(sweep: number): number {
  return RING_CIRCUMFERENCE * (1 - sweep);
}
