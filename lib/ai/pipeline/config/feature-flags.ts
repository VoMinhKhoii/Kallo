/**
 * Pipeline subcomponent feature flags. Each flag has an explicit default
 * matching today's production behaviour, so unsetting an env var leaves the
 * pipeline unchanged. Operators can flip a single subcomponent off (or on)
 * without code changes — useful for incident response, A/B latency probes,
 * and harness comparisons.
 *
 * Naming policy:
 *   PIPELINE_*_ENABLED  → orchestrator / matching / cache subcomponents
 *   ANALYSIS_*_ENABLED  → analyze-meal route / abuse-guard subcomponents
 *
 * All flags here default ON. Canary toggles that default OFF
 * (PIPELINE_DECOMPOSITION_PROMPT_LABEL, PIPELINE_PROVIDER_SCHEMA_MODE, etc.)
 * stay in their own modules — see lib/ai/prompts/* and lib/ai/pipeline/model-profile.ts.
 */

const FALSY_VALUES = new Set([
  'false',
  '0',
  'off',
  'no',
  'disabled',
  'disable',
]);
const TRUTHY_VALUES = new Set(['true', '1', 'on', 'yes', 'enabled', 'enable']);

/**
 * Parse a boolean env var. Unset/empty falls back to `defaultValue`.
 * Unrecognized values also fall back to `defaultValue` rather than throwing —
 * an operator typo should not silently flip a subcomponent.
 */
export function readBooleanEnv(
  name: string,
  defaultValue: boolean,
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  const raw = env[name];
  if (raw == null) return defaultValue;
  const lower = raw.trim().toLowerCase();
  if (lower === '') return defaultValue;
  if (FALSY_VALUES.has(lower)) return false;
  if (TRUTHY_VALUES.has(lower)) return true;
  return defaultValue;
}
