import {
  anchorPositions,
  glyphRowAspect,
  glyphWidthRatio,
  interpolate,
  POSITION_MAX,
  type PortionAnchor,
  positionBreaks,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import {
  PIECE_TIERS,
  VESSEL_FAMILIES,
  type VesselTier,
} from '@/lib/ai/portion/data/vessel-tables';
import { pieceAssetFor } from '@/lib/ai/portion/vessel/geometry';
import type { ClientVessel } from '@/lib/ai/portion/vessel/types';

/** Distance between two minor graduations — the Flutter tape's pitch. */
export const TAPE_PITCH = 11;
/** Minor graduations per vessel; one vessel owns an 88px column. */
export const TAPE_MINORS = 8;
export const TAPE_COLUMN = TAPE_PITCH * TAPE_MINORS;

/** The approved canvas's silhouette band (E4). An upright family whose
 *  tallest glyph would overrun it (cups, ~150px at full size) shrinks to fit,
 *  so every tape is one height. Same rule as the Flutter `ManualVesselRuler`. */
export const TAPE_MAX_BAND = 76;

/** Scale a family's glyphs down to the band, never up. */
function fitBand(glyphs: TapeGlyph[], band: number) {
  const scale = Math.min(1, TAPE_MAX_BAND / band);
  return {
    glyphs: glyphs.map((g) => ({
      ...g,
      width: g.width * scale,
      height: g.height * scale,
    })),
    band: band * scale,
  };
}

export interface TapeGlyph {
  src: string;
  width: number;
  height: number;
  /** The vessel's spoken name ("medium cut (150 g)"). */
  label: string;
}

/**
 * Each vessel's silhouette at the size the iOS ruler draws it: pieces by area
 * (`glyphWidthRatio`), containers by the cube root of volume, both normalised
 * so the widest fills its 88px column. `band` is the tallest any tier of the
 * family can draw (capped at `TAPE_MAX_BAND`), so the tape keeps one baseline.
 */
export function tapeGlyphs(
  vessel: ClientVessel,
  anchors: PortionAnchor[]
): { glyphs: TapeGlyph[]; band: number } {
  if (vessel.family === 'piece') {
    const glyphs = anchors.map((anchor) => {
      const tier = PIECE_TIERS[anchor.tier - 1];
      const asset = pieceAssetFor(tier, vessel.kind);
      const width = TAPE_COLUMN * glyphWidthRatio(tier.grams, asset.aspect);
      return {
        src: `/portions/${asset.file}`,
        width,
        height: width / asset.aspect,
        label: `${anchor.label} (${tier.sizeLabel})`,
      };
    });
    const n = anchors.length;
    return fitBand(glyphs, (TAPE_COLUMN * n) / glyphRowAspect(n));
  }
  const family = VESSEL_FAMILIES[vessel.family];
  const tiers = anchors.map((a) => family.tiers[a.tier as VesselTier]);
  const largest = tiers[tiers.length - 1].ml;
  const weights = tiers.map((t) => Math.cbrt(t.ml / largest) * t.aspect);
  const widest = Math.max(...weights);
  const glyphs = tiers.map((tier, i) => {
    const width = (TAPE_COLUMN * weights[i]) / widest;
    return {
      src: `/portions/${tier.asset}`,
      width,
      height: width / tier.aspect,
      label: `${anchors[i].label} (${tier.sizeLabel})`,
    };
  });
  return fitBand(glyphs, Math.max(...glyphs.map((g) => g.height)));
}

/** Grams ↔ tape fraction (0–1): piecewise linear through the anchors, which
 *  sit centred in their columns, with the range's ends at the tape's ends. */
export function tapeScale(anchors: PortionAnchor[], min: number, max: number) {
  const breaks = positionBreaks(anchors.length).map((p) => p / POSITION_MAX);
  const grams = [min, ...anchors.map((a) => a.value), max];
  return {
    toFraction: (value: number) => interpolate(value, grams, breaks),
    toGrams: (fraction: number) =>
      Math.round(interpolate(fraction, breaks, grams)),
    centres: anchorPositions(anchors.length).map((p) => p / 100),
  };
}

/** The tape's graduations: a tall tick on each vessel's centre, short ones
 *  between, at `TAPE_PITCH` apart. */
export function tapeTicks(count: number): { x: number; major: boolean }[] {
  return Array.from({ length: TAPE_MINORS * count + 1 }, (_, i) => ({
    x: i * TAPE_PITCH,
    major: i >= TAPE_MINORS / 2 && (i - TAPE_MINORS / 2) % TAPE_MINORS === 0,
  }));
}
