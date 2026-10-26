import { beforeEach, describe, expect, it, vi } from 'vitest';

const assertRateLimit = vi.fn();
const acquireRateLimit = vi.fn();

const settle = vi.fn();
const acquireSpendLease = vi.fn();

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({
  acquireRateLimit,
  acquireSpendLease,
  assertRateLimit,
}));

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
  acquireRateLimit.mockReset();
  release.mockReset();
  release.mockResolvedValue(undefined);
  assertRateLimit.mockResolvedValue(undefined);
  settle.mockReset();
  settle.mockResolvedValue(undefined);
  acquireSpendLease.mockReset();
  acquireSpendLease.mockResolvedValue({ release: settle, addLate: vi.fn() });
  acquireRateLimit.mockResolvedValue({ release, addLate: vi.fn() });
});

describe('withOcrGuard', () => {
  it('acquires the per-user slot FIRST and charges the global budget only inside the work', async () => {
    const order: string[] = [];
    assertRateLimit.mockImplementation(async () => {
      order.push('global');
    });
    acquireRateLimit.mockImplementation(async () => {
      order.push('per-user');
      return { release, addLate: vi.fn() };
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
    expect(acquireRateLimit).toHaveBeenCalledWith('labelOcr', {
      kind: 'user',
      value: 'user-1',
    });
    expect(order).toEqual(['per-user', 'validate', 'global', 'work']);
  });

  it('spends NOTHING from the app-wide budget when the per-user guard blocks', async () => {
    // The recorded defect: the global daily counter was consumed first and is
    // never refunded, so 5000 blocked requests from one account exhausted OCR
    // for every user for the rest of the UTC day.
    acquireRateLimit.mockRejectedValue(Errors.rateLimited(undefined, 5));
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

  describe('the app-wide AI spend brake', () => {
    it('reserves a label scan only once the global budget has been charged', async () => {
      const order: string[] = [];
      assertRateLimit.mockImplementation(async () => {
        order.push('global');
      });
      acquireSpendLease.mockImplementation(async () => {
        order.push('brake');
        return { release: settle, addLate: vi.fn() };
      });

      await withOcrGuard(
        'user-1',
        chargingWork(() => order.push('validate'))
      );

      expect(order).toEqual(['validate', 'global', 'brake']);
      expect(acquireSpendLease).toHaveBeenCalledWith('labelOcr', {
        enforce: true,
      });
      expect(settle).toHaveBeenCalledOnce();
    });

    it('reserves nothing when the work fails before the provider call', async () => {
      await expect(
        withOcrGuard('user-1', async () => {
          throw new Error('malformed base64');
        })
      ).rejects.toThrow('malformed base64');
      expect(acquireSpendLease).not.toHaveBeenCalled();
    });

    it('refuses with the RATE_LIMITED 429 once the brake trips, and frees the slot', async () => {
      acquireSpendLease.mockRejectedValue(Errors.aiPaused(3600));

      await expect(
        withOcrGuard('user-1', chargingWork())
      ).rejects.toMatchObject({
        code: 'RATE_LIMITED',
        status: 429,
        retryAfterSeconds: 3600,
      });
      expect(release).toHaveBeenCalledOnce();
    });
  });
});
