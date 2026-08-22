import { describe, expect, it } from 'vitest';
import {
  NEXT_PROFILE,
  STABLE_PROFILE,
} from '@/lib/ai/pipeline/config/model-profile';
import {
  MEAL_FACTS_KEYS,
  type MealFactsForComputePolicy,
  pickComputePolicy,
  summarizeCandidateConfidence,
} from '@/lib/ai/pipeline/legacy/compute-policy';
import type { AnomalyType } from '@/lib/ai/pipeline/legacy/validation';

const baseFacts: MealFactsForComputePolicy = {
  ingredientCount: 3,
  matchedCount: 3,
  unmatchedCount: 0,
  anomalyTypes: [] as ReadonlyArray<AnomalyType>,
  parseRetryCount: 0,
  candidateConfidenceSummary: { high: 3, medium: 0, low: 0, ambiguous: 0 },
};

describe('pickComputePolicy', () => {
  it('returns the profile default model when nothing is unusual', () => {
    const decision = pickComputePolicy(baseFacts, NEXT_PROFILE);

    expect(decision.call2Model).toBe(NEXT_PROFILE.nutritionModel);
    expect(decision.escalateOnRetry).toBe(false);
  });

  it('escalates upfront when unmatched / total > 0.5', () => {
    const decision = pickComputePolicy(
      { ...baseFacts, ingredientCount: 4, matchedCount: 1, unmatchedCount: 3 },
      NEXT_PROFILE
    );

    expect(decision.call2Model).toBe(NEXT_PROFILE.escalationModel);
    expect(decision.escalateOnRetry).toBe(true);
  });

  it('does not escalate at exactly 50% unmatched', () => {
    const decision = pickComputePolicy(
      { ...baseFacts, ingredientCount: 4, matchedCount: 2, unmatchedCount: 2 },
      NEXT_PROFILE
    );

    expect(decision.call2Model).toBe(NEXT_PROFILE.nutritionModel);
  });

  it('marks escalateOnRetry=true when any anomaly is present', () => {
    const decision = pickComputePolicy(
      {
        ...baseFacts,
        anomalyTypes: [
          'calorie_density',
          'db_deviation',
        ] as ReadonlyArray<AnomalyType>,
      },
      NEXT_PROFILE
    );

    expect(decision.escalateOnRetry).toBe(true);
  });

  it('falls back to nutritionModel when profile.escalationModel is null', () => {
    const decision = pickComputePolicy(
      { ...baseFacts, ingredientCount: 4, matchedCount: 1, unmatchedCount: 3 },
      STABLE_PROFILE
    );

    expect(decision.call2Model).toBe(STABLE_PROFILE.nutritionModel);
    expect(decision.escalateOnRetry).toBe(false);
  });

  it('is pure — same input always yields same output', () => {
    const a = pickComputePolicy(baseFacts, NEXT_PROFILE);
    const b = pickComputePolicy(baseFacts, NEXT_PROFILE);
    const c = pickComputePolicy(baseFacts, NEXT_PROFILE);

    expect(a).toEqual(b);
    expect(b).toEqual(c);
  });

  it('accepts zero ingredientCount without dividing by zero', () => {
    const decision = pickComputePolicy(
      { ...baseFacts, ingredientCount: 0, matchedCount: 0, unmatchedCount: 0 },
      NEXT_PROFILE
    );

    expect(decision.call2Model).toBe(NEXT_PROFILE.nutritionModel);
    expect(decision.escalateOnRetry).toBe(false);
  });
});

describe('MealFactsForComputePolicy structural narrowness', () => {
  it('has only the spec-§4.2 fields', () => {
    const allowed: MealFactsForComputePolicy = {
      ingredientCount: 1,
      matchedCount: 1,
      unmatchedCount: 0,
      anomalyTypes: [],
      parseRetryCount: 0,
      candidateConfidenceSummary: { high: 1, medium: 0, low: 0, ambiguous: 0 },
    };

    expect(Object.keys(allowed).sort()).toEqual([
      'anomalyTypes',
      'candidateConfidenceSummary',
      'ingredientCount',
      'matchedCount',
      'parseRetryCount',
      'unmatchedCount',
    ]);
  });

  it('exports the runtime allowlist used to reject shape drift', () => {
    const drifted = { ...baseFacts, userId: 'should-not-be-here' };

    expect([...MEAL_FACTS_KEYS].sort()).toEqual([
      'anomalyTypes',
      'candidateConfidenceSummary',
      'ingredientCount',
      'matchedCount',
      'parseRetryCount',
      'unmatchedCount',
    ]);
    expect([...MEAL_FACTS_KEYS]).not.toContain('userId');
    expect(Object.keys(drifted)).toContain('userId');
  });
});

describe('summarizeCandidateConfidence', () => {
  it('buckets confidences by the spec thresholds', () => {
    const summary = summarizeCandidateConfidence([
      { matchConfidence: 0.95 },
      { matchConfidence: 0.85 },
      { matchConfidence: 0.84 },
      { matchConfidence: 0.65 },
      { matchConfidence: 0.5 },
      { matchConfidence: 0.4 },
      { matchConfidence: 0.39 },
      { matchConfidence: null },
    ]);

    expect(summary).toEqual({ high: 2, medium: 2, low: 2, ambiguous: 2 });
  });

  it('returns all-zero buckets for an empty input', () => {
    expect(summarizeCandidateConfidence([])).toEqual({
      high: 0,
      medium: 0,
      low: 0,
      ambiguous: 0,
    });
  });
});
