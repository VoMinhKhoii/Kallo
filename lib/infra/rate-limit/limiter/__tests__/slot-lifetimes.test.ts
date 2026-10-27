/**
 * Each one-at-a-time slot's lifetime against the longest its request can run.
 *
 * The lifetime is the crash bound: a slot whose release never arrives reads
 * as free once it passes. Shorter than the request, and a slow but healthy
 * request loses its slot mid-flight, letting the same person run another
 * alongside it. Much longer, and a lost release refuses that person for no
 * reason (relog's picker was refused for up to 90 s, Oct 2026). These cases
 * pin each lifetime above its request's own deadline, so raising a deadline
 * without the lifetime fails here.
 */

import { describe, expect, it } from 'vitest';
import { NUTRITION_LABEL_OCR_DEADLINE_MS } from '@/lib/ai/pipeline/estimator/label-ocr/label-ocr';
import { rateLimitPolicies } from '../policies';

/** `app/api/analyze-meal/route.ts` `maxDuration`, and Cloud Run's `--timeout`. */
const ANALYZE_MEAL_MAX_DURATION_S = 60;
/** postgres.js `connect_timeout` default (`lib/infra/db/client.ts`). */
const DB_CONNECT_TIMEOUT_S = 10;
/** `AbortSignal.timeout` on the RevenueCat call (`revenuecat/client.ts`). */
const REVENUECAT_TIMEOUT_S = 8;

function ttlOf(name: keyof typeof rateLimitPolicies): number {
  const policy = rateLimitPolicies[name];
  if (!('concurrency' in policy) || !policy.concurrency) {
    throw new Error(`${name} holds no slot`);
  }
  return policy.concurrency.ttlSeconds;
}

describe('slot lifetimes', () => {
  it('outlast the request each slot guards', () => {
    expect(ttlOf('analyzeMeal')).toBeGreaterThan(ANALYZE_MEAL_MAX_DURATION_S);
    // The slot also covers the upload read and decode before the call.
    expect(ttlOf('labelOcr')).toBeGreaterThan(
      NUTRITION_LABEL_OCR_DEADLINE_MS / 1000 + DB_CONNECT_TIMEOUT_S
    );
    expect(ttlOf('relogCandidates')).toBeGreaterThan(DB_CONNECT_TIMEOUT_S);
    expect(ttlOf('relogWrite')).toBeGreaterThan(DB_CONNECT_TIMEOUT_S);
    expect(ttlOf('entitlementsReconcile')).toBeGreaterThan(
      REVENUECAT_TIMEOUT_S + DB_CONNECT_TIMEOUT_S
    );
  });

  it('stay short where the request is short', () => {
    // A lost release refuses its holder for the whole lifetime.
    expect(ttlOf('relogCandidates')).toBeLessThanOrEqual(20);
    expect(ttlOf('relogWrite')).toBeLessThanOrEqual(30);
  });
});
