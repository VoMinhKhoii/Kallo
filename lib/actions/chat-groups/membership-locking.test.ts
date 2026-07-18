import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { renameChatGroup } from '@/lib/actions/chat-groups/details';
import {
  addChatGroupMembers,
  leaveChatGroup,
  removeChatGroupMember,
} from '@/lib/actions/chat-groups/membership';

const OWNER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const MEMBER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function atomicMembershipDb(initialMemberIds: string[] = [OWNER_ID]) {
  const members = new Map(
    initialMemberIds.map((id) => [
      id,
      id === OWNER_ID ? ('owner' as const) : ('member' as const),
    ])
  );
  const events: string[] = [];
  let held = false;
  const waiters: Array<() => void> = [];

  const acquire = async () => {
    if (held) {
      events.push('lock:wait');
      await new Promise<void>((resolve) => waiters.push(resolve));
    }
    held = true;
    events.push('lock:acquired');
  };
  const release = () => {
    held = false;
    waiters.shift()?.();
  };

  const transaction = vi.fn(async (run: (tx: unknown) => Promise<unknown>) => {
    let ownsLock = false;
    const select = vi.fn((selection: Record<string, unknown>) => {
      const keys = Object.keys(selection);
      const rows = () => {
        if (keys.includes('directUserLow')) {
          const role = members.get(OWNER_ID);
          return role
            ? [
                {
                  kind: 'group',
                  role,
                  joinedAt: new Date('2026-01-01T00:00:00.000Z'),
                  directUserLow: null,
                  directUserHigh: null,
                  directFriendAccepted: true,
                },
              ]
            : [];
        }
        if (keys.includes('kind')) {
          return [{ id: GROUP_ID, kind: 'group' }];
        }
        if (keys.includes('userLow')) {
          return [
            {
              userLow: OWNER_ID < MEMBER_ID ? OWNER_ID : MEMBER_ID,
              userHigh: OWNER_ID < MEMBER_ID ? MEMBER_ID : OWNER_ID,
            },
          ];
        }
        if (keys.includes('userId')) {
          return [...members.keys()].map((userId) => ({ userId }));
        }
        if (keys.includes('id')) {
          return [...members.keys()].some((id) => id !== OWNER_ID)
            ? [{ id: 'other-member' }]
            : [];
        }
        return [];
      };
      const query = {
        from: vi.fn(),
        innerJoin: vi.fn(),
        where: vi.fn(),
        limit: vi.fn(),
        for: vi.fn(async () => {
          if (keys.includes('kind') && !keys.includes('directUserLow')) {
            await acquire();
            ownsLock = true;
          }
          return rows();
        }),
      };
      query.from.mockReturnValue(query);
      query.innerJoin.mockReturnValue(query);
      if (
        keys.includes('userLow') ||
        (keys.includes('userId') && !keys.includes('directUserLow'))
      ) {
        query.where.mockResolvedValue(rows());
      } else {
        query.where.mockReturnValue(query);
      }
      query.limit.mockReturnValue(
        Object.assign(Promise.resolve(rows()), { for: query.for })
      );
      return query;
    });
    const tx = {
      select,
      insert: vi.fn(() => ({
        values: vi.fn((values: Array<{ userId: string }>) => ({
          onConflictDoNothing: vi.fn(() => ({
            returning: vi.fn(async () => {
              for (const value of values) members.set(value.userId, 'member');
              events.push('insert');
              return values.map((value) => ({ id: value.userId }));
            }),
          })),
        })),
      })),
      delete: vi.fn(() => ({
        where: vi.fn(() => {
          let isRemove = false;
          const result = Promise.resolve().then(() => {
            if (!isRemove) {
              members.delete(OWNER_ID);
              events.push('delete');
            }
          });
          return Object.assign(result, {
            returning: vi.fn(async () => {
              isRemove = true;
              members.delete(MEMBER_ID);
              events.push('remove');
              return [{ id: MEMBER_ID }];
            }),
          });
        }),
      })),
      update: vi.fn(() => ({
        set: vi.fn(() => ({
          where: vi.fn(() => ({
            returning: vi.fn(async () => [{ name: 'Đã đổi tên' }]),
          })),
        })),
      })),
    };

    try {
      return await run(tx);
    } finally {
      if (ownsLock) release();
    }
  });

  return { db: { transaction }, events, members };
}

describe('chat-group membership locking', () => {
  it('serializes leave before add so add cannot create an ownerless group', async () => {
    const state = atomicMembershipDb();
    const leave = leaveChatGroup(OWNER_ID, GROUP_ID, state.db as never);
    const add = addChatGroupMembers(
      OWNER_ID,
      { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
      state.db as never
    );

    const [leaveResult, addResult] = await Promise.allSettled([leave, add]);

    expect(leaveResult.status).toBe('fulfilled');
    expect(addResult.status).toBe('rejected');
    expect(state.members.has(MEMBER_ID)).toBe(false);
    expect(state.events).toContain('lock:wait');
  });

  it('serializes add before leave so the owner cannot leave afterward', async () => {
    const state = atomicMembershipDb();
    const add = addChatGroupMembers(
      OWNER_ID,
      { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
      state.db as never
    );
    const leave = leaveChatGroup(OWNER_ID, GROUP_ID, state.db as never);

    const [addResult, leaveResult] = await Promise.allSettled([add, leave]);

    expect(addResult.status).toBe('fulfilled');
    expect(leaveResult.status).toBe('rejected');
    expect(state.members.get(OWNER_ID)).toBe('owner');
    expect(state.members.get(MEMBER_ID)).toBe('member');
  });

  it('enforces the 50-member cap inside the locked transaction', async () => {
    const existingIds = [
      OWNER_ID,
      ...Array.from({ length: 49 }, (_, index) => uuid(index)),
    ];
    const state = atomicMembershipDb(existingIds);

    await expect(
      addChatGroupMembers(
        OWNER_ID,
        { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
        state.db as never
      )
    ).rejects.toThrow('Nhóm tối đa 50 thành viên.');
    expect(state.members.has(MEMBER_ID)).toBe(false);
  });

  it('locks before owner authorization in rename and remove', async () => {
    const state = atomicMembershipDb([OWNER_ID, MEMBER_ID]);

    await renameChatGroup(
      OWNER_ID,
      { groupId: GROUP_ID, name: 'Đã đổi tên' },
      state.db as never
    );
    await removeChatGroupMember(
      OWNER_ID,
      { groupId: GROUP_ID, memberUserId: MEMBER_ID },
      state.db as never
    );

    expect(
      state.events.filter((event) => event === 'lock:acquired')
    ).toHaveLength(2);
  });
});
