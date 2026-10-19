import type { IngredientV2MatchResult } from '@/lib/ai/matching/candidate';
import type { DecomposedIngredientV2 } from '@/lib/ai/pipeline/contracts/schemas/decomposition-v2';
import type {
  GroundedIngredientEstimate,
  RefuseKind,
} from '@/lib/ai/pipeline/contracts/schemas/grounded-estimation';
import type { MassBasis, PortionResolution } from '@/lib/ai/portion/types';

export type AppliedRefuseSource = 'authoritative_edible_anchor' | 'model';

export interface RefuseResolutionTelemetry {
  grossG: number;
  /** What Call 2 named as not eaten, before it sized refusePct. */
  refuseKind: RefuseKind;
  /** Call 2's kind and share disagree (none with a share, or a kind at 0%). Logged only. */
  refuseKindMismatch: boolean;
  modelRefusePct: number;
  candidateDbRefusePct: number | null;
  appliedRefusePct: number;
  appliedRefuseSource: AppliedRefuseSource;
  edibleG: number;
  massBasis: MassBasis;
}

export interface GroundedMassResolution {
  /** Edible mass consumed by the existing bridge and macro math. */
  edibleG: number | null;
  /** Mass the model's macro triples describe, before server overrides. */
  modelEdibleG: number | null;
  massBasis: MassBasis | null;
  refuse: RefuseResolutionTelemetry | null;
}

interface AuthoritativeMass {
  grams: number;
  basis: MassBasis;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

/**
 * The refuse share applied to Call 2's gross grams: its own `refusePct`,
 * clamped to 0–80. No name-keyword override: Call 2 reads the same words, and
 * a keyword rule only misreads them ("xương nạc" meaty bones once read as a
 * boneless "nạc" and dropped 45% refuse to 0).
 */
export function resolveRefusePct(args: {
  modelRefusePct: number;
  candidateInediblePct: number | null;
}): Omit<
  RefuseResolutionTelemetry,
  'grossG' | 'edibleG' | 'massBasis' | 'refuseKind' | 'refuseKindMismatch'
> {
  const modelRefusePct = clamp(args.modelRefusePct, 0, 80);
  // Candidate DB refuse is comparison telemetry only. It describes the DB
  // row's physical form, which is not proven compatible with the served form.
  const candidateDbRefusePct =
    args.candidateInediblePct != null &&
    Number.isFinite(args.candidateInediblePct)
      ? clamp(args.candidateInediblePct, 0, 80)
      : null;
  return {
    modelRefusePct,
    candidateDbRefusePct,
    appliedRefusePct: modelRefusePct,
    appliedRefuseSource: 'model',
  };
}

export function resolveGroundedMass(args: {
  ground: GroundedIngredientEstimate | null;
  candidateInediblePct: number | null;
  authoritativeMass?: AuthoritativeMass | null;
}): GroundedMassResolution {
  const { ground } = args;
  if (!ground) {
    return {
      edibleG: null,
      modelEdibleG: null,
      massBasis: null,
      refuse: null,
    };
  }
  const decision = resolveRefusePct({
    modelRefusePct: ground.refusePct,
    candidateInediblePct: args.candidateInediblePct,
  });
  const modelEdibleG = ground.grossG * (1 - decision.modelRefusePct / 100);
  const anchor = args.authoritativeMass;
  const authoritativeEdible = anchor?.basis === 'edible';
  const grossG =
    anchor?.basis === 'gross_as_served' ? anchor.grams : ground.grossG;
  const appliedRefusePct = authoritativeEdible ? 0 : decision.appliedRefusePct;
  const appliedRefuseSource = authoritativeEdible
    ? 'authoritative_edible_anchor'
    : decision.appliedRefuseSource;
  const edibleG = authoritativeEdible
    ? anchor.grams
    : grossG * (1 - appliedRefusePct / 100);
  const massBasis = authoritativeEdible
    ? anchor.basis
    : ('gross_as_served' as const);

  return {
    edibleG,
    modelEdibleG,
    massBasis,
    refuse: {
      ...decision,
      grossG,
      refuseKind: ground.refuseKind,
      refuseKindMismatch:
        (ground.refuseKind === 'none') !== (decision.modelRefusePct === 0),
      appliedRefusePct,
      appliedRefuseSource,
      edibleG,
      massBasis,
    },
  };
}

/**
 * The candidate row Call 2 picked ("c2" is the second), or undefined when it
 * picked none or an id that names no candidate.
 */
export function selectedCandidate(
  estimate: GroundedIngredientEstimate | null | undefined,
  match: IngredientV2MatchResult | undefined
): IngredientV2MatchResult['candidates'][number] | undefined {
  const idx = /^c(\d+)$/.exec(estimate?.selectedCandidateId ?? '')?.[1];
  return idx ? match?.candidates[Number(idx) - 1] : undefined;
}

/** The server portion anchor the bridge ships in place of Call 2's mass. */
export function portionAnchor(portion: PortionResolution | undefined) {
  return portion?.grams &&
    portion.provenance !== 'llm_range' &&
    portion.provenance !== 'unresolved' &&
    portion.grams.mid > 0
    ? { grams: portion.grams.mid, basis: portion.massBasis ?? 'unknown' }
    : null;
}

function shippedMass(
  estimate: GroundedIngredientEstimate,
  match: IngredientV2MatchResult | undefined,
  anchor: ReturnType<typeof portionAnchor>
): GroundedMassResolution {
  const candidate = selectedCandidate(estimate, match);
  return resolveGroundedMass({
    ground: estimate,
    candidateInediblePct: candidate?.inediblePct ?? null,
    authoritativeMass: anchor,
  });
}

/**
 * The edible grams the bridge ships for one ingredient, by the bridge's own
 * rules (`resolveGroundedMass`: Call 2's refuse share, or a server portion
 * anchor when there is one). Linear in `grossG` when unanchored, which
 * is what lets scaling a set of parts' gross mass hit a target exactly.
 */
export function shippedEdibleGrams(
  estimate: GroundedIngredientEstimate,
  match: IngredientV2MatchResult | undefined,
  portion: PortionResolution | undefined
): number {
  return shippedMass(estimate, match, portionAnchor(portion)).edibleG ?? 0;
}

/**
 * Call 2's plate grams per row gram for a part priced on a raw or dry row
 * (`servedG / grossG`: ~2.5 for dry pasta, ~0.75 for raw meat), or 1 when the
 * row is cooked or Call 2 gave no `servedG`, so its grams are already the
 * plate's. A raw pick the review rejected keeps no row but still carries the
 * grams Call 2 emitted for it, so its `servedG` still holds.
 */
export function servedPerRowGram(
  estimate: GroundedIngredientEstimate,
  match: IngredientV2MatchResult | undefined
): number {
  const state = selectedCandidate(estimate, match)?.info.state;
  const rowGrams = state === 'raw' || state === undefined;
  return rowGrams && estimate.servedG ? estimate.servedG / estimate.grossG : 1;
}

/**
 * The as-served grams behind what the bridge ships for one ingredient: its
 * gross mass, bones and shells included, unless it ships an edible anchor,
 * and cooked as on the plate when it is priced on a raw or dry row. A typed
 * weight is already the plate's unless the user weighed it raw. What a scale
 * reads for the food on the plate; also linear in `grossG`.
 */
export function shippedServedGrams(
  estimate: GroundedIngredientEstimate,
  ingredient: DecomposedIngredientV2,
  match: IngredientV2MatchResult | undefined,
  portion: PortionResolution | undefined
): number {
  const anchor = portionAnchor(portion);
  const m = shippedMass(estimate, match, anchor);
  const rowGrams =
    m.massBasis === 'gross_as_served'
      ? (m.refuse?.grossG ?? 0)
      : (m.edibleG ?? 0);
  const plateAnchor = anchor !== null && ingredient.stateHint !== 'raw_weight';
  return plateAnchor ? rowGrams : rowGrams * servedPerRowGram(estimate, match);
}
