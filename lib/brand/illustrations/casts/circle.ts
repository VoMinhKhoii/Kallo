import {
  CAPYBARA_PEEKING_OUT_BOX,
  CAPYBARA_SLEEPING_HAMMOCK,
  CAPYBARA_STUCK_JAR,
  CAPYBARA_TELESCOPE,
} from '@/lib/brand/illustrations/capybara';
import type { AreaCast } from '@/lib/brand/illustrations/cast';

/** The circle surfaces' cast: the capybara. */
export const CIRCLE_CAST: AreaCast = {
  error: CAPYBARA_STUCK_JAR,
  empty: CAPYBARA_TELESCOPE,
  emptyAlt: CAPYBARA_PEEKING_OUT_BOX,
  night: CAPYBARA_SLEEPING_HAMMOCK,
};
