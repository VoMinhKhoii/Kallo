import { readBooleanEnv } from './feature-flags';

export const PROTEIN_PORTION_DEFAULT_ENV = 'PROTEIN_PORTION_DEFAULT';
export const PROMPT_SIZING_HINTS_ENV = 'PROMPT_SIZING_HINTS';
export const VESSEL_GUARD_ENV = 'VESSEL_GUARD';

export function isProteinPortionDefaultEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PROTEIN_PORTION_DEFAULT_ENV, true, env);
}

export function isPromptSizingHintsEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PROMPT_SIZING_HINTS_ENV, true, env);
}

export function isVesselGuardEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(VESSEL_GUARD_ENV, true, env);
}
