import { readBooleanEnv } from './feature-flags';

export const PROTEIN_PORTION_DEFAULT_ENV = 'PROTEIN_PORTION_DEFAULT';
export const INEDIBLE_PORTION_RULE_ENV = 'INEDIBLE_PORTION_RULE';
export const PROMPT_SIZING_HINTS_ENV = 'PROMPT_SIZING_HINTS';
export const VESSEL_GUARD_ENV = 'VESSEL_GUARD';
export const REFUSE_PCT_SCHEMA_ENV = 'REFUSE_PCT_SCHEMA';

export function isProteinPortionDefaultEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PROTEIN_PORTION_DEFAULT_ENV, true, env);
}

export function isInediblePortionRuleEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(INEDIBLE_PORTION_RULE_ENV, false, env);
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

export function isRefusePctSchemaEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  // Default ON since the stock-bone hardening: prod inherits the gross+refuse
  // schema without env configuration. REFUSE_PCT_SCHEMA=false is the kill switch.
  return readBooleanEnv(REFUSE_PCT_SCHEMA_ENV, true, env);
}
