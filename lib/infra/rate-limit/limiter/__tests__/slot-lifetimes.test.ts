/**
 * Each one-at-a-time slot's lifetime against the longest its request can run.
 *
 * The lifetime is the crash bound: a slot whose release never arrives reads
 * as free once it passes. Shorter than the request, and a slow but healthy
 * request loses its slot mid-flight, letting the same person run another
 * alongside it. Much longer, and a lost release refuses that person for no
 * reason (relog's picker was refused for up to 90 s, Oct 2026).
 *
 * The OCR, RevenueCat and DB connect deadlines are imported, so raising one
 * past its slot's lifetime fails here. Analyze-meal's 60 s `maxDuration` is
 * restated: Next reads it statically, so it stays a literal in the route.
 */

import { describe, expect, it } from 'vitest';
import { NUTRITION_LABEL_OCR_DEADLINE_MS } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { REVENUECAT_TIMEOUT_MS } from '@/lib/domain/billing/revenuecat/client';
import { DB_CONNECT_TIMEOUT_DEFAULT_S } from '@/lib/infra/db/client';
import { rateLimitPolicies } from '../policies';

/** `app/api/analyze-meal/route.ts` `maxDuration`, and Cloud Run's `--timeout`. */
const ANALYZE_MEAL_MAX_DURATION_S = 60;

const {
  analyzeMeal,
  labelOcr,
  relogCandidates,
  relogWrite,
  entitlementsReconcile,
} = rateLimitPolicies;

describe('slot lifetimes', () => {
  it('outlast the request each slot guards', () => {
    expect(analyzeMeal.concurrency.ttlSeconds).toBeGreaterThan(
      ANALYZE_MEAL_MAX_DURATION_S
    );
    // The provider call, plus one wait for a pooled connection (the global
    // budget charge before it). The upload read is bounded by the body size
    // cap, not by a deadline, so it is left to the margin.
    expect(labelOcr.concurrency.ttlSeconds).toBeGreaterThan(
      NUTRITION_LABEL_OCR_DEADLINE_MS / 1000 + DB_CONNECT_TIMEOUT_DEFAULT_S
    );
    // Millisecond queries; the bound is the wait for a pooled connection.
    expect(relogCandidates.concurrency.ttlSeconds).toBeGreaterThan(
      DB_CONNECT_TIMEOUT_DEFAULT_S
    );
    expect(relogWrite.concurrency.ttlSeconds).toBeGreaterThan(
      DB_CONNECT_TIMEOUT_DEFAULT_S
    );
    // The RevenueCat read, plus one wait for a pooled connection for the
    // grant writes after it.
    expect(entitlementsReconcile.concurrency.ttlSeconds).toBeGreaterThan(
      REVENUECAT_TIMEOUT_MS / 1000 + DB_CONNECT_TIMEOUT_DEFAULT_S
    );
  });

  it('stay short where the request is short', () => {
    // A lost release refuses its holder for the whole lifetime.
    expect(relogCandidates.concurrency.ttlSeconds).toBeLessThanOrEqual(20);
    expect(relogWrite.concurrency.ttlSeconds).toBeLessThanOrEqual(30);
  });
});
