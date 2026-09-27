import { beforeEach, describe, expect, it, vi } from 'vitest';

const INVITER = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';

const { mockCount, mockSelect } = vi.hoisted(() => ({
  mockCount: vi.fn(),
  mockSelect: vi.fn(),
}));

// The REAL getFriendshipStatus runs against this db double: its block check is
// one `$count` over user_blocks (the shared predicate), its edge read one select.
vi.mock('@/lib/infra/db/client', () => ({
  db: { $count: mockCount, select: mockSelect },
}));
vi.mock('@/lib/actions/groups/profile', () => ({
  getProfileBySlug: vi.fn().mockResolvedValue({
    userId: 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22',
    handle: 'phofan',
    displayName: 'Phở Fan',
    avatarSeed: 'phofan',
    avatarUrl: null,
    hasCustomAvatar: false,
  }),
}));
vi.mock('@/lib/infra/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11' } },
      }),
    },
  }),
}));
vi.mock('@/lib/infra/security/request-ip', () => ({
  getRequestIp: () => null,
}));

import { GET } from '@/app/api/v1/groups/invite/[slug]/route';

const params = { params: Promise.resolve({ slug: 'phofan' }) };

function edgeRead(rows: unknown[]) {
  mockSelect.mockReturnValueOnce({
    from: () => ({ where: () => ({ limit: () => Promise.resolve(rows) }) }),
  });
}

describe('GET /api/v1/groups/invite/[slug]', () => {
  beforeEach(() => vi.clearAllMocks());

  // A block — in either direction, now held in user_blocks — answers the
  // SAME 404 an invalid slug gets, so the preview can never reveal it.
  it('404s exactly like an invalid link when the pair is blocked', async () => {
    mockCount.mockResolvedValueOnce(1);

    const response = await GET({} as never, params);

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'NOT_FOUND', message: 'That invite link is invalid.' },
    });
    // Decided by the block check alone; the friendship edge is never read.
    expect(mockSelect).not.toHaveBeenCalled();
  });

  it('previews a connectable inviter when nobody is blocked', async () => {
    mockCount.mockResolvedValueOnce(0);
    edgeRead([]);

    const response = await GET({} as never, params);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({
      status: 'none',
      signedOut: false,
      inviter: { userId: INVITER },
    });
  });
});
