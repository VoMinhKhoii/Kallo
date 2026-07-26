import { describe, expect, it } from 'vitest';
import {
  nearestAnchor,
  type PortionAnchor,
} from '@/components/logging/feed/meal-entry/portion-picker-body';

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
