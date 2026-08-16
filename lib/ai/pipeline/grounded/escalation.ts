/**
 * Post-assembly anomaly pass and the gated Call-2 escalation decision.
 *
 * The anomaly pass classifies the assembled result by CAUSE; its summary feeds
 * both the run record (telemetry markers) and the escalation gate below, which
 * decides whether a high-confidence correctness anomaly is worth a second
 * Call 2 on the escalation model. Both are pure/best-effort — neither throws
 * into the pipeline.
 */
import type { ModelProfile } from '@/lib/ai/pipeline/config/model-profile';
import type { MealDecompositionV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import {
  classifyV2Anomalies,
  summarizeV2Anomalies,
  type V2AnomalySummary,
} from '@/lib/ai/pipeline/telemetry/anomaly';
import type {
  MatchedIngredient,
  UnmatchedIngredient,
} from '@/lib/ai/types/matching';
import type { PipelineResult } from '@/lib/ai/types/result';

/**
 * Env flag gating the v2 correctness-escalation re-run. Default OFF: the
 * escalation seam (re-run Call 2 on `profile.escalationModel` for a
 * high-confidence correctness anomaly) does NOT add latency until an operator
 * opts in. `stable` has `escalationModel: null` so escalation is impossible
 * there regardless of the flag; only `next` can escalate, and only when the
 * flag is on. Fire-count is always telemetered.
 */
export const V2_ESCALATION_FLAG_ENV = 'PIPELINE_V2_ESCALATION';

export function isV2EscalationEnabled(
  env: Record<string, string | undefined> = process.env
): boolean {
  return env[V2_ESCALATION_FLAG_ENV] === 'on';
}

/**
 * Decide whether the gated escalation seam should fire for this run. Fires only
 * when ALL of: the flag is on, the profile carries a non-null escalationModel,
 * and the anomaly pass surfaced a high-confidence correctness anomaly. Pure so
 * the orchestrator's escalation decision is unit-testable without an LLM.
 */
export function shouldEscalateV2(args: {
  profile: Pick<ModelProfile, 'escalationModel'>;
  summary: Pick<V2AnomalySummary, 'hasEscalationCandidate'>;
  env?: Record<string, string | undefined>;
}): boolean {
  return (
    isV2EscalationEnabled(args.env) &&
    args.profile.escalationModel != null &&
    args.summary.hasEscalationCandidate
  );
}

/**
 * Run the v2 anomaly pass over the assembled result: classify each anomaly by
 * CAUSE, apply the SAFE actions' bookkeeping, and fold into telemetry counts +
 * markers. Best-effort observability — never throws into the pipeline. Returns
 * the summary the telemetry writer + escalation gate read.
 */
export function runV2AnomalyPass(args: {
  result: PipelineResult;
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  decomposition: MealDecompositionV2;
}): V2AnomalySummary {
  const prepNoteIngredientNames = new Set<string>();
  for (const mi of args.decomposition.mealItems) {
    for (const ing of mi.ingredients) {
      const hasPrep = (ing.prepNotes ?? []).some(
        (n) => typeof n === 'string' && n.trim().length > 0
      );
      if (hasPrep) prepNoteIngredientNames.add(ing.rawName);
    }
  }
  const anomalies = classifyV2Anomalies({
    result: args.result,
    matched: args.matched,
    unmatched: args.unmatched,
    prepNoteIngredientNames,
  });
  const summary = summarizeV2Anomalies(anomalies);
  console.info('[v2-pipeline] anomalies', {
    causeCounts: summary.causeCounts,
    actionCounts: summary.actionCounts,
    escalationCandidate: summary.hasEscalationCandidate,
  });
  return summary;
}
