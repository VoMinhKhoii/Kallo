import { describe, expect, it, vi } from 'vitest';
import { readJsonBody } from '@/lib/api/auth';

const { mockDbSelect } = vi.hoisted(() => ({ mockDbSelect: vi.fn() }));

vi.mock('@/lib/api/auth', () => ({
  readJsonBody: vi.fn(),
  requireUserId: vi
    .fn()
    .mockResolvedValue('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
}));
vi.mock('@/lib/infra/db/client', () => ({
  db: { select: mockDbSelect },
}));

import { GET, PATCH } from '@/app/api/v1/chat-groups/[groupId]/route';

const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const params = { params: Promise.resolve({ groupId: GROUP_ID }) };

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
        resolution:
          'Correct the request using the published schema, then retry.',
      },
    });
    expect(mockDbSelect).not.toHaveBeenCalled();
  });
});

describe('PATCH /api/v1/chat-groups/[groupId]', () => {
  it('parses the body at the boundary: a missing name is a 400', async () => {
    vi.mocked(readJsonBody).mockResolvedValueOnce({ title: 'Trip' });

    const response = await PATCH({} as never, params);

    expect(response.status).toBe(400);
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('answers an objectionable name with a 422 objectionable_content', async () => {
    vi.mocked(readJsonBody).mockResolvedValueOnce({ name: 'fuck squad' });

    const response = await PATCH({} as never, params);

    expect(response.status).toBe(422);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'objectionable_content', status: 422, retryable: false },
    });
  });
});
