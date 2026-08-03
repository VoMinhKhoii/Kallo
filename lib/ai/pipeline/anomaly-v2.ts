/**
 * V2 anomaly detection with CAUSE classification (Phase 4, D2).
 *
 * The v1 validators (`validation.ts`) run in v1 only and were never wired into
 * v2. Porting them verbatim is wrong for two reasons:
 *
 *   1. The v1 `db_deviation` check re-derives a DB-scaled kcal using a
 *      cooked→raw conversion (`convertCookedToRaw`). v2 DELIBERATELY bypasses
 *      that yield-factor table (see bridge.ts) — the LLM already emits grams
 *      scoped to the selected candidate's state. Reintroducing it here would
 *      manufacture phantom deviations. So this module computes deviation
 *      against v2's ACTUAL server-anchored base (per_100g × grams / 100),
 *      the same base `bounded-macros.computeMacroBaseMap` builds.
 *
 *   2. For a MATCHED ingredient v2 already server-anchors protein/carb and
 *      derives kcal = 4P+4C+9F (`bounded-macros.resolveIngredientMacros`), so
 *      a matched macro_inconsistent is bounded BY CONSTRUCTION post-assembly.
 *      The real correctness risk lives on UNMATCHED ingredients (LLM owns all
 *      macros) and on GRAMS.
 *
 * This module CLASSIFIES each anomaly by likely cause and reports the SAFE
 * action taken. It never blindly clamps a suspected wrong-row/wrong-state
 * match — those are FLAG + telemetry only this phase (re-retrieval is a later
 * phase; the seam is left explicit).
 */

import { MAX_KCAL_PER_100G } from '../constants';
import type {
  MatchedIngredient,
  PipelineResult,
  UnmatchedIngredient,
} from '../types';

/**
 * Likely CAUSE of an anomaly. Distinct from `validation.ts`'s `AnomalyType`
 * (which names the SYMPTOM). Cause drives the action table below.
 */
export type AnomalyCause =
  | 'wrong_row' // matched food implausible for the ingredient name/density
  | 'wrong_state' // raw/cooked mismatch signal
  | 'implausible_grams' // portion out of physical range for the concept
  | 'macro_inconsistent' // kcal != 4P+4C+9F beyond tolerance
  | 'unmatched_high_uncertainty' // unmatched ingredient, wide/implausible interval
  | 'legit_prep_adjustment'; // within prep-note bounds — NOT an anomaly

/**
 * SAFE action taken for an anomaly this phase. Conservative by design — no
 * latency-blowup retry loops beyond the single gated escalation.
 */
export type AnomalyAction =
  | 'none' // legit_prep_adjustment — informational only
  | 'flag_only' // telemetry only, no mutation (wrong_row/state, implausible grams, macro identity breaks)
  | 'kcal_rederived' // RESERVED (no current producer): standalone kcal := 4P+4C+9F correction
  | 'interval_widened' // unmatched_high_uncertainty — uncertainty made visible, never a clarify
  | 'escalation_candidate'; // high-confidence correctness anomaly → gated re-run

export interface V2Anomaly {
  cause: AnomalyCause;
  action: AnomalyAction;
  severity: 'info' | 'warning' | 'error';
  message: string;
  ingredientName: string;
  mealItemName: string;
}

// ---------------------------------------------------------------------------
// Thresholds (exported for test assertions). Deliberately separate from v1's
// THRESHOLDS so v2 tuning never perturbs v1 behavior.
// ---------------------------------------------------------------------------

export const V2_ANOMALY_THRESHOLDS = {
  /** kcal identity tolerance; denominator is max(reportedKcal, 1). */
  MACRO_KCAL_IDENTITY_TOLERANCE: 0.2,
  /** Physical portion band per ingredient (grams). Below/above → implausible. */
  MIN_GRAMS: 1,
  MAX_GRAMS: 1500,
  /** Unmatched interval is "too wide" when (high-low)/mid exceeds this — the
   *  same spirit as the Phase-3 resolver's too-wide gate that routes to
   *  clarify. Kept local so this module has no import cycle with the resolver. */
  UNMATCHED_INTERVAL_WIDTH_RATIO: 1.5,
  /** kcal/100g physical ceiling — a matched density above this smells like a
   *  wrong_row (the DB row is for a denser food than the user's concept). */
  MAX_KCAL_PER_100G,
} as const;

function kcalFromMacros(p: number, c: number, f: number): number {
  return 4 * p + 4 * c + 9 * f;
}

/**
 * Classify anomalies over the ASSEMBLED v2 result. Pure: returns anomaly
 * records with cause + the SAFE action the pipeline takes. Does NOT mutate the
 * result. The deterministic `kcal_rederived` action is already applied during
 * assembly by `bounded-macros.resolveIngredientMacros` (kcal := 4P+4C+9F for
 * matched ingredients; `rederiveKcal` below mirrors it for a standalone
 * correction), so a `macro_inconsistent` observed here on a MATCHED ingredient
 * should be rare — when it appears it is telemetered so we can watch it drop.
 */
export function classifyV2Anomalies(input: {
  result: PipelineResult;
  matched: MatchedIngredient[];
  unmatched: UnmatchedIngredient[];
  /** Ingredient names carrying a user-typed prep note (macro band unlocked). */
  prepNoteIngredientNames: Set<string>;
}): V2Anomaly[] {
  const { result, matched, unmatched, prepNoteIngredientNames } = input;
  const anomalies: V2Anomaly[] = [];
  const matchedByName = new Map<string, MatchedIngredient>();
  for (const m of matched) matchedByName.set(m.ingredientName, m);
  const unmatchedNames = new Set(unmatched.map((u) => u.ingredientName));

  for (const mealItem of result.mealItems) {
    for (const ing of mealItem.ingredients) {
      const grams = ing.estimatedGrams;
      const b = ing.boundedNutrition;
      const kcalMid = b.caloriesKcal?.mid ?? 0;
      const pMid = b.proteinG?.mid ?? 0;
      const cMid = b.carbohydrateG?.mid ?? 0;
      const fMid = b.fatG?.mid ?? 0;
      const isUnmatched = unmatchedNames.has(ing.ingredientName);
      const match = matchedByName.get(ing.ingredientName);

      // --- implausible_grams: portion out of physical range -----------------
      // flag_only: eval showed this fires on plausible meals, so it stays
      // advisory. Nothing here gates a result — the estimate ships and the
      // user corrects the portion with the visual picker.
      if (
        grams < V2_ANOMALY_THRESHOLDS.MIN_GRAMS ||
        grams > V2_ANOMALY_THRESHOLDS.MAX_GRAMS
      ) {
        anomalies.push({
          cause: 'implausible_grams',
          action: 'flag_only',
          severity: 'warning',
          message: `${ing.ingredientName}: ${grams.toFixed(0)}g outside physical band [${V2_ANOMALY_THRESHOLDS.MIN_GRAMS}, ${V2_ANOMALY_THRESHOLDS.MAX_GRAMS}]`,
          ingredientName: ing.ingredientName,
          mealItemName: mealItem.name,
        });
      }

      // --- macro_inconsistent: kcal != 4P+4C+9F -----------------------------
      const identity = kcalFromMacros(pMid, cMid, fMid);
      const denom = Math.max(kcalMid, 1);
      const deviation = Math.abs(kcalMid - identity) / denom;
      if (deviation > V2_ANOMALY_THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE) {
        // Assembly is the re-derivation authority (kcal := 4P+4C+9F is baked
        // into DB-anchored macros there); an inconsistency observed HERE means
        // that invariant broke upstream — telemeter it, don't mutate a result
        // that's already streamed. flag_only for both matched and unmatched.
        anomalies.push({
          cause: 'macro_inconsistent',
          action: 'flag_only',
          severity: 'warning',
          message: `${ing.ingredientName}: kcal ${kcalMid.toFixed(0)} vs 4P+4C+9F=${identity.toFixed(0)} (${(deviation * 100).toFixed(0)}%)`,
          ingredientName: ing.ingredientName,
          mealItemName: mealItem.name,
        });
      }

      // --- unmatched_high_uncertainty: wide/implausible interval ------------
      if (isUnmatched) {
        const low = b.caloriesKcal?.low ?? 0;
        const high = b.caloriesKcal?.high ?? 0;
        const width = high - low;
        const widthRatio = width / Math.max(kcalMid, 1);
        if (widthRatio > V2_ANOMALY_THRESHOLDS.UNMATCHED_INTERVAL_WIDTH_RATIO) {
          // Too wide to trust the number. Telemeter it at warning severity —
          // it no longer routes to a clarify, the estimate ships and the user
          // corrects the portion with the visual picker.
          anomalies.push({
            cause: 'unmatched_high_uncertainty',
            action: 'interval_widened',
            severity: 'warning',
            message: `${ing.ingredientName}: unmatched interval too wide (${low.toFixed(0)}–${high.toFixed(0)} kcal, ${(widthRatio * 100).toFixed(0)}% of mid)`,
            ingredientName: ing.ingredientName,
            mealItemName: mealItem.name,
          });
        } else if (width > 0) {
          // Present but within band — record the widened-interval action so the
          // uncertainty is visible without demanding a clarify.
          anomalies.push({
            cause: 'unmatched_high_uncertainty',
            action: 'interval_widened',
            severity: 'info',
            message: `${ing.ingredientName}: unmatched estimate, interval ${low.toFixed(0)}–${high.toFixed(0)} kcal`,
            ingredientName: ing.ingredientName,
            mealItemName: mealItem.name,
          });
        }
      }

      // --- wrong_row / wrong_state: matched-only correctness smells ---------
      if (match) {
        const density = grams > 0 ? (kcalMid / grams) * 100 : 0;
        if (density > V2_ANOMALY_THRESHOLDS.MAX_KCAL_PER_100G) {
          // A matched ingredient whose per-100g energy exceeds pure fat implies
          // the DB row is for a denser food than the user's concept → wrong_row.
          // FLAG ONLY — do NOT silently clamp a suspected wrong-row match. The
          // re-retrieval loop is a later phase; this is the escalation seam.
          anomalies.push({
            cause: 'wrong_row',
            action: 'escalation_candidate',
            severity: 'warning',
            message: `${ing.ingredientName}: matched density ${density.toFixed(0)} kcal/100g > ${V2_ANOMALY_THRESHOLDS.MAX_KCAL_PER_100G} (row="${match.matchedName}") — suspected wrong row`,
            ingredientName: ing.ingredientName,
            mealItemName: mealItem.name,
          });
        }
        // wrong_state: dbState 'unknown' AND a prep/cooking signal is a weaker
        // smell — flag only, never mutate.
        if (match.dbState === 'unknown') {
          anomalies.push({
            cause: 'wrong_state',
            action: 'flag_only',
            severity: 'info',
            message: `${ing.ingredientName}: matched row state unknown (row="${match.matchedName}") — cannot confirm raw/cooked alignment`,
            ingredientName: ing.ingredientName,
            mealItemName: mealItem.name,
          });
        }
      }

      // --- legit_prep_adjustment: within prep-note bounds, NOT an anomaly ---
      if (
        match &&
        prepNoteIngredientNames.has(ing.ingredientName) &&
        deviation <= V2_ANOMALY_THRESHOLDS.MACRO_KCAL_IDENTITY_TOLERANCE
      ) {
        anomalies.push({
          cause: 'legit_prep_adjustment',
          action: 'none',
          severity: 'info',
          message: `${ing.ingredientName}: within prep-note macro band — expected adjustment, not an anomaly`,
          ingredientName: ing.ingredientName,
          mealItemName: mealItem.name,
        });
      }
    }
  }

  return anomalies;
}

/**
 * Deterministic SAFE action for `macro_inconsistent` on a MATCHED ingredient:
 * re-derive kcal from the (server-anchored) macros so kcal := 4P+4C+9F becomes
 * authoritative. Returns a NEW bounded caloriesKcal triple; callers apply it in
 * place. This is exactly what `bounded-macros.deriveCaloriesFromMacros` does at
 * resolve time — exported here so the anomaly layer's "action" is testable and
 * so a post-assembly correction has a single source of truth.
 */
export function rederiveKcal(macros: {
  proteinG: { low: number; mid: number; high: number };
  carbohydrateG: { low: number; mid: number; high: number };
  fatG: { low: number; mid: number; high: number };
}): { low: number; mid: number; high: number } {
  return {
    low: kcalFromMacros(
      macros.proteinG.low,
      macros.carbohydrateG.low,
      macros.fatG.low
    ),
    mid: kcalFromMacros(
      macros.proteinG.mid,
      macros.carbohydrateG.mid,
      macros.fatG.mid
    ),
    high: kcalFromMacros(
      macros.proteinG.high,
      macros.carbohydrateG.high,
      macros.fatG.high
    ),
  };
}

export interface V2AnomalySummary {
  /** Count per cause — the telemetry payload for staging dashboards. */
  causeCounts: Record<AnomalyCause, number>;
  /** Count per action. */
  actionCounts: Record<AnomalyAction, number>;
  /** Anomaly-type markers for the pipeline_runs anomaly_types text[] column. */
  markers: string[];
  /**
   * True when ≥1 HIGH-confidence correctness anomaly (an escalation_candidate)
   * was found — the signal the orchestrator's gated escalation seam reads.
   */
  hasEscalationCandidate: boolean;
}

/**
 * Fold a list of v2 anomalies into telemetry counts + markers. Kept separate
 * from classification so the summary shape is stable for the telemetry writer.
 */
export function summarizeV2Anomalies(anomalies: V2Anomaly[]): V2AnomalySummary {
  const causeCounts = {
    wrong_row: 0,
    wrong_state: 0,
    implausible_grams: 0,
    macro_inconsistent: 0,
    unmatched_high_uncertainty: 0,
    legit_prep_adjustment: 0,
  } satisfies Record<AnomalyCause, number>;
  const actionCounts = {
    none: 0,
    flag_only: 0,
    kcal_rederived: 0,
    interval_widened: 0,
    escalation_candidate: 0,
  } satisfies Record<AnomalyAction, number>;

  for (const a of anomalies) {
    causeCounts[a.cause]++;
    actionCounts[a.action]++;
  }

  const markers: string[] = [];
  for (const [cause, n] of Object.entries(causeCounts)) {
    if (n > 0) markers.push(`v2_cause_${cause}_${n}`);
  }

  return {
    causeCounts,
    actionCounts,
    markers,
    hasEscalationCandidate: actionCounts.escalation_candidate > 0,
  };
}
