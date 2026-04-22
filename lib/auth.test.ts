import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock Supabase server client and Drizzle DB to avoid real connections
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  db: {},
}));
vi.mock('@/lib/user-profile', () => ({
  getOrCreateUserProfile: vi.fn(),
}));

// Import after mocks are set up
const { requireAuthAndProfile } = await import('@/lib/auth');
const { getOrCreateUserProfile } = await import('@/lib/user-profile');

// ---------------------------------------------------------------------------
// Helpers to build mock deps
// ---------------------------------------------------------------------------

function mockSupabase(
  user: { id: string; email?: string } | null,
  error?: Error
) {
  return {
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user },
        error: error ?? null,
      }),
    },
  } as unknown as Awaited<
    ReturnType<typeof import('@/lib/supabase/server').createClient>
  >;
}

function mockDb() {
  return {} as typeof import('@/lib/db').db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAuthAndProfile', () => {
  beforeEach(() => {
    vi.mocked(getOrCreateUserProfile).mockReset();
  });

  it('returns user and profile on success', async () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const profile = { userId: 'u1', goal: 'cut' };
    vi.mocked(getOrCreateUserProfile).mockResolvedValueOnce(profile as never);

    const result = await requireAuthAndProfile({
      supabase: mockSupabase(user),
      database: mockDb(),
    });

    expect(result.user).toEqual(user);
    expect(result.profile).toEqual(profile);
    expect(getOrCreateUserProfile).toHaveBeenCalledWith(
      user.id,
      expect.any(Object)
    );
  });

  it('throws NOT_AUTHENTICATED when auth returns error', async () => {
    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(null, new Error('token expired')),
        database: mockDb(),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_AUTHENTICATED' }));
  });

  it('throws NOT_AUTHENTICATED when no user', async () => {
    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(null),
        database: mockDb(),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_AUTHENTICATED' }));
  });

  it('throws PROFILE_NOT_FOUND when the profile row still cannot be loaded', async () => {
    const user = { id: 'u1' };
    vi.mocked(getOrCreateUserProfile).mockRejectedValueOnce(
      new Error('profile row missing')
    );

    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(user),
        database: mockDb(),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }));
  });
});
