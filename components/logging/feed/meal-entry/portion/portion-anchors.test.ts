import { describe, expect, it } from 'vitest';
import {
  anchorPositions,
  claimedAnchor,
  committedPieceTier,
  nearestAnchor,
  type PortionAnchor,
  positionBreaks,
  rulerStep,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';

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
