import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  NULL_BOUNDED_NUTRITION,
  NULL_NUTRITION_VALUES,
} from '../../__tests__/test-helpers';
import type { BoundedNutrition, PipelineResponse } from '../../types';
import {
  runShadow,
  runShadowAsync,
  type ShadowGuard,
  type ShadowRunnerDeps,
  type ShadowRunPersistRow,
} from '../shadow-runner';

function makePipelineResponse(args: {
  caloriesMid: number;
  ingredientNames: string[];
  success?: true;
}): PipelineResponse;
function makePipelineResponse(args: { success: false }): PipelineResponse;
function makePipelineResponse(
  args:
    | { caloriesMid: number; ingredientNames: string[]; success?: true }
    | { success: false }
): PipelineResponse {
  if (args.success === false) {
    return {
      success: false,
      error: { type: 'api_error', message: 'fixture failure', retryable: true },
    };
  }

  const cal = args.caloriesMid;
  const ingredientNames = args.ingredientNames;
  const bn = (mid: number): BoundedNutrition => ({
    ...NULL_BOUNDED_NUTRITION,
    caloriesKcal: { low: mid * 0.9, mid, high: mid * 1.1 },
    proteinG: { low: 0, mid: 0, high: 0 },
    carbohydrateG: { low: 0, mid: 0, high: 0 },
    fatG: { low: 0, mid: 0, high: 0 },
  });
  const nv = {
    ...NULL_NUTRITION_VALUES,
    caloriesKcal: cal,
    proteinG: 0,
    carbohydrateG: 0,
    fatG: 0,
  };

  return {
    success: true,
    data: {
      mealItems: [
        {
          name: 'meal-1',
          ingredients: ingredientNames.map((n, i) => ({
            ingredientName: n,
            foodCompositionId: `id-${i}`,
            estimatedGrams: 100,
            rawEquivalentGrams: 100,
            cookingMethod: null,
            userFacingUnit: null,
            matchConfidence: 0.9,
            boundedNutrition: bn(cal / ingredientNames.length),
            displayedNutrition: nv,
          })),
          boundedNutrition: bn(cal),
          displayedNutrition: nv,
        },
      ],
      mealSlot: null,
      confidenceOverall: 'medium',
      boundedNutrition: bn(cal),
      displayedNutrition: nv,
      unmatchedIngredients: [],
    },
  };
}

const primary = makePipelineResponse({
  caloriesMid: 500,
  ingredientNames: ['thịt bò bắp', 'bánh phở'],
});

describe('runShadow', () => {
  let runCandidate: ReturnType<typeof vi.fn<() => Promise<PipelineResponse>>>;
  let persistShadowRun: ReturnType<
    typeof vi.fn<(row: ShadowRunPersistRow) => Promise<void>>
  >;
  let deps: ShadowRunnerDeps;

  beforeEach(() => {
    runCandidate = vi.fn().mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 520,
        ingredientNames: ['thịt bò bắp', 'bánh phở'],
      })
    );
    persistShadowRun = vi.fn().mockResolvedValue(undefined);
    deps = { runCandidate, persistShadowRun, now: () => 1000 };
  });

  afterEach(() => vi.restoreAllMocks());

  it('persists a row with outcome="completed" on the happy path', async () => {
    await runShadow(
      {
        requestId: 'req-1',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
        primaryRunId: 'run-1',
      },
      deps
    );

    expect(persistShadowRun).toHaveBeenCalledOnce();
    const row = persistShadowRun.mock.calls[0][0];
    expect(row.outcome).toBe('completed');
    expect(row.requestId).toBe('req-1');
    expect(row.primaryRunId).toBe('run-1');
    expect(row.divergence.macroDeltaPct).toBeCloseTo(0.04, 2);
    expect(row.divergence.ingredientCountDelta).toBe(0);
  });

  it('records macro divergence > 30% when present', async () => {
    runCandidate.mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 800,
        ingredientNames: ['thịt bò bắp', 'bánh phở'],
      })
    );

    await runShadow(
      {
        requestId: 'req-2',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps
    );

    expect(
      persistShadowRun.mock.calls[0][0].divergence.macroDeltaPct
    ).toBeGreaterThan(0.3);
  });

  it('records ingredient-count delta', async () => {
    runCandidate.mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 500,
        ingredientNames: ['thịt bò bắp'],
      })
    );

    await runShadow(
      {
        requestId: 'req-3',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps
    );

    expect(
      persistShadowRun.mock.calls[0][0].divergence.ingredientCountDelta
    ).toBe(-1);
  });

  it('persists outcome="errored" when the candidate run throws', async () => {
    runCandidate.mockRejectedValue(new Error('boom'));

    await expect(
      runShadow(
        {
          requestId: 'req-4',
          primary,
          candidatePromptLabel: 'v3',
          candidateModel: 'gemini-2.5-pro',
        },
        deps
      )
    ).resolves.toBeUndefined();

    expect(persistShadowRun.mock.calls[0][0].outcome).toBe('errored');
  });

  it('records candidate failure in divergence (success=false branch)', async () => {
    runCandidate.mockResolvedValue(makePipelineResponse({ success: false }));

    await runShadow(
      {
        requestId: 'req-fail-cand',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps
    );

    const row = persistShadowRun.mock.calls[0][0];
    expect(row.outcome).toBe('completed');
    expect(row.divergence.candidateFailed).toBe(true);
  });

  it('handles a failed primary without throwing', async () => {
    const failedPrimary = makePipelineResponse({ success: false });

    await expect(
      runShadow(
        {
          requestId: 'req-fail-prim',
          primary: failedPrimary,
          candidatePromptLabel: 'v3',
          candidateModel: 'gemini-2.5-pro',
        },
        deps
      )
    ).resolves.toBeUndefined();

    expect(persistShadowRun.mock.calls[0][0].divergence.primaryFailed).toBe(
      true
    );
  });

  it('never throws — primary user response must not be perturbed', async () => {
    runCandidate.mockRejectedValue(new Error('boom'));
    persistShadowRun.mockRejectedValue(new Error('db down'));

    await expect(
      runShadow(
        {
          requestId: 'req-5',
          primary,
          candidatePromptLabel: 'v3',
          candidateModel: 'gemini-2.5-pro',
        },
        deps
      )
    ).resolves.toBeUndefined();
  });
});

describe('runShadowAsync (guard wrapper)', () => {
  function makeGuard(decision: { run: boolean; reason?: string }): ShadowGuard {
    return {
      shouldRun: vi.fn().mockResolvedValue(decision),
      onPrimaryComplete: vi.fn(),
    } as ShadowGuard;
  }

  let runCandidate: ReturnType<typeof vi.fn<() => Promise<PipelineResponse>>>;
  let persistShadowRun: ReturnType<
    typeof vi.fn<(row: ShadowRunPersistRow) => Promise<void>>
  >;
  let deps: ShadowRunnerDeps;

  beforeEach(() => {
    runCandidate = vi.fn().mockResolvedValue(
      makePipelineResponse({
        caloriesMid: 510,
        ingredientNames: ['thịt bò bắp'],
      })
    );
    persistShadowRun = vi.fn().mockResolvedValue(undefined);
    deps = { runCandidate, persistShadowRun, now: () => 0 };
  });

  it.each([
    ['aborted_primary_p95'],
    ['aborted_pool_wait'],
    ['aborted_embed_rate_limit'],
  ] as const)('persists outcome=%s when guard returns that reason', async (reason) => {
    const guard = makeGuard({ run: false, reason });

    await runShadowAsync(
      {
        requestId: 'req-abort',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps,
      guard
    );

    expect(runCandidate).not.toHaveBeenCalled();
    const row = persistShadowRun.mock.calls[0][0];
    expect(row.outcome).toBe(reason);
    expect(row.candidateOutput).toBeNull();
  });

  it('delegates to runShadow when guard says run', async () => {
    const guard = makeGuard({ run: true });

    await runShadowAsync(
      {
        requestId: 'req-go',
        primary,
        candidatePromptLabel: 'v3',
        candidateModel: 'gemini-2.5-pro',
      },
      deps,
      guard
    );

    expect(runCandidate).toHaveBeenCalledOnce();
    expect(persistShadowRun.mock.calls[0][0].outcome).toBe('completed');
  });

  it('swallows guard.shouldRun() errors and never throws', async () => {
    const guard: ShadowGuard = {
      shouldRun: vi.fn().mockRejectedValue(new Error('guard down')),
      onPrimaryComplete: vi.fn(),
    };

    await expect(
      runShadowAsync(
        {
          requestId: 'req-guard-err',
          primary,
          candidatePromptLabel: 'v3',
          candidateModel: 'gemini-2.5-pro',
        },
        deps,
        guard
      )
    ).resolves.toBeUndefined();
  });
});
