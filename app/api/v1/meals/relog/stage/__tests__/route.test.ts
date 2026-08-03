import type { NextRequest } from 'next/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const stageRelogAnalysisAction = vi.fn();
const requireAuthAndProfile = vi.fn();
const checkAnalysisGuards = vi.fn();

vi.mock('@/lib/actions/meals/relog/stage-relog-analysis', () => ({
  stageRelogAnalysisAction,
}));

vi.mock('@/lib/auth', () => ({ requireAuthAndProfile }));

vi.mock('@/lib/rate-limit/analysis-guards', () => ({ checkAnalysisGuards }));

const { POST } = await import('@/app/api/v1/meals/relog/stage/route');

function makeRequest(body: unknown): NextRequest {
  return { json: async () => body } as unknown as NextRequest;
}

const SOURCE_MEAL_ID = '2b8e2f6a-4f9f-4d38-9f6e-1a2b3c4d5e6f';
const ATTEMPT_ID = '7c3d9a1e-5b2f-4c8a-9e1d-3f6a8b2c4d5e';

const validBody = {
  items: [{ kind: 'dish', sourceMealId: SOURCE_MEAL_ID, mealItemOrder: 0 }],
  loggedDate: '2026-07-02',
  timezoneOffset: -420,
  attemptId: ATTEMPT_ID,
};

const staged = {
  analysisId: 'analysis-1',
  parsedMeal: { items: [] },
  rawInput: 'Cà phê sữa đá',
  loggedAt: '2026-07-02T03:00:00.000Z',
};

const release = vi.fn();

beforeEach(() => {
  stageRelogAnalysisAction.mockReset();
  requireAuthAndProfile.mockReset();
  checkAnalysisGuards.mockReset();
  release.mockReset();
  stageRelogAnalysisAction.mockResolvedValue(staged);
  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: {},
  });
  checkAnalysisGuards.mockResolvedValue({ allowed: true, release });
});

describe('POST /api/v1/meals/relog/stage', () => {
  it('stages the picked references and returns the pending analysis', async () => {
    const res = await POST(makeRequest(validBody));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual(staged);
    expect(stageRelogAnalysisAction).toHaveBeenCalledWith(validBody);
  });

  it('accepts a meal reference, which carries no mealItemOrder', async () => {
    const res = await POST(
      makeRequest({
        ...validBody,
        items: [{ kind: 'meal', sourceMealId: SOURCE_MEAL_ID }],
      })
    );

    expect(res.status).toBe(200);
    expect(stageRelogAnalysisAction).toHaveBeenCalledWith(
      expect.objectContaining({
        items: [{ kind: 'meal', sourceMealId: SOURCE_MEAL_ID }],
      })
    );
  });

  it('strips client-supplied nutrition — references only cross the wire', async () => {
    await POST(
      makeRequest({
        ...validBody,
        items: [
          {
            kind: 'dish',
            sourceMealId: SOURCE_MEAL_ID,
            mealItemOrder: 0,
            // A tampered client trying to dictate the saved numbers.
            caloriesKcal: 99_999,
            name: 'not the stored name',
          },
        ],
      })
    );

    const [input] = stageRelogAnalysisAction.mock.calls[0];
    expect(input.items[0]).toEqual({
      kind: 'dish',
      sourceMealId: SOURCE_MEAL_ID,
      mealItemOrder: 0,
    });
  });

  it('rejects a non-UUID sourceMealId with 400 before staging', async () => {
    const res = await POST(
      makeRequest({
        ...validBody,
        items: [{ kind: 'dish', sourceMealId: 'nope', mealItemOrder: 0 }],
      })
    );

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  it('rejects a request with no attemptId', async () => {
    // The upsert keys on (user_id, attempt_id) and NULLs never conflict, so an
    // optional attemptId would let a client insert unbounded pending rows.
    const { attemptId, ...withoutAttempt } = validBody;
    expect(attemptId).toBeDefined();

    const res = await POST(makeRequest(withoutAttempt));

    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  it('rejects a non-UUID attemptId', async () => {
    const res = await POST(
      makeRequest({ ...validBody, attemptId: 'not-a-uuid' })
    );

    expect(res.status).toBe(400);
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  it('rejects an empty pick list with 400', async () => {
    const res = await POST(makeRequest({ ...validBody, items: [] }));

    expect(res.status).toBe(400);
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  it('rejects more than 20 staged picks with 400', async () => {
    const res = await POST(
      makeRequest({
        ...validBody,
        items: Array.from({ length: 21 }, () => ({
          kind: 'meal',
          sourceMealId: SOURCE_MEAL_ID,
        })),
      })
    );

    expect(res.status).toBe(400);
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  it('rejects an unauthenticated request with 401, before staging', async () => {
    const { Errors } = await import('@/lib/errors');
    requireAuthAndProfile.mockRejectedValueOnce(Errors.notAuthenticated());

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(401);
    expect(checkAnalysisGuards).not.toHaveBeenCalled();
    expect(stageRelogAnalysisAction).not.toHaveBeenCalled();
  });

  describe('rate limiting', () => {
    it('throttles per user before doing any database work', async () => {
      checkAnalysisGuards.mockResolvedValue({
        allowed: false,
        status: 429,
        reason: 'per_user_minute',
        retryAfterSeconds: 42,
      });

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(429);
      expect(res.headers.get('Retry-After')).toBe('42');
      expect(
        stageRelogAnalysisAction,
        'a throttled request must not reach the staging transaction'
      ).not.toHaveBeenCalled();
    });

    it('guards on the authenticated user, never a client-supplied id', async () => {
      await POST(makeRequest(validBody));

      expect(checkAnalysisGuards).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-123',
          route: 'meals-relog-stage',
        })
      );
    });

    it('releases the in-flight slot even when staging throws', async () => {
      const { Errors } = await import('@/lib/errors');
      stageRelogAnalysisAction.mockRejectedValueOnce(
        Errors.validationFailed('Món không còn tồn tại.')
      );

      const res = await POST(makeRequest(validBody));

      expect(res.status).toBe(400);
      // Leaking the slot would lock the user out of relog until the stale
      // in-flight sweep catches up.
      expect(release).toHaveBeenCalled();
    });

    it('releases the in-flight slot on success', async () => {
      await POST(makeRequest(validBody));
      expect(release).toHaveBeenCalled();
    });
  });

  it('propagates a dead-reference validation error as 400', async () => {
    const { Errors } = await import('@/lib/errors');
    stageRelogAnalysisAction.mockRejectedValueOnce(
      Errors.validationFailed('Món không còn tồn tại.')
    );

    const res = await POST(makeRequest(validBody));
    expect(res.status).toBe(400);
    const { error } = await res.json();
    expect(error.code).toBe('VALIDATION_FAILED');
  });
});
