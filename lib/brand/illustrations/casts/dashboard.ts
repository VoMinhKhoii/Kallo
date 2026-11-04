import type { AreaCast } from '@/lib/brand/illustrations/cast';
import {
  HEDGEHOG_NAPPING_SHOE,
  HEDGEHOG_PEEKING_OUT_BOX,
  HEDGEHOG_STUCK_JAR,
} from '@/lib/brand/illustrations/hedgehog';

/** The dashboard surfaces' cast: the hedgehog. */
export const DASHBOARD_CAST: AreaCast = {
  error: HEDGEHOG_STUCK_JAR,
  empty: HEDGEHOG_PEEKING_OUT_BOX,
  night: HEDGEHOG_NAPPING_SHOE,
};
