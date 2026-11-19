import type { Illustration } from '@/lib/brand/illustrations/illustration';

export type SurfaceKind =
  | 'error'
  | 'empty'
  | 'emptyAlt'
  | 'notFound'
  | 'offline'
  | 'locked';

/**
 * One animal per area, pose per state. `empty` is the fallback pose every
 * area must have; `night` replaces whatever was asked for between 22:00 and
 * 05:00, so the app is never wide awake when the person isn't.
 *
 * Each area's cast is its own module under `casts/`, imported by the surface
 * that shows it. One map of every area would put all five animals (~36 KB
 * gzipped of pen strokes) on every page, because the 404 and error pages are
 * loaded on all of them.
 */
export interface AreaCast {
  error: Illustration;
  empty: Illustration;
  emptyAlt?: Illustration;
  notFound?: Illustration;
  offline?: Illustration;
  // A Premium-only surface: the animal eyeing what it cannot reach yet.
  locked?: Illustration;
  night: Illustration;
}

/**
 * The illustration for one surface: the sleeping pose after dark, otherwise
 * the pose for the state — falling back to `empty` for the kinds an area does
 * not cast (only `system` has a 404 and an offline pose, only `nutrition` a
 * locked one).
 */
export function pickIllustration(
  cast: AreaCast,
  kind: SurfaceKind,
  lateNight: boolean
): Illustration {
  if (lateNight) return cast.night;
  return cast[kind] ?? cast.empty;
}
