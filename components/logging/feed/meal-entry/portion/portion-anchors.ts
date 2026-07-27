import {
  midG,
  PIECE_TIERS,
  type PieceVesselTier,
  VESSEL_FAMILIES,
  type VesselTier,
} from '@/lib/ai/portion/vessel-data';
import type {
  ContainerVessel,
  PieceVessel,
} from '@/lib/ai/portion/vessel-types';

/** Every tier a vessel family can expose (containers stop at 4, pieces at 5). */
export type AnchorTier = PieceVesselTier;

export interface PortionAnchor<T extends AnchorTier = AnchorTier> {
  tier: T;
  value: number;
  label: string;
}

/** Gram envelope around the anchors the picker lets the user roam in. */
export const ENVELOPE_MIN_FACTOR = 0.6;
export const ENVELOPE_MAX_FACTOR = 1.2;
/** A piece portion may claim a tier's label only within ±10% of its grams. */
export const CLAIM_BAND = 0.1;
/** The ruler's slider runs in integer position space, not grams. */
export const POSITION_MAX = 1000;

export function gramEnvelope(anchors: PortionAnchor[]): {
  min: number;
  max: number;
} {
  return {
    min: Math.round(anchors[0].value * ENVELOPE_MIN_FACTOR),
    max: Math.round(anchors[anchors.length - 1].value * ENVELOPE_MAX_FACTOR),
  };
}

export function buildContainerAnchors(
  vessel: ContainerVessel,
  loc: 'en' | 'vi'
): PortionAnchor<VesselTier>[] {
  const tiers: VesselTier[] = [1, 2, 3, 4];
  return tiers.map((tier) => ({
    tier,
    value: midG(vessel.family, tier, vessel.dishClass),
    label: VESSEL_FAMILIES[vessel.family].tiers[tier].label[loc],
  }));
}

export function buildPieceAnchors(
  vessel: PieceVessel,
  loc: 'en' | 'vi'
): PortionAnchor<PieceVesselTier>[] {
  return PIECE_TIERS.map((tier, index) => ({
    tier: (index + 1) as PieceVesselTier,
    value: vessel.count * tier.grams,
    label: tier.label[loc],
  }));
}

/** Nearest anchor by absolute gram distance — always returns one. */
export function nearestAnchor<T extends AnchorTier>(
  anchors: PortionAnchor<T>[],
  grams: number
): PortionAnchor<T> {
  return anchors.reduce((best, anchor) =>
    Math.abs(anchor.value - grams) < Math.abs(best.value - grams)
      ? anchor
      : best
  );
}

/**
 * The anchor a portion may honestly claim: the nearest one, but only when the
 * grams sit within `CLAIM_BAND` of its value. `null` means "custom portion" —
 * the single source of truth for display, commit, and the assumption line.
 */
export function claimedAnchor<T extends AnchorTier>(
  anchors: PortionAnchor<T>[],
  grams: number
): PortionAnchor<T> | null {
  const nearest = nearestAnchor(anchors, grams);
  return Math.abs(grams - nearest.value) <= nearest.value * CLAIM_BAND
    ? nearest
    : null;
}

/**
 * The tier a piece portion may be committed with: the claimed one, or the
 * current tier left untouched when the portion is custom — never a tier the
 * picker refused to display.
 */
export function committedPieceTier(
  current: PieceVesselTier,
  anchors: PortionAnchor<PieceVesselTier>[],
  grams: number
): PieceVesselTier {
  return claimedAnchor(anchors, grams)?.tier ?? current;
}

/** Equal-spaced track positions (%) — one per anchor, centred in its slot. */
export function anchorPositions(count: number): number[] {
  return Array.from({ length: count }, (_, i) => ((i + 0.5) / count) * 100);
}

/** Position-space breakpoints: track start, each anchor, track end. */
export function positionBreaks(count: number): number[] {
  return [
    0,
    ...anchorPositions(count).map((p) => (p / 100) * POSITION_MAX),
    POSITION_MAX,
  ];
}

/**
 * Slider step in position space. Taken from the flattest segment (the largest
 * position-per-gram slope), so one arrow press moves at least 1 g in every
 * segment — the coarse segments simply move more.
 */
export function rulerStep(
  gramBreaks: readonly number[],
  positions: readonly number[]
): number {
  let steepest = 0;
  for (let i = 0; i < positions.length - 1; i += 1) {
    const dGrams = gramBreaks[i + 1] - gramBreaks[i];
    if (dGrams <= 0) continue;
    steepest = Math.max(steepest, (positions[i + 1] - positions[i]) / dGrams);
  }
  return Math.max(1, Math.ceil(steepest));
}

/** Piecewise-linear interpolation of `x` from the `xs` domain onto `ys`. */
export function interpolate(
  x: number,
  xs: readonly number[],
  ys: readonly number[]
): number {
  if (x <= xs[0]) return ys[0];
  if (x >= xs[xs.length - 1]) return ys[ys.length - 1];
  for (let i = 0; i < xs.length - 1; i += 1) {
    if (x <= xs[i + 1]) {
      const f = (x - xs[i]) / (xs[i + 1] - xs[i]);
      return ys[i] + f * (ys[i + 1] - ys[i]);
    }
  }
  return ys[ys.length - 1];
}
