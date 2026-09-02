import { beforeEach, describe, expect, it, vi } from 'vitest';

const assertRateLimit = vi.fn();
const checkAnalysisGuards = vi.fn();
const buildAnalysisGuardEvent = vi.fn((input: unknown) => input);
const insertValues = vi.fn();
const insert = vi.fn(() => ({ values: insertValues }));

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/infra/rate-limit/analysis-guards', () => ({
  buildAnalysisGuardEvent,
  checkAnalysisGuards,
}));
vi.mock('@/lib/infra/db/client', () => ({ db: { insert } }));

const { withOcrGuard } = await import('@/lib/infra/rate-limit/ocr-guard');
const { Errors } = await import('@/lib/core/errors/catalog');

const release = vi.fn();

/** The default `work`: charge the global budget, then "call Gemini". */
const chargingWork = (
  onCharge?: () => void
): ((charge: () => Promise<void>) => Promise<string>) => {
  return async (charge) => {
    onCharge?.();
    await charge();
    return 'label';
  };
};

beforeEach(() => {
  assertRateLimit.mockReset();
  checkAnalysisGuards.mockReset();
  release.mockReset();
  insert.mockClear();
  insertValues.mockReset();
  buildAnalysisGuardEvent.mockClear();
  assertRateLimit.mockResolvedValue(undefined);
  checkAnalysisGuards.mockResolvedValue({ allowed: true, release });
  insertValues.mockResolvedValue(undefined);
});

describe('withOcrGuard', () => {
  it('acquires the per-user slot FIRST and charges the global budget only inside the work', async () => {
    const order: string[] = [];
    assertRateLimit.mockImplementation(async () => {
      order.push('global');
    });
    checkAnalysisGuards.mockImplementation(async () => {
      order.push('per-user');
      return { allowed: true, release };
    });
    const work = vi.fn(async (charge: () => Promise<void>) => {
      // Stands in for the caller's bounded body read + schema + sharp decode,
      // all of which must happen inside the slot and BEFORE the budget is
      // charged.
      order.push('validate');
      await charge();
      order.push('work');
      return 'label';
    });

    await expect(withOcrGuard('user-1', work)).resolves.toBe('label');

    expect(assertRateLimit).toHaveBeenCalledWith('ocrGlobalDaily', {
      kind: 'global',
      value: 'ocr',
    });
    expect(checkAnalysisGuards).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        route: 'nutrition-label-scan',
        limits: expect.objectContaining({
          perUserDay: 100,
          concurrentUser: 1,
        }),
      })
    );
    expect(order).toEqual(['per-user', 'validate', 'global', 'work']);
  });

  it('spends NOTHING from the app-wide budget when the per-user guard blocks', async () => {
    // The recorded defect: the global daily counter was consumed first and is
    // never refunded, so 5000 blocked requests from one account exhausted OCR
    // for every user for the rest of the UTC day.
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'per_user_minute',
      retryAfterSeconds: 5,
    });
    const work = vi.fn();

    await expect(withOcrGuard('user-1', work)).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      status: 429,
      retryAfterSeconds: 5,
    });
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(work).not.toHaveBeenCalled();
    expect(release).not.toHaveBeenCalled();
  });

  it('records the per-user block in the guard-event trail', async () => {
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'concurrent_user',
      retryAfterSeconds: 5,
    });

    await expect(withOcrGuard('user-1', vi.fn())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
    });
    expect(buildAnalysisGuardEvent).toHaveBeenCalledWith({
      userId: 'user-1',
      route: 'nutrition-label-scan',
      reason: 'concurrent_user',
      retryAfterSeconds: 5,
    });
    expect(insert).toHaveBeenCalledOnce();
  });

  it('never lets a failed telemetry write swallow the 429', async () => {
    checkAnalysisGuards.mockResolvedValue({
      allowed: false,
      status: 429,
      reason: 'per_user_day',
      retryAfterSeconds: 60,
    });
    insertValues.mockRejectedValue(new Error('events table is gone'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(withOcrGuard('user-1', vi.fn())).rejects.toMatchObject({
      code: 'RATE_LIMITED',
      retryAfterSeconds: 60,
    });
    errors.mockRestore();
  });

  it('releases the slot when the global budget refuses the charge', async () => {
    // `ocrGlobalDaily` fails closed, so an outage is a 503 — thrown from
    // INSIDE the work, which means only the outer finally can free the slot.
    assertRateLimit.mockRejectedValue(Errors.rateLimiterUnavailable());

    await expect(withOcrGuard('user-1', chargingWork())).rejects.toMatchObject({
      code: 'RATE_LIMITER_UNAVAILABLE',
      status: 503,
    });
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the slot when validation throws before the charge', async () => {
    const charged = vi.fn();
    assertRateLimit.mockImplementation(async () => charged());

    await expect(
      withOcrGuard('user-1', async () => {
        throw new Error('malformed base64');
      })
    ).rejects.toThrow('malformed base64');
    expect(charged).not.toHaveBeenCalled();
    expect(release).toHaveBeenCalledOnce();
  });

  it('releases the slot exactly once on success and when the work throws', async () => {
    await withOcrGuard('user-1', chargingWork());
    expect(release).toHaveBeenCalledOnce();

    release.mockClear();
    await expect(
      withOcrGuard('user-1', async (charge) => {
        await charge();
        throw new Error('gemini boom');
      })
    ).rejects.toThrow('gemini boom');
    expect(release).toHaveBeenCalledOnce();
  });

  it('never lets a failed release turn a paid, successful result into an error', async () => {
    // The Gemini call already spent money and returned; a release failure must
    // be swallowed (logged) so the caller keeps the result and does not retry.
    release.mockRejectedValue(new Error('release lost the connection'));
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});

    await expect(withOcrGuard('user-1', chargingWork())).resolves.toBe('label');
    expect(errors).toHaveBeenCalled();
    errors.mockRestore();
  });
});
