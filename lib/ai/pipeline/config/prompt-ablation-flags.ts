import { readBooleanEnv } from './feature-flags';

export const VESSEL_GUARD_ENV = 'VESSEL_GUARD';

export function isVesselGuardEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(VESSEL_GUARD_ENV, true, env);
}
