import { describe, expect, it, vi } from 'vitest';

const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));

vi.mock('@/lib/api/auth', () => ({
  readJsonBody: vi.fn(),
  requireUserId: vi
    .fn()
    .mockResolvedValue('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
}));
vi.mock('@/lib/infra/db', () => ({
  db: { select: mockDbSelect },
}));

import { GET } from '@/app/api/v1/chat-groups/[groupId]/route';

describe('GET /api/v1/chat-groups/[groupId]', () => {
  it('returns a structured 400 for a malformed id before querying', async () => {
    const response = await GET({} as never, {
      params: Promise.resolve({ groupId: 'not-a-uuid' }),
    });

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({
      error: {
        code: 'VALIDATION_FAILED',
        status: 400,
        retryable: false,
        message: 'Phải là UUID hợp lệ.',
      },
    });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});
