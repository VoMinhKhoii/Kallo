import { describe, expect, it } from 'vitest';
import {
  anchorPositions,
  claimedAnchor,
  committedPieceTier,
  glyphRowAspect,
  glyphWidthRatio,
  nearestAnchor,
  type PortionAnchor,
  positionBreaks,
  rulerStep,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { PIECE_TIERS } from '@/lib/ai/portion/data/vessel-tables';
import { pieceAssetFor } from '@/lib/ai/portion/vessel/geometry';
import type { PieceVessel } from '@/lib/ai/portion/vessel/types';

const anchors: PortionAnchor[] = [
  { tier: 1, value: 100, label: 'small' },
  { tier: 2, value: 200, label: 'medium' },
  { tier: 3, value: 300, label: 'large' },
  { tier: 4, value: 400, label: 'extra large' },
];

describe('nearestAnchor', () => {
  it('returns exact and nearest anchors', () => {
    expect(nearestAnchor(anchors, 200).tier).toBe(2);
    expect(nearestAnchor(anchors, 275).tier).toBe(3);
  });
});

describe('claimedAnchor', () => {
  it('claims a tier at its exact value', () => {
    expect(claimedAnchor(anchors, 200)?.tier).toBe(2);
  });

  it('claims a tier at both ±10% edges', () => {
    expect(claimedAnchor(anchors, 180)?.tier).toBe(2);
    expect(claimedAnchor(anchors, 220)?.tier).toBe(2);
  });

  it('claims nothing outside the band', () => {
    expect(claimedAnchor(anchors, 250)).toBeNull();
    expect(claimedAnchor(anchors, 500)).toBeNull();
  });
});

describe('committedPieceTier', () => {
  const pieceAnchors: PortionAnchor<1 | 2 | 3 | 4 | 5>[] = [
    { tier: 1, value: 100, label: 'small' },
    { tier: 2, value: 200, label: 'medium' },
    { tier: 3, value: 300, label: 'large' },
  ];

  it('commits the claimed tier at an anchor and at the band edge', () => {
    expect(committedPieceTier(1, pieceAnchors, 300)).toBe(3);
    expect(committedPieceTier(1, pieceAnchors, 330)).toBe(3);
  });

  it('preserves the current tier for a custom portion', () => {
    expect(committedPieceTier(3, pieceAnchors, 500)).toBe(3);
    expect(committedPieceTier(1, pieceAnchors, 250)).toBe(1);
  });
});

describe('anchor position helpers', () => {
  it('spaces five anchors at the legacy fixed positions', () => {
    expect(anchorPositions(5)).toEqual([10, 30, 50, 70, 90]);
    expect(positionBreaks(5)).toEqual([0, 100, 300, 500, 700, 900, 1000]);
  });
});

describe('glyphWidthRatio', () => {
  const kinds: PieceVessel['kind'][] = ['fish', 'meat', 'poultry'];
  /** Glyph geometry in column units: width is the ratio, height follows aspect. */
  const glyph = (tierIndex: number, kind: PieceVessel['kind']) => {
    const tier = PIECE_TIERS[tierIndex];
    const { aspect } = pieceAssetFor(tier, kind);
    const width = glyphWidthRatio(tier.grams, aspect);
    return { width, height: width / aspect, area: width * (width / aspect) };
  };
  const everyGlyph = kinds.flatMap((kind) =>
    PIECE_TIERS.map((_, index) => ({ kind, ...glyph(index, kind) }))
  );

  it('keeps every silhouette inside its column', () => {
    // The bug this replaces: a tier-5 fish was 130px wide in a ~54px column,
    // overlapping tier 4 and spilling off the right of the row.
    expect(everyGlyph).toHaveLength(15);
    for (const { width } of everyGlyph) {
      expect(width).toBeGreaterThan(0);
      expect(width).toBeLessThanOrEqual(1);
    }
  });

  it('lets the widest silhouette fill its column exactly', () => {
    // A slack normaliser would shrink every glyph for no reason.
    expect(Math.max(...everyGlyph.map((g) => g.width))).toBeCloseTo(1, 10);
  });

  it('never grows a glyph taller than its column is wide', () => {
    // Row height is pinned to the tallest glyph, so this bounds the picker.
    for (const { height } of everyGlyph) {
      expect(height).toBeLessThanOrEqual(1);
    }
  });

  it('sizes the row to the tallest glyph, with no slack and no clipping', () => {
    const columns = PIECE_TIERS.length;
    // Row height in column widths, recovered from the aspect the row is given.
    const rowHeight = columns / glyphRowAspect(columns);
    const tallest = Math.max(...everyGlyph.map((g) => g.height));
    expect(rowHeight).toBeCloseTo(tallest, 10);
    for (const { height } of everyGlyph) {
      expect(height).toBeLessThanOrEqual(rowHeight);
    }
  });

  it('grows visual area strictly across the tiers, for every kind', () => {
    for (const kind of kinds) {
      const areas = PIECE_TIERS.map((_, index) => glyph(index, kind).area);
      for (let i = 1; i < areas.length; i += 1) {
        expect(areas[i]).toBeGreaterThan(areas[i - 1]);
      }
    }
  });

  it('gives equal grams equal area whatever the art’s shape', () => {
    // Height alone used to carry the amount, so a wide fillet read as far more
    // food than a compact drumstick of the same weight.
    for (const [index] of PIECE_TIERS.entries()) {
      const [fish, meat, poultry] = kinds.map(
        (kind) => glyph(index, kind).area
      );
      expect(meat).toBeCloseTo(fish, 10);
      expect(poultry).toBeCloseTo(fish, 10);
    }
  });

  it('scales area as grams^(2/3) — the cbrt law the ruler always meant', () => {
    const smallest = glyph(0, 'fish');
    const largest = glyph(PIECE_TIERS.length - 1, 'fish');
    const grams = PIECE_TIERS.at(-1)!.grams / PIECE_TIERS[0].grams;
    expect(largest.area / smallest.area).toBeCloseTo(grams ** (2 / 3), 10);
  });
});

describe('rulerStep', () => {
  it('moves at least 1 g in every segment', () => {
    const gramBreaks = [60, 100, 200, 300, 400, 500, 600];
    const breaks = positionBreaks(5);
    const step = rulerStep(gramBreaks, breaks);
    for (let i = 0; i < breaks.length - 1; i += 1) {
      const gramsPerStep =
        (step * (gramBreaks[i + 1] - gramBreaks[i])) /
        (breaks[i + 1] - breaks[i]);
      expect(gramsPerStep).toBeGreaterThanOrEqual(1);
    }
  });

  it('ignores zero-width gram segments and never returns 0', () => {
    expect(rulerStep([100, 100, 100], [0, 500, 1000])).toBe(1);
  });
});
