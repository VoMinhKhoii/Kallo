import { readBooleanEnv } from './feature-flags';

/**
 * Master switch for the V2 pipeline (pure-decompose Call 1 +
 * grounded-estimation Call 2 with CRAG match verdict).
 *
 * **Default ON** as of 2026-05-19 — v2 is the new production path after
 * local smoke confirmed correctness (CRAG-corrected chicken-breast macros)
 * and a ~50 % cold-path latency win on a simple meal. Set
 * `PIPELINE_V2_ENABLED=false` to fall back to v1 for incident response
 * without a redeploy.
 *
 * Shadow mode: `PIPELINE_V2_SHADOW=true` runs the OTHER path in the
 * background for divergence measurement (independent of the master flag).
 */
export const PIPELINE_V2_ENABLED_ENV = 'PIPELINE_V2_ENABLED';
export const PIPELINE_V2_SHADOW_ENV = 'PIPELINE_V2_SHADOW';

export function isPipelineV2Enabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PIPELINE_V2_ENABLED_ENV, true, env);
}

export function isPipelineV2ShadowEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PIPELINE_V2_SHADOW_ENV, false, env);
}
