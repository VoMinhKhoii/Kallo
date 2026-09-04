import {
  CAPYBARA_PEEKING_OUT_BOX,
  CAPYBARA_SLEEPING_HAMMOCK,
  CAPYBARA_STUCK_JAR,
  CAPYBARA_TELESCOPE,
} from '@/lib/brand/illustrations/capybara';
import {
  HEDGEHOG_NAPPING_SHOE,
  HEDGEHOG_PEEKING_OUT_BOX,
  HEDGEHOG_STUCK_JAR,
} from '@/lib/brand/illustrations/hedgehog';
import type { Illustration } from '@/lib/brand/illustrations/illustration';
import {
  OTTER_PEEKING_OUT_BOX,
  OTTER_TANGLED_STRING,
  OTTER_WRAPPED_BLANKET,
} from '@/lib/brand/illustrations/otter';
import {
  SEAL_CURLED_UP_ASLEEP,
  SEAL_HAMMOCK,
  SEAL_HOLDING_MAP,
  SEAL_SWEEPING_BROOM,
  SEAL_TELESCOPE,
} from '@/lib/brand/illustrations/seal';
import {
  SLOTH_PEEKING_OUT_BOX,
  SLOTH_SLEEPING_HAMMOCK,
  SLOTH_TANGLED_STRING,
} from '@/lib/brand/illustrations/sloth';

export type SurfaceArea =
  | 'circle'
  | 'logging'
  | 'nutrition'
  | 'dashboard'
  | 'system';

export type SurfaceKind =
  | 'error'
  | 'empty'
  | 'emptyAlt'
  | 'notFound'
  | 'offline';

/**
 * One animal per area, pose per state. `empty` is the fallback pose every
 * area must have; `night` replaces whatever was asked for between 22:00 and
 * 05:00, so the app is never wide awake when the person isn't.
 */
interface AreaCast {
  error: Illustration;
  empty: Illustration;
  emptyAlt?: Illustration;
  notFound?: Illustration;
  offline?: Illustration;
  night: Illustration;
}

export const CAST: Record<SurfaceArea, AreaCast> = {
  circle: {
    error: CAPYBARA_STUCK_JAR,
    empty: CAPYBARA_TELESCOPE,
    emptyAlt: CAPYBARA_PEEKING_OUT_BOX,
    night: CAPYBARA_SLEEPING_HAMMOCK,
  },
  logging: {
    error: OTTER_TANGLED_STRING,
    empty: OTTER_PEEKING_OUT_BOX,
    night: OTTER_WRAPPED_BLANKET,
  },
  nutrition: {
    error: SLOTH_TANGLED_STRING,
    empty: SLOTH_PEEKING_OUT_BOX,
    night: SLOTH_SLEEPING_HAMMOCK,
  },
  dashboard: {
    error: HEDGEHOG_STUCK_JAR,
    empty: HEDGEHOG_PEEKING_OUT_BOX,
    night: HEDGEHOG_NAPPING_SHOE,
  },
  system: {
    error: SEAL_SWEEPING_BROOM,
    empty: SEAL_HOLDING_MAP,
    notFound: SEAL_TELESCOPE,
    offline: SEAL_HAMMOCK,
    night: SEAL_CURLED_UP_ASLEEP,
  },
};

/**
 * The illustration for one surface: the sleeping pose after dark, otherwise
 * the pose for the state — falling back to `empty` for the kinds an area does
 * not cast (only `system` has a 404 and an offline pose).
 */
export function pickIllustration(
  area: SurfaceArea,
  kind: SurfaceKind,
  lateNight: boolean
): Illustration {
  const cast = CAST[area];
  if (lateNight) return cast.night;
  return cast[kind] ?? cast.empty;
}
