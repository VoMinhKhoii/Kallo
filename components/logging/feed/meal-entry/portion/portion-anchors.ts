import {
  PIECE_TIERS,
  type PieceVesselTier,
  VESSEL_FAMILIES,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import { midG } from '@/lib/ai/portion/vessel/geometry';
import type {
  ContainerVessel,
  PieceVessel,
} from '@/lib/ai/portion/vessel/types';

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

const LARGEST_PIECE_GRAMS = PIECE_TIERS[PIECE_TIERS.length - 1].grams;

/**
 * Relative visual area of a piece portion. A silhouette is a 2D projection of a
 * 3D amount, so its *area* — not its height — is what has to scale as
 * `grams^(2/3)` for twice the food to look twice as big. Sizing height alone (as
 * the ruler used to) only holds if every asset shares an aspect ratio: at
 * aspect 2.17 a tier-5 fish came out 130px wide in a ~54px column, overlapping
 * its neighbour and spilling off the row.
 */
function pieceAreaRatio(grams: number): number {
  return (grams / LARGEST_PIECE_GRAMS) ** (2 / 3);
}

/**
 * Widest unnormalised glyph across every piece asset. Dividing by it makes the
 * single widest silhouette exactly fill its column and every other one narrower,
 * so no glyph can overflow its column whatever the art's aspect ratios are.
 */
const WIDEST_PIECE_GLYPH = Math.max(
  ...PIECE_TIERS.flatMap((tier) =>
    tier.assets.map((asset) =>
      Math.sqrt(pieceAreaRatio(tier.grams) * asset.aspect)
    )
  )
);

/**
 * Ruler glyph width as a fraction (0–1] of its grid column, for art of the given
 * aspect at the given per-piece grams. Height follows from `aspect-ratio`, so
 * the pair encodes area while staying resolution-independent — the row scales
 * with the picker instead of hard-coding pixels. Count-independent by design.
 */
export function glyphWidthRatio(grams: number, aspect: number): number {
  return Math.sqrt(pieceAreaRatio(grams) * aspect) / WIDEST_PIECE_GLYPH;
}

/** Tallest glyph any kind can produce, in column widths. */
const TALLEST_PIECE_GLYPH = Math.max(
  ...PIECE_TIERS.flatMap((tier) =>
    tier.assets.map(
      (asset) => glyphWidthRatio(tier.grams, asset.aspect) / asset.aspect
    )
  )
);

/**
 * `aspect-ratio` for the glyph row, so its height is always the tallest glyph
 * the tallest kind can produce. Without it the row would size to its own
 * content and the picker would change height between a flat fillet and an
 * upright drumstick; pinning it keeps one silhouette baseline for every meal.
 */
export function glyphRowAspect(columnCount: number): number {
  return columnCount / TALLEST_PIECE_GLYPH;
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
