import { classifyRefuseCut, type RefuseCutClass } from '../portion/refuse-cut';
import type { MassBasis, PortionProvenance } from '../portion/types';
import type { GroundedIngredientEstimate } from './schemas-v2';

export type { RefuseCutClass } from '../portion/refuse-cut';
export { classifyRefuseCut } from '../portion/refuse-cut';

export type AppliedRefuseSource =
  | 'authoritative_edible_anchor'
  | 'explicit_served_form'
  | 'model_cut_band'
  | 'model_unknown_form';

export interface RefuseResolutionTelemetry {
  grossG: number;
  modelRefusePct: number;
  candidateDbRefusePct: number | null;
  appliedRefusePct: number;
  appliedRefuseSource: AppliedRefuseSource;
  edibleG: number;
  massBasis: MassBasis;
  cutClass: RefuseCutClass | null;
  degenerateZero: boolean;
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
  provenance: PortionProvenance;
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value));
}

function normalizedEvidence(args: {
  canonicalName: string;
  rawName: string;
  prepNotes?: string[];
}): string {
  const normalized = [
    args.canonicalName,
    args.rawName,
    ...(args.prepNotes ?? []),
  ]
    .join(' ')
    .toLocaleLowerCase('vi-VN')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const folded = normalized
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/đ/g, 'd');
  return `${normalized} ${folded}`;
}

/** Served-form evidence that proves the food reaching the plate has no refuse. */
export function hasExplicitEdibleForm(args: {
  canonicalName: string;
  rawName: string;
  prepNotes?: string[];
}): boolean {
  const value = normalizedEvidence(args);
  return (
    /\b(?:boneless|fillets?|filets?|peeled|shelled|picked|skinless|shell off)\b/.test(
      value
    ) ||
    value.includes('phi lê') ||
    value.includes('phi le') ||
    /(?:^|\s)nạc(?:\s|$)/.test(value) ||
    value.includes('tách riêng') ||
    value.includes('separable lean') ||
    value.includes('bỏ xương') ||
    value.includes('bo xuong') ||
    value.includes('không xương') ||
    value.includes('khong xuong') ||
    value.includes('rút xương') ||
    value.includes('rut xuong') ||
    value.includes('bóc vỏ') ||
    value.includes('boc vo') ||
    value.includes('lột vỏ') ||
    value.includes('lot vo') ||
    value.includes('không vỏ') ||
    value.includes('khong vo') ||
    value.includes('thịt cua') ||
    value.includes('thit cua') ||
    value.includes('thịt ghẹ') ||
    value.includes('thit ghe') ||
    /\bcrab\s*meat\b/.test(value) ||
    value.includes('miếng cá') ||
    value.includes('mieng ca') ||
    /(?:trứng.*luộc|luộc.*trứng|trung.*luoc|luoc.*trung|boiled eggs?)/.test(
      value
    )
  );
}

export function resolveRefusePct(args: {
  modelRefusePct: number;
  candidateInediblePct: number | null;
  canonicalName: string;
  rawName: string;
  prepNotes?: string[];
}): Omit<RefuseResolutionTelemetry, 'grossG' | 'edibleG' | 'massBasis'> {
  const modelRefusePct = clamp(args.modelRefusePct, 0, 80);
  const band = classifyRefuseCut(args.canonicalName, args.rawName);
  const candidateDbRefusePct =
    args.candidateInediblePct != null &&
    Number.isFinite(args.candidateInediblePct)
      ? clamp(args.candidateInediblePct, 0, 80)
      : null;

  if (hasExplicitEdibleForm(args)) {
    return {
      modelRefusePct,
      candidateDbRefusePct,
      appliedRefusePct: 0,
      appliedRefuseSource: 'explicit_served_form',
      cutClass: band?.cutClass ?? null,
      degenerateZero: false,
    };
  }

  if (band) {
    const degenerateZero = modelRefusePct === 0;
    return {
      modelRefusePct,
      candidateDbRefusePct,
      appliedRefusePct: degenerateZero
        ? modelRefusePct
        : clamp(modelRefusePct, band.low, band.high),
      appliedRefuseSource: 'model_cut_band',
      cutClass: band.cutClass,
      degenerateZero,
    };
  }

  // Candidate DB refuse is comparison telemetry only. It describes the DB
  // row's physical form, which is not proven compatible with the served form.
  // It may become authoritative once rows carry a physical-form tag such as
  // whole_as_purchased / shell_on / bone_in and compatibility is validated.
  return {
    modelRefusePct,
    candidateDbRefusePct,
    appliedRefusePct: modelRefusePct,
    appliedRefuseSource: 'model_unknown_form',
    cutClass: null,
    degenerateZero: false,
  };
}

export function resolveGroundedMass(args: {
  ground: GroundedIngredientEstimate | null;
  candidateInediblePct: number | null;
  canonicalName: string;
  rawName: string;
  prepNotes?: string[];
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
  if ('grams' in ground) {
    const modelGrams =
      typeof ground.grams === 'number' && Number.isFinite(ground.grams)
        ? ground.grams
        : null;
    const edibleAnchor =
      args.authoritativeMass?.basis === 'edible' ||
      args.authoritativeMass?.basis === 'unknown'
        ? args.authoritativeMass.grams
        : null;
    return {
      edibleG: edibleAnchor ?? modelGrams,
      modelEdibleG: modelGrams,
      massBasis: 'edible',
      refuse: null,
    };
  }

  const decision = resolveRefusePct({
    modelRefusePct: ground.refusePct,
    candidateInediblePct: args.candidateInediblePct,
    canonicalName: args.canonicalName,
    rawName: args.rawName,
    prepNotes: args.prepNotes,
  });
  const modelEdibleG = ground.grossG * (1 - decision.modelRefusePct / 100);
  const anchor = args.authoritativeMass;
  const authoritativeEdible =
    anchor?.basis === 'edible' || anchor?.basis === 'unknown';
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
      appliedRefusePct,
      appliedRefuseSource,
      edibleG,
      massBasis,
    },
  };
}
