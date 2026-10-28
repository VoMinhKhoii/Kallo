import { AuthInvalidJwtError } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { createFakeDb } from '@/lib/infra/db/__fixtures__/fake-db';

// Mock Supabase server client and Drizzle DB to avoid real connections
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn(),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: {},
}));

// Import after mocks are set up
const { requireAuthAndProfile } = await import('@/lib/infra/auth/session');

// ---------------------------------------------------------------------------
// Helpers to build mock deps
// ---------------------------------------------------------------------------

function mockSupabase(
  user: { id: string; email?: string } | null,
  error?: Error
) {
  return {
    auth: {
      getClaims: vi.fn().mockResolvedValue(
        user
          ? {
              data: { claims: { sub: user.id, session_id: 'session-1' } },
              error: null,
            }
          : { data: null, error: error ?? null }
      ),
    },
  } as unknown as Awaited<
    ReturnType<typeof import('@/lib/infra/supabase/server').createClient>
  >;
}

/** The guard runs the session query (`execute`), then exactly one
 *  `select(...).from(...).where(...).limit(1)` for the profile. */
function mockDb(
  rows: Record<string, unknown>[],
  user?: { id: string; email?: string }
) {
  const fake = createFakeDb();
  if (user) {
    fake.queueExecute([
      { id: user.id, email: user.email ?? null, created_at: '2026-01-01' },
    ]);
  }
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
      database: mockDb([profile], user),
    });

    expect(result.user).toEqual(user);
    expect(result.profile).toEqual(profile);
  });

  it('throws NOT_AUTHENTICATED when auth returns error', async () => {
    await expect(
      requireAuthAndProfile({
        supabase: mockSupabase(
          null,
          new AuthInvalidJwtError('JWT has expired')
        ),
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
        database: mockDb([], user),
      })
    ).rejects.toThrow(expect.objectContaining({ code: 'PROFILE_NOT_FOUND' }));
  });
});
