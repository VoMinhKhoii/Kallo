import { readBooleanEnv } from './feature-flags';

/**
 * Enables vessel-aware served-portion envelopes in the grounded pipeline.
 * Default ON; operators can disable it without a deploy-time code change.
 */
export const PORTION_VESSEL_ENABLED_ENV = 'PORTION_VESSEL_ENABLED';

export function isPortionVesselEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PORTION_VESSEL_ENABLED_ENV, true, env);
}
