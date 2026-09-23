import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockCreate, mockReadJsonBody } = vi.hoisted(() => ({
  mockCreate: vi.fn(),
  mockReadJsonBody: vi.fn(),
}));

vi.mock('@/lib/api/auth', () => ({
  readJsonBody: mockReadJsonBody,
  requireUserId: vi
    .fn()
    .mockResolvedValue('a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'),
}));
vi.mock('@/lib/actions/chat-groups/create-and-list', () => ({
  createChatGroup: mockCreate,
  listMyChatGroups: vi.fn(),
}));

import { POST } from '@/app/api/v1/chat-groups/route';

const FRIEND = 'b1ffcd88-8d1a-4ef8-bb6d-6bb9bd380a22';
const GROUP = 'c2aade77-7e2b-4ef8-bb6d-6bb9bd380a33';

describe('POST /api/v1/chat-groups', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockReadJsonBody.mockReset();
  });

  it('passes the validated, deduped body to the action and answers 200 { group }', async () => {
    mockReadJsonBody.mockResolvedValue({
      name: '  Lunch crew ',
      memberUserIds: [FRIEND, FRIEND],
      createdBy: FRIEND,
    });
    mockCreate.mockResolvedValue({ id: GROUP });

    const response = await POST({} as never);

    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toEqual({ group: { id: GROUP } });
    expect(mockCreate).toHaveBeenCalledWith(
      'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
      { name: 'Lunch crew', memberUserIds: [FRIEND] }
    );
  });

  it.each([
    ['a non-array member list', { name: 'G', memberUserIds: FRIEND }],
    ['a non-uuid member', { name: 'G', memberUserIds: ['nope'] }],
    ['an empty name', { name: '  ', memberUserIds: [FRIEND] }],
    ['a missing body', null],
  ])('rejects %s with a 400 before the action runs', async (_, body) => {
    mockReadJsonBody.mockResolvedValue(body);

    const response = await POST({} as never);

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'VALIDATION_FAILED', status: 400 },
    });
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
