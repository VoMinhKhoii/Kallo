import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Errors } from '@/lib/core/errors/catalog';

const { requireUserId, exportMyDataAction } = vi.hoisted(() => ({
  requireUserId: vi.fn(),
  exportMyDataAction: vi.fn(),
}));
vi.mock('@/lib/api/auth', () => ({ requireUserId }));
vi.mock('@/lib/actions/identity/account', () => ({
  exportMyDataAction,
  deleteAccountAction: vi.fn(),
}));

import { GET } from '@/app/api/v1/account/route';

beforeEach(() => {
  vi.clearAllMocks();
  requireUserId.mockResolvedValue('owner');
});

describe('GET /api/v1/account', () => {
  it('returns the complete successful document unchanged', async () => {
    const document = { exportedAt: 'now', meals: [{ id: 'meal-1' }] };
    exportMyDataAction.mockResolvedValue(document);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(document);
    expect(exportMyDataAction).toHaveBeenCalledExactlyOnceWith({
      expectedUserId: 'owner',
    });
  });

  it.each([
    5, 3600,
  ])('surfaces a refusal with the standard 429 envelope and Retry-After: %s', async (retryAfterSeconds) => {
    const error = Errors.rateLimited(undefined, retryAfterSeconds);
    exportMyDataAction.mockResolvedValue({
      ...error.toJSON(),
      retryAfterSeconds,
    });
    const response = await GET();
    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe(String(retryAfterSeconds));
    expect(await response.json()).toEqual(error.toJSON());
  });

  it('does not start an export without authentication', async () => {
    requireUserId.mockRejectedValue(Errors.notAuthenticated());
    expect((await GET()).status).toBe(401);
    expect(exportMyDataAction).not.toHaveBeenCalled();
  });

  it('keeps a limiter outage distinct from an exhausted quota', async () => {
    exportMyDataAction.mockRejectedValue(
      Errors.rateLimiterUnavailable(new Error('offline'), 'error')
    );
    const response = await GET();
    expect(response.status).toBe(503);
    expect(response.headers.get('Retry-After')).toBe('10');
    expect(await response.json()).toMatchObject({
      error: { code: 'RATE_LIMITER_UNAVAILABLE' },
    });
  });
});
