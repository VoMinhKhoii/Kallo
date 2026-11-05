import type { AreaCast } from '@/lib/brand/illustrations/cast';
import {
  SEAL_CURLED_UP_ASLEEP,
  SEAL_HAMMOCK,
  SEAL_HOLDING_MAP,
  SEAL_SWEEPING_BROOM,
  SEAL_TELESCOPE,
} from '@/lib/brand/illustrations/seal';

/** The system surfaces' cast: the seal. */
export const SYSTEM_CAST: AreaCast = {
  error: SEAL_SWEEPING_BROOM,
  empty: SEAL_HOLDING_MAP,
  notFound: SEAL_TELESCOPE,
  offline: SEAL_HAMMOCK,
  night: SEAL_CURLED_UP_ASLEEP,
};
