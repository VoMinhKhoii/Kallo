import type { AreaCast } from '@/lib/brand/illustrations/cast';
import {
  SLOTH_PEEKING_OUT_BOX,
  SLOTH_SLEEPING_HAMMOCK,
  SLOTH_TANGLED_STRING,
  SLOTH_TELESCOPE,
} from '@/lib/brand/illustrations/sloth';

/** The nutrition surfaces' cast: the sloth. */
export const NUTRITION_CAST: AreaCast = {
  error: SLOTH_TANGLED_STRING,
  empty: SLOTH_PEEKING_OUT_BOX,
  locked: SLOTH_TELESCOPE,
  night: SLOTH_SLEEPING_HAMMOCK,
};
