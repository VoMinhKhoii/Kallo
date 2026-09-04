/**
 * One Koboyo illustration as data: the source slug, its viewBox, and the raw
 * `d` of every pen stroke in draw order. The paths stay separate — Koboyo art
 * is 2–3 strokes and concatenating them changes the fill.
 */
export interface Illustration {
  slug: string;
  viewBox: string;
  paths: string[];
}
