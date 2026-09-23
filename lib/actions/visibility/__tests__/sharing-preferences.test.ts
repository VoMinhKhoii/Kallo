import { beforeEach, describe, expect, it, vi } from 'vitest';

// KALLO-03: every change to the Circle auto-share preference leaves a consent
// record (user_profiles.auto_share_updated_at) — on opt-in AND opt-out.

const { mockGetUser, mockSet, mockReturning } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSet: vi.fn(),
  mockReturning: vi.fn(),
}));

vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: async () => ({ auth: { getUser: mockGetUser } }),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    update: () => ({
      set: (values: unknown) => {
        mockSet(values);
        return { where: () => ({ returning: mockReturning }) };
      },
    }),
  },
}));

import { setAutoShareToCircle } from '@/lib/actions/visibility/sharing-preferences';

const USER_ID = '9d1f2c44-7b3e-4a55-9c22-1aa2bb334455';

describe('setAutoShareToCircle', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: { id: USER_ID } } });
    mockReturning.mockResolvedValue([{ userId: USER_ID }]);
  });

  it.each([
    true,
    false,
  ])('stamps auto_share_updated_at when set to %s', async (enabled) => {
    const before = Date.now();

    await setAutoShareToCircle(enabled);

    expect(mockSet).toHaveBeenCalledTimes(1);
    const values = mockSet.mock.calls[0][0] as {
      autoShareToCircle: boolean;
      autoShareUpdatedAt: Date;
    };
    expect(values.autoShareToCircle).toBe(enabled);
    expect(values.autoShareUpdatedAt).toBeInstanceOf(Date);
    expect(values.autoShareUpdatedAt.getTime()).toBeGreaterThanOrEqual(before);
  });

  it('rejects a non-boolean from a direct caller before touching the DB', async () => {
    await expect(setAutoShareToCircle('yes' as never)).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });

  it('refuses an unauthenticated caller', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });

    await expect(setAutoShareToCircle(true)).rejects.toThrow();
    expect(mockSet).not.toHaveBeenCalled();
  });
});
