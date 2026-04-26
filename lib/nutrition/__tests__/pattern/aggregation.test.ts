import { describe, expect, it } from 'vitest';

import {
  buildNutrientCard,
  getNutrientStatus,
  getPercentOfTarget,
  getSodiumCaveatKey,
} from '@/lib/nutrition/pattern/aggregation';

describe('nutrition aggregation helpers', () => {
  it('builds vitamin A context from beta-carotene without changing score', () => {
    const card = buildNutrientCard({
      nutrient: 'vitaminAMcg',
      averagePerDay: 350,
      target: 700,
      targetSource: 'vietnam_rda',
      confidence: 80,
      betaCaroteneAveragePerDay: 1200,
    });

    expect(card.percentOfTarget).toBe(50);
    expect(card.contextMetrics).toEqual([
      {
        key: 'betaCaroteneMcg',
        labelKey: 'nutrition.nutrients.betaCarotene',
        averagePerDay: 1200,
        unit: 'mcg',
      },
    ]);
  });

  it('returns null percent when there is no usable target', () => {
    expect(getPercentOfTarget(350, null)).toBeNull();
    expect(getPercentOfTarget(350, 0)).toBeNull();
    expect(getPercentOfTarget(null, 700)).toBeNull();
  });

  it('maps nutrient status thresholds exactly', () => {
    expect(getNutrientStatus(89, 80)).toBe('below_target');
    expect(getNutrientStatus(90, 80)).toBe('adequate');
    expect(getNutrientStatus(111, 80)).toBe('above_target');
    expect(getNutrientStatus(90, 39.9)).toBe('limited_data');
    expect(getNutrientStatus(90, 40)).toBe('adequate');
    expect(getNutrientStatus(null, 80)).toBe('limited_data');
  });

  it('shows sodium caveat for low confidence', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 69.9,
        faoVietnamCalorieShare: 0,
        faoVietnamConfidence: null,
        missingSodiumCondimentItems: 0,
      })
    ).toBe('nutrition.caveats.sodium');
  });

  it('shows sodium caveat when condiment sodium is missing', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 90,
        faoVietnamCalorieShare: 0.1,
        faoVietnamConfidence: 100,
        missingSodiumCondimentItems: 1,
      })
    ).toBe('nutrition.caveats.sodium');
  });

  it('shows sodium caveat for FAO-heavy low-confidence meals', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 90,
        faoVietnamCalorieShare: 0.2,
        faoVietnamConfidence: 69.9,
        missingSodiumCondimentItems: 0,
      })
    ).toBe('nutrition.caveats.sodium');
  });

  it('does not show a sodium caveat when all signals are healthy', () => {
    expect(
      getSodiumCaveatKey({
        confidence: 90,
        faoVietnamCalorieShare: 0.19,
        faoVietnamConfidence: 69.9,
        missingSodiumCondimentItems: 0,
      })
    ).toBeUndefined();
  });

  it('maps unsupported target sources and supportsCandidates defaults', () => {
    const card = buildNutrientCard({
      nutrient: 'sodiumMg',
      averagePerDay: 400,
      target: null,
      targetSource: 'unsupported',
      confidence: 80,
    });

    expect(card.targetSourceLabelKey).toBe(
      'nutrition.targetSources.unsupported'
    );
    expect(card.supportsCandidates).toBe(false);
  });

  it('preserves supportsCandidates when enabled', () => {
    const card = buildNutrientCard({
      nutrient: 'calciumMg',
      averagePerDay: 800,
      target: 1000,
      targetSource: 'who_fao',
      confidence: 80,
      supportsCandidates: true,
    });

    expect(card.supportsCandidates).toBe(true);
  });
});
