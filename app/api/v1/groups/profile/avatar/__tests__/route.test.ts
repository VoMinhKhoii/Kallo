import { beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * The avatar route's inventory row names ONE policy for the whole file, and a
 * method that skipped it made that row false: DELETE still writes storage and
 * the profile row, so an unlimited delete/upload alternation walked straight
 * past the upload cap.
 */

const assertRateLimit = vi.fn();
const removeMyAvatar = vi.fn();
const uploadMyAvatar = vi.fn();
const getUser = vi.fn();

vi.mock('@/lib/infra/rate-limit/limiter/limiter', () => ({ assertRateLimit }));
vi.mock('@/lib/actions/groups/avatar', () => ({
  removeMyAvatar,
  uploadMyAvatar,
}));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser } }),
}));

const { DELETE } = await import('@/app/api/v1/groups/profile/avatar/route');

beforeEach(() => {
  assertRateLimit.mockReset();
  removeMyAvatar.mockReset();
  getUser.mockReset();
  assertRateLimit.mockResolvedValue(undefined);
  removeMyAvatar.mockResolvedValue({ avatarUrl: null });
  getUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
});

describe('DELETE /api/v1/groups/profile/avatar', () => {
  it('charges the upload limit after auth', async () => {
    const res = await DELETE();

    expect(res.status).toBe(200);
    expect(assertRateLimit).toHaveBeenCalledWith('avatarUpload', {
      kind: 'user',
      value: 'user-1',
    });
  });

  it('never charges an anonymous caller', async () => {
    getUser.mockResolvedValue({ data: { user: null }, error: null });

    const res = await DELETE();
    expect(res.status).toBe(401);
    expect(assertRateLimit).not.toHaveBeenCalled();
    expect(removeMyAvatar).not.toHaveBeenCalled();
  });

  it('answers a block with 429 + Retry-After, before the write', async () => {
    const { Errors } = await import('@/lib/core/errors/catalog');
    assertRateLimit.mockRejectedValueOnce(Errors.rateLimited(undefined, 12));

    const res = await DELETE();
    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('12');
    expect(removeMyAvatar).not.toHaveBeenCalled();
  });
});
