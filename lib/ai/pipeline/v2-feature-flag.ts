import { readBooleanEnv } from './feature-flags';

/**
 * Master switch for the V2 pipeline (pure-decompose Call 1 +
 * grounded-estimation Call 2 with CRAG match verdict).
 *
 * Default OFF. Flip via `PIPELINE_V2_ENABLED=true`. While off, the
 * orchestrator runs the existing V1 path verbatim and all V2 code paths
 * are unreachable from production.
 *
 * Shadow mode: `PIPELINE_V2_SHADOW=true` runs V1 as the authoritative
 * response AND V2 in parallel for divergence measurement. Independent of
 * the master flag.
 *
 * See: /root/.claude/plans/i-need-the-ai-sorted-tome.md
 */
export const PIPELINE_V2_ENABLED_ENV = 'PIPELINE_V2_ENABLED';
export const PIPELINE_V2_SHADOW_ENV = 'PIPELINE_V2_SHADOW';

export function isPipelineV2Enabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PIPELINE_V2_ENABLED_ENV, false, env);
}

export function isPipelineV2ShadowEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return readBooleanEnv(PIPELINE_V2_SHADOW_ENV, false, env);
}
