import { describe, expect, it, vi } from 'vitest';
import { createFakeDb } from '@/lib/db/__fixtures__/fake-db';

// Mock Supabase server client and Drizzle DB to avoid real connections
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/db', () => ({
  db: {},
}));

// Import after mocks are set up
const { requireAuthAndProfile } = await import('@/lib/auth/session');

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

/** The guard issues exactly one `select(...).from(...).where(...).limit(1)`. */
function mockDb(rows: Record<string, unknown>[]) {
  const fake = createFakeDb();
  fake.queueSelect(rows);
  return fake.db;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('requireAuthAndProfile', () => {
  it('returns user and profile on success', async () => {
    const user = { id: 'u1', email: 'a@b.com' };
    const profile = { userId: 'u1', goal: 'cut' };

    const result = await requireAuthAndProfile({
      supabase: mockSupabase(user),
      database: mockDb([profile]),
    });

    expect(result.user).toEqual(user);
    expect(result.profile).toEqual(profile);
  });

  it('throws NOT_AUTHENTICATED when auth returns error', async () => {
    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(null, new Error('token expired')),
        database: mockDb([]),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_AUTHENTICATED' }));
  });

  it('throws NOT_AUTHENTICATED when no user', async () => {
    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(null),
        database: mockDb([]),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'NOT_AUTHENTICATED' }));
  });

  it('throws PROFILE_NOT_FOUND when no profile row exists', async () => {
    const user = { id: 'u1' };

    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(user),
        database: mockDb([]),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }));
  });
});
