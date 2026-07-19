import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { getChatGroup } from '@/lib/actions/chat-groups/details';
import { createChatGroupSchema } from '@/lib/validation';

const OWNER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MEMBER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function queuedReadDb(...rowSets: unknown[][]) {
  const queue = [...rowSets];
  const queries: Record<string, ReturnType<typeof vi.fn>>[] = [];
  const select = vi.fn((selection: Record<string, unknown>) => {
    const rows = queue.shift() ?? [];
    const query: Record<string, ReturnType<typeof vi.fn>> = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      leftJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    for (const method of [query.from, query.innerJoin, query.leftJoin]) {
      method.mockReturnValue(query);
    }
    if ('handle' in selection) {
      query.where.mockResolvedValue(rows);
    } else {
      query.where.mockReturnValue(query);
    }
    queries.push(query);
    return query;
  });
  return { db: { select }, queries, select };
}

describe('chat-group correctness guards', () => {
  it('rejects a malformed get id before querying', async () => {
    const { db, select } = queuedReadDb();

    await expect(
      getChatGroup(OWNER_ID, { groupId: 'not-a-uuid' }, db as never)
    ).rejects.toThrow('Phải là UUID hợp lệ.');
    expect(select).not.toHaveBeenCalled();
  });

  it('keeps members without profiles and derives the actor role honestly', async () => {
    const { db, queries } = queuedReadDb(
      [
        {
          kind: 'group',
          role: 'owner',
          joinedAt: new Date('2026-01-01T00:00:00.000Z'),
          directUserLow: null,
          directUserHigh: null,
          directFriendAccepted: true,
        },
      ],
      [{ id: GROUP_ID, kind: 'group', name: 'Trip' }],
      [
        {
          userId: OWNER_ID,
          role: 'owner',
          handle: null,
          displayName: null,
          avatarSeed: null,
          avatarUrl: null,
        },
        {
          userId: MEMBER_ID,
          role: 'member',
          handle: 'ban-an',
          displayName: null,
          avatarSeed: null,
          avatarUrl: null,
        },
      ]
    );

    const group = await getChatGroup(
      OWNER_ID,
      { groupId: GROUP_ID },
      db as never
    );

    expect(group.myRole).toBe('owner');
    expect(group.members[0]?.handle).toBe('');
    expect(queries[2]?.leftJoin).toHaveBeenCalledTimes(1);
  });

  it('caps group creation at 49 invitees plus the owner', () => {
    const input = (count: number) => ({
      name: 'Trip',
      memberUserIds: Array.from({ length: count }, (_, index) => uuid(index)),
    });

    expect(createChatGroupSchema.safeParse(input(49)).success).toBe(true);
    expect(createChatGroupSchema.safeParse(input(50)).success).toBe(false);
  });
});
