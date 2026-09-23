import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockAdd, mockReadJsonBody } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockReadJsonBody: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  readJsonBody: mockReadJsonBody,
  requireUserId: vi
    .fn()
    .mockResolvedValue('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
}));
vi.mock('@/lib/actions/chat-groups/membership', () => ({
  addChatGroupMembers: mockAdd,
}));

import { POST } from '@/app/api/v1/chat-groups/[groupId]/members/route';

const FRIEND = 'b1ffcd88-8d1a-4ef8-bb6d-6bb9bd380a22';
const GROUP = 'c2aade77-7e2b-4ef8-bb6d-6bb9bd380a33';
const ctx = { params: Promise.resolve({ groupId: GROUP }) };

describe('POST /api/v1/chat-groups/[groupId]/members', () => {
  beforeEach(() => {
    mockAdd.mockReset();
    mockReadJsonBody.mockReset();
  });

  it('adds the validated members and answers 200 { added }', async () => {
    mockReadJsonBody.mockResolvedValue({ memberUserIds: [FRIEND, FRIEND] });
    mockAdd.mockResolvedValue({ added: 1 });

    const response = await POST({} as never, ctx);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ added: 1 });
    expect(mockAdd).toHaveBeenCalledWith(
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      { groupId: GROUP, memberUserIds: [FRIEND] }
    );
  });

  it.each([
    ['the old `{ userId }` shape', { userId: FRIEND }],
    ['a non-array member list', { memberUserIds: FRIEND }],
    ['a non-uuid member', { memberUserIds: ['nope'] }],
    [
      'more than 50 members',
      {
        memberUserIds: Array.from(
          { length: 51 },
          (_, i) =>
            `00000000-0000-4000-8000-${i.toString(16).padStart(12, '0')}`
        ),
      },
    ],
  ])('rejects %s with a 400 before the action runs', async (_, body) => {
    mockReadJsonBody.mockResolvedValue(body);

    const response = await POST({} as never, ctx);

    expect(response.status).toBe(400);
    expect(mockAdd).not.toHaveBeenCalled();
  });
});
