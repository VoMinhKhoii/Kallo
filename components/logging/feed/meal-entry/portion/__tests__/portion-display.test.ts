import { describe, expect, it } from 'vitest';
import {
  buildContainerAnchors,
  countPrefix,
  repointVesselTo,
  vesselAnchors,
  vesselEnvelope,
} from '@/components/logging/feed/meal-entry/portion/portion-anchors';
import { portionDisplay } from '@/components/logging/feed/meal-entry/portion/portion-display';
import { tapeScale } from '@/components/logging/feed/meal-entry/portion/tape/vessel-tape-geometry';
import type {
  ContainerVessel,
  PieceVessel,
} from '@/lib/ai/portion/vessel/types';

/** A Vietnamese bowl of plain rice: 150 g in its small bowl. */
const rice = (count?: number): ContainerVessel => ({
  family: 'bowl',
  tier: 1,
  dishClass: 'solid',
  smallBowlG: 150,
  ...(count !== undefined ? { count } : {}),
});
const pho = (count?: number): ContainerVessel => ({
  family: 'bowl',
  tier: 2,
  dishClass: 'soup',
  ...(count !== undefined ? { count } : {}),
});
const label = (v: ContainerVessel, grams: number, loc: 'en' | 'vi' = 'vi') =>
  portionDisplay(v, grams, loc).label;

describe('countPrefix', () => {
  it('writes halves and quarters as fractions, other counts as a multiple', () => {
    expect(countPrefix(1)).toBe('');
    expect(countPrefix(0.5)).toBe('½ ');
    expect(countPrefix(0.25)).toBe('¼ ');
    expect(countPrefix(1.5)).toBe('1.5 × ');
    expect(countPrefix(2)).toBe('2 × ');
  });
});

describe('a counted container', () => {
  it('scales every anchor by the count, like pieces do', () => {
    const one = buildContainerAnchors(pho(), 'en');
    const two = buildContainerAnchors(pho(2), 'en');
    expect(two.map((a) => a.value)).toEqual(one.map((a) => a.value * 2));
    expect(two[1].label).toBe('2 × medium bowl');
  });

  it('reads half a bowl of rice in whole rice bowls', () => {
    const half = buildContainerAnchors(rice(0.5), 'vi');
    expect(half[0]).toEqual({ tier: 1, value: 75, label: '½ chén nhỏ' });
    expect(label(rice(0.5), 75)).toBe('½ chén nhỏ');
    expect(label(rice(0.5), 75, 'en')).toBe('½ small bowl');
  });

  it('names one, one and a half, and two bowls', () => {
    expect(label(rice(), 150)).toBe('chén nhỏ');
    expect(label(rice(1.5), 225)).toBe('1.5 × chén nhỏ');
    expect(label(rice(2), 300)).toBe('2 × chén nhỏ');
    const twoPho = buildContainerAnchors(pho(2), 'vi')[1].value;
    expect(label(pho(2), twoPho)).toBe('2 × tô vừa');
    expect(label(pho(2), twoPho, 'en')).toBe('2 × medium bowl');
  });

  it('opens a half-bowl meal at its own grams, inside the tape', () => {
    const v = rice(0.5);
    const { min, max } = vesselEnvelope(v, vesselAnchors(v, 'vi'));
    expect(min).toBeLessThanOrEqual(75);
    expect(max).toBeGreaterThan(75);
  });
});

describe('dragging a container down to half', () => {
  const v = rice();
  const anchors = vesselAnchors(v, 'vi');
  const { min, max } = vesselEnvelope(v, anchors);

  it('starts the tape at half the first vessel, not 60% of it', () => {
    expect(min).toBe(75);
    expect(tapeScale(anchors, min, max).toGrams(0)).toBe(75);
  });

  it('names half the first vessel near the left end, the vessel above it', () => {
    expect(label(v, 75)).toBe('½ chén nhỏ');
    expect(label(v, 100)).toBe('½ chén nhỏ');
    expect(label(v, 120)).toBe('chén nhỏ');
    expect(label(v, 150, 'en')).toBe('small bowl');
  });

  it('commits tier 1 and keeps the count, so the card names the same half', () => {
    const committed = repointVesselTo(v, 75, 'vi');
    expect(committed).toEqual(v);
    expect(label(committed as ContainerVessel, 75)).toBe('½ chén nhỏ');
  });

  it('halves a counted vessel to a whole one', () => {
    const two = rice(2);
    const twoAnchors = vesselAnchors(two, 'vi');
    expect(vesselEnvelope(two, twoAnchors).min).toBe(150);
    expect(label(two, 150)).toBe('chén nhỏ');
  });

  it('keeps the count and moves the tier as the grams cross anchors', () => {
    const two = pho(2);
    const [, medium, large] = buildContainerAnchors(two, 'vi');
    const at = repointVesselTo(two, Math.round(large.value), 'vi');
    expect(at).toEqual({ ...two, tier: 3 });
    expect(label(at as ContainerVessel, Math.round(large.value))).toBe(
      '2 × tô lớn'
    );
    expect(repointVesselTo(two, Math.round(medium.value), 'vi')).toEqual(two);
  });
});

describe('the piece tape is unchanged', () => {
  it('still starts at 60% of the smallest cut', () => {
    const piece: PieceVessel = {
      family: 'piece',
      tier: 3,
      count: 1,
      kind: 'meat',
    };
    const anchors = vesselAnchors(piece, 'en');
    expect(vesselEnvelope(piece, anchors).min).toBe(
      Math.round(anchors[0].value * 0.6)
    );
  });
});
