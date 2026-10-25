import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const settle = vi.fn(async (_cost: number | null) => undefined);
const addLate = vi.fn();
const acquireSpendLease = vi.fn(async (..._args: unknown[]) => ({
  release: settle,
  addLate,
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  acquireSpendLease: (...args: unknown[]) => acquireSpendLease(...args),
  aiSpendEstimatesUsd: { meal: 0.03, labelOcr: 0.01 },
}));

const { createAiSpend, withAiSpend } = await import('../ai-spend');
const { meterAttemptSpend } = await import('../spend-meter');

/** One priced attempt: 1000 input + 100 output on flash-lite = $0.0004. */
function pricedAttempt() {
  meterAttemptSpend('gemini-3.1-flash-lite', {
    inputTokens: 1000,
    outputTokens: 100,
    cachedTokens: 0,
    cacheWriteTokens: 0,
    thoughtTokens: 0,
  });
}

beforeEach(() => {
  settle.mockClear();
  addLate.mockClear();
  acquireSpendLease.mockClear();
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe('createAiSpend', () => {
  it('settles the sum of every attempt inside run, awaited or not', async () => {
    const spend = createAiSpend('meal', { userId: 'user-1' });
    await spend.reserve();

    await spend.run(async () => {
      pricedAttempt();
      // Work started without awaiting it (dish rescue, a chunk) still bills
      // to this meal: AsyncLocalStorage follows the promise it started in.
      const background = new Promise<void>((resolve) =>
        setTimeout(() => {
          pricedAttempt();
          resolve();
        }, 0)
      );
      await background;
    });
    await spend.settle();

    expect(acquireSpendLease).toHaveBeenCalledWith('meal', { enforce: true });
    expect(settle).toHaveBeenCalledOnce();
    expect(settle.mock.calls[0][0]).toBeCloseTo(0.0008, 10);
  });

  it('books the estimate when any attempt could not be priced', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    await spend.run(async () => {
      pricedAttempt();
      meterAttemptSpend('some-unpriced-model', {
        inputTokens: 10,
        outputTokens: 10,
        cachedTokens: null,
        cacheWriteTokens: null,
        thoughtTokens: null,
      });
    });
    await spend.settle();

    expect(settle).toHaveBeenCalledWith(0.03);
  });

  it('never books an unpriced run below what was already priced', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    await spend.run(async () => {
      // $0.04 priced, past the $0.03 estimate, then an unpriced attempt.
      for (let i = 0; i < 100; i++) pricedAttempt();
      meterAttemptSpend('some-unpriced-model', {
        inputTokens: 10,
        outputTokens: 10,
        cachedTokens: null,
        cacheWriteTokens: null,
        thoughtTokens: null,
      });
    });
    await spend.settle();

    expect(settle.mock.calls[0][0]).toBeCloseTo(0.04, 10);
  });

  it('treats an attempt with no usage at all as an unknown cost', async () => {
    const spend = createAiSpend('labelOcr');
    await spend.reserve();
    await spend.run(async () => {
      meterAttemptSpend('gemini-3.1-flash-lite', {
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        cacheWriteTokens: null,
        thoughtTokens: null,
      });
    });
    await spend.settle();

    expect(settle).toHaveBeenCalledWith(0.01);
  });

  it('adds an attempt that finishes after settle as a late cost', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    let finishLate: () => void = () => undefined;
    const late = new Promise<void>((resolve) => {
      finishLate = resolve;
    });

    void spend.run(async () => {
      await late;
      pricedAttempt();
    });
    await spend.settle();
    finishLate();
    await vi.waitFor(() => expect(addLate).toHaveBeenCalledOnce());

    expect(addLate.mock.calls[0][0]).toBeCloseTo(0.0004, 10);
  });

  it('books the estimate for an unpriced attempt that finishes after settle', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    let finishLate: () => void = () => undefined;
    const late = new Promise<void>((resolve) => {
      finishLate = resolve;
    });

    void spend.run(async () => {
      await late;
      meterAttemptSpend('gemini-3.1-flash-lite', {
        inputTokens: null,
        outputTokens: null,
        cachedTokens: null,
        cacheWriteTokens: null,
        thoughtTokens: null,
      });
    });
    await spend.settle();
    finishLate();
    await vi.waitFor(() => expect(addLate).toHaveBeenCalledOnce());

    expect(addLate).toHaveBeenCalledWith(0.03);
  });

  it('takes a per-user policy in the same reservation', async () => {
    const rateLimit = {
      policy: 'analyzeMeal',
      key: { kind: 'user', value: 'user-1' },
      countWindows: false,
    } as const;
    const spend = createAiSpend('meal', { userId: 'user-1', rateLimit });
    await spend.reserve();

    expect(acquireSpendLease).toHaveBeenCalledWith('meal', {
      enforce: true,
      rateLimit,
    });
  });

  it('settles once', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    await spend.settle();
    await spend.settle();
    expect(settle).toHaveBeenCalledOnce();
  });

  it('bills a nested run to the nested spend, not the outer one', async () => {
    const outer = createAiSpend('meal');
    await outer.reserve();

    await outer.run(async () => {
      await withAiSpend('shadow', {}, async () => {
        pricedAttempt();
      });
    });
    await outer.settle();

    // The shadow settled its attempt; the meal saw none.
    expect(settle.mock.calls[0][0]).toBeCloseTo(0.0004, 10);
    expect(settle.mock.calls[1][0]).toBe(0);
  });

  it('meters nothing outside a run', async () => {
    const spend = createAiSpend('meal');
    await spend.reserve();
    pricedAttempt();
    await spend.settle();
    expect(settle).toHaveBeenCalledWith(0);
  });

  it('never applies the brake to an App Review account', async () => {
    vi.stubEnv(
      'BILLING_SANDBOX_USER_IDS',
      '4541b370-41bb-4bf8-8076-0e7c1327933a'
    );
    const spend = createAiSpend('meal', {
      userId: '4541b370-41bb-4bf8-8076-0e7c1327933a',
    });
    await spend.reserve();

    expect(acquireSpendLease).toHaveBeenCalledWith('meal', { enforce: false });
  });

  it('settles nothing when nothing was reserved', async () => {
    const spend = createAiSpend('labelOcr');
    await spend.run(async () => pricedAttempt());
    await spend.settle();
    expect(settle).not.toHaveBeenCalled();
  });
});

describe('withAiSpend', () => {
  it('reserves before the work and settles after it, even when it throws', async () => {
    const order: string[] = [];
    acquireSpendLease.mockImplementationOnce(async () => {
      order.push('reserve');
      return { release: settle, addLate };
    });

    await expect(
      withAiSpend('debug', { userId: 'admin-1' }, async () => {
        order.push('work');
        throw new Error('boom');
      })
    ).rejects.toThrow('boom');

    expect(order).toEqual(['reserve', 'work']);
    expect(settle).toHaveBeenCalledOnce();
  });

  it('never runs the work when the brake refuses', async () => {
    acquireSpendLease.mockRejectedValueOnce(new Error('ai paused'));
    const work = vi.fn();

    await expect(withAiSpend('debug', {}, work)).rejects.toThrow('ai paused');
    expect(work).not.toHaveBeenCalled();
  });
});

describe('every model the app runs is priced', () => {
  // An unpriced model makes every attempt an unknown cost, and an unknown
  // cost keeps a call's whole estimate counted — so a meal on an unpriced
  // model would cost the brake $0.03 instead of ~$0.005, and $10 would trip
  // after about 330 meals a day.
  it('covers every model profile and the label OCR model', async () => {
    const { MODEL_RATES } = await import('../pricing');
    const { HAIKU_PROFILE, NEXT_PROFILE, STABLE_PROFILE } = await import(
      '@/lib/ai/pipeline/config/model-profile'
    );
    const { NUTRITION_LABEL_OCR_MODEL } = await import(
      '@/lib/ai/pipeline/estimator/label-ocr/label-ocr'
    );

    const models = [STABLE_PROFILE, NEXT_PROFILE, HAIKU_PROFILE].flatMap(
      (profile) => [
        profile.decompositionModel,
        profile.nutritionModel,
        profile.cheatModel,
        ...(profile.escalationModel ? [profile.escalationModel] : []),
      ]
    );
    for (const model of [...models, NUTRITION_LABEL_OCR_MODEL]) {
      expect(MODEL_RATES, model).toHaveProperty([model]);
    }
    // The OCR module's import graph is large; give it room on a busy runner.
  }, 30_000);
});
