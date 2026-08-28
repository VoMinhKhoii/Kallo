import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FeatureLockedError } from '@/lib/core/errors/app-error';

/**
 * The throttle lives on the ACTIONS, not the routes.
 *
 * The REST routes exist for the Flutter client; the web composer imports these
 * same actions and calls them directly as Server Actions. When the guard sat on
 * the routes, that second caller was completely unthrottled — an authenticated
 * user could drive the unindexed candidate scan and the `FOR UPDATE` write path
 * as fast as they liked. These tests pin the guard to the shared boundary, so a
 * regression that moves it back out fails here rather than in production.
 */

const checkAnalysisGuards = vi.fn();
const requireAuthAndProfile = vi.fn();
const loadRelogDishCandidates = vi.fn();
const loadRelogMealCandidates = vi.fn();
const resolveRelogSources = vi.fn();
const assertFeatureAccess = vi.fn();

vi.mock('@/lib/infra/rate-limit/analysis-guards', () => ({
  checkAnalysisGuards,
}));
vi.mock('@/lib/domain/billing/feature-gate', () => ({ assertFeatureAccess }));
vi.mock('@/lib/infra/auth/session', () => ({ requireAuthAndProfile }));
vi.mock('@/lib/domain/logging/relog/dish-query', () => ({
  loadRelogDishCandidates,
}));
vi.mock('@/lib/domain/logging/relog/meal-query', () => ({
  loadRelogMealCandidates,
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { transaction: (fn: (tx: unknown) => unknown) => fn({}) },
}));
vi.mock('@/lib/actions/meals/relog/resolve-sources', () => ({
  resolveRelogSources,
}));

const { loadRelogCandidatesAction } = await import(
  '@/lib/actions/meals/relog/load-candidates'
);
const { stageRelogAnalysisAction } = await import(
  '@/lib/actions/meals/relog/stage-relog-analysis'
);
const { relogMealItemsAction } = await import(
  '@/lib/actions/meals/relog/relog-items'
);
const { RELOG_WRITE_ROUTE } = await import(
  '@/lib/infra/rate-limit/relog-guard'
);

const release = vi.fn();
const PROFILE_CREATED_AT = new Date('2026-01-01T00:00:00.000Z');

beforeEach(() => {
  checkAnalysisGuards.mockReset();
  requireAuthAndProfile.mockReset();
  loadRelogDishCandidates.mockReset();
  loadRelogMealCandidates.mockReset();
  resolveRelogSources.mockReset();
  assertFeatureAccess.mockReset();
  release.mockReset();

  requireAuthAndProfile.mockResolvedValue({
    user: { id: 'user-123' },
    profile: { createdAt: PROFILE_CREATED_AT },
  });
  checkAnalysisGuards.mockResolvedValue({ allowed: true, release });
  loadRelogDishCandidates.mockResolvedValue([]);
  loadRelogMealCandidates.mockResolvedValue([]);
});

describe('loadRelogCandidatesAction', () => {
  it('throttles on the authenticated user, not anything client-supplied', async () => {
    await loadRelogCandidatesAction({ q: 'pho', limit: 8 });

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-123',
        route: 'meals-relog-candidates',
      })
    );
  });

  it('runs no query at all when throttled', async () => {
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      retryAfterSeconds: 2,
    });

    await expect(loadRelogCandidatesAction({ q: 'pho' })).rejects.toMatchObject(
      { status: 429 }
    );

    // The scan is the thing being defended — reaching the DB and only then
    // refusing would defeat the whole guard.
    expect(loadRelogDishCandidates).not.toHaveBeenCalled();
    expect(loadRelogMealCandidates).not.toHaveBeenCalled();
  });

  it('releases the in-flight slot even when the search throws', async () => {
    loadRelogDishCandidates.mockRejectedValue(new Error('db down'));

    await expect(loadRelogCandidatesAction({ q: 'pho' })).rejects.toThrow(
      'db down'
    );
    expect(release).toHaveBeenCalledOnce();
  });
});

describe('the write actions share one counter', () => {
  // `checkAnalysisGuards` keys its window and in-flight counters on the route
  // string. A distinct key per write action hands a user an independent
  // `concurrentUser: 1` budget for each — two simultaneous transactions, both
  // holding `FOR UPDATE` on their source meals, against a pool that defaults
  // to 2. That is the starvation the guard exists to prevent.
  //
  // Asserted at the CALL SITES, not on the exported constant. Checking
  // `RELOG_WRITE_ROUTE === 'meals-relog-write'` only restates the constant —
  // either action could switch to a literal of its own and that assertion would
  // still pass, which is exactly the regression this needs to catch.
  //
  // Both actions are driven until they reach the guard and then fail inside it
  // (`resolveRelogSources` rejects), because what is under test is the key they
  // guard WITH, not what they do afterwards.
  const relogInput = {
    items: [{ kind: 'meal' as const, sourceMealId: crypto.randomUUID() }],
    loggedDate: '2026-08-03',
    timezoneOffset: 0,
  };

  it('stage keys the shared write route', async () => {
    resolveRelogSources.mockRejectedValue(new Error('stop here'));

    await expect(
      stageRelogAnalysisAction({
        ...relogInput,
        attemptId: crypto.randomUUID(),
      })
    ).rejects.toThrow('stop here');

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', route: RELOG_WRITE_ROUTE })
    );
  });

  it('instant-save keys the SAME route, not one of its own', async () => {
    resolveRelogSources.mockRejectedValue(new Error('stop here'));

    await expect(relogMealItemsAction(relogInput)).rejects.toThrow('stop here');

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', route: RELOG_WRITE_ROUTE })
    );
  });
});

describe('the write actions are premium-gated ahead of the rate guard', () => {
  // Relog is a Premium-card feature. The gate has to sit BEFORE
  // `withRelogGuard`, not inside it: a locked user's call can only end in 402,
  // so charging it against the shared relog write window would let a free
  // account drain the budget the paying surfaces share.
  const relogInput = {
    items: [{ kind: 'meal' as const, sourceMealId: crypto.randomUUID() }],
    loggedDate: '2026-08-03',
    timezoneOffset: 0,
  };

  function lock() {
    assertFeatureAccess.mockRejectedValue(
      new FeatureLockedError('relog', 'not_entitled', 'locked')
    );
  }

  it('stage refuses a locked user without spending rate budget', async () => {
    lock();

    await expect(
      stageRelogAnalysisAction({
        ...relogInput,
        attemptId: crypto.randomUUID(),
      })
    ).rejects.toBeInstanceOf(FeatureLockedError);

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      { userId: 'user-123', profileCreatedAt: PROFILE_CREATED_AT },
      'relog'
    );
    expect(checkAnalysisGuards).not.toHaveBeenCalled();
    expect(resolveRelogSources).not.toHaveBeenCalled();
  });

  it('instant-save refuses a locked user without spending rate budget', async () => {
    lock();

    await expect(relogMealItemsAction(relogInput)).rejects.toBeInstanceOf(
      FeatureLockedError
    );

    expect(assertFeatureAccess).toHaveBeenCalledWith(
      { userId: 'user-123', profileCreatedAt: PROFILE_CREATED_AT },
      'relog'
    );
    expect(checkAnalysisGuards).not.toHaveBeenCalled();
    expect(resolveRelogSources).not.toHaveBeenCalled();
  });

  it('an unlocked user reaches the guard exactly as before', async () => {
    resolveRelogSources.mockRejectedValue(new Error('stop here'));

    await expect(relogMealItemsAction(relogInput)).rejects.toThrow('stop here');

    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'user-123', route: RELOG_WRITE_ROUTE })
    );
  });

  it('reads stay open — candidates never consults the gate', async () => {
    await loadRelogCandidatesAction({ q: 'pho', limit: 8 });

    expect(assertFeatureAccess).not.toHaveBeenCalled();
  });
});
