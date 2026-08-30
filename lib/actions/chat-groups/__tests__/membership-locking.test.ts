import { describe, expect, it, vi } from 'vitest';

// Push (Phase 4) rides on next/server's `after()`, which needs a request scope
// these unit suites don't have. The double runs the callback inline so the
// scheduling itself is assertable; what the push then does is covered by
// lib/domain/notifications/__tests__/push.test.ts.
const { mockAfter, mockSendNotificationPush, mockSendChatMessagePush } =
  vi.hoisted(() => ({
    mockAfter: vi.fn((task: () => unknown) => {
      void task();
    }),
    mockSendNotificationPush: vi.fn(async (): Promise<void> => undefined),
    mockSendChatMessagePush: vi.fn(async (): Promise<void> => undefined),
  }));
vi.mock('next/server', async (importOriginal) => ({
  ...(await importOriginal<Record<string, unknown>>()),
  after: mockAfter,
}));
vi.mock('@/lib/domain/notifications/push', () => ({
  sendNotificationPush: mockSendNotificationPush,
  sendChatMessagePush: mockSendChatMessagePush,
}));

// Notifications: this suite asserts WHO gets told; the helper's own upsert and
// retract semantics live in lib/domain/notifications/__tests__.
const { mockNotify, mockRetractActor } = vi.hoisted(() => ({
  mockNotify: vi.fn(async (..._args: unknown[]): Promise<string[]> => []),
  mockRetractActor: vi.fn(
    async (..._args: unknown[]): Promise<void> => undefined
  ),
}));
vi.mock('@/lib/domain/notifications/notify', () => ({
  notify: mockNotify,
  retractActor: mockRetractActor,
}));

import { Errors } from '@/lib/core/errors/catalog';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));

// Premium circle gates: pass-through unless a test arms one, so the suite
// never depends on the BILLING_ENFORCEMENT_ENABLED env var.
const { mockAssertActor, mockAssertCapacity } = vi.hoisted(() => ({
  mockAssertActor: vi.fn(async (..._args: unknown[]) => undefined),
  mockAssertCapacity: vi.fn(async (..._args: unknown[]) => undefined),
}));
vi.mock('@/lib/domain/social/quota/circle-quota', () => ({
  assertUnlimitedCircleActor: mockAssertActor,
  assertGroupCapacity: mockAssertCapacity,
}));

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

  // The push carries the group's name and its deep link, and is scheduled only
  // after the locked transaction has resolved.
  it('schedules the group-added push once the add commits', async () => {
    mockAfter.mockClear();
    mockSendNotificationPush.mockClear();
    const state = atomicMembershipDb();
    mockNotify.mockResolvedValueOnce([MEMBER_ID]);

    await addChatGroupMembers(
      OWNER_ID,
      { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
      state.db as never
    );

    expect(mockAfter).toHaveBeenCalledTimes(1);
    expect(mockSendNotificationPush).toHaveBeenCalledWith([MEMBER_ID], {
      type: 'group.added',
      actor: { id: OWNER_ID },
      // The locked group row is the copy source; this double carries no name,
      // and a nameless group contributes no `data` at all — push.ts then falls
      // back to the locale's "a group".
      targetType: 'chat_group',
      targetId: GROUP_ID,
      groupKey: `group.added:${GROUP_ID}`,
    });
  });

  it('does not schedule a push when the add is rejected', async () => {
    mockSendNotificationPush.mockClear();
    const state = atomicMembershipDb();
    mockAssertActor.mockRejectedValueOnce(
      Errors.featureLocked('unlimited_circle', 'not_entitled')
    );

    await expect(
      addChatGroupMembers(
        OWNER_ID,
        { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
        state.db as never
      )
    ).rejects.toMatchObject({ status: 402 });
    expect(mockSendNotificationPush).not.toHaveBeenCalled();
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

  it('propagates the actor 402 without inserting the member', async () => {
    const state = atomicMembershipDb();
    mockAssertActor.mockRejectedValueOnce(
      Errors.featureLocked('unlimited_circle', 'not_entitled')
    );

    await expect(
      addChatGroupMembers(
        OWNER_ID,
        { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
        state.db as never
      )
    ).rejects.toMatchObject({ status: 402, code: 'feature_locked' });
    expect(state.members.has(MEMBER_ID)).toBe(false);
  });

  it('propagates a 409 when an added member is at their group cap', async () => {
    const state = atomicMembershipDb();
    mockAssertCapacity.mockRejectedValueOnce(
      Errors.circleLimitReached('Phở Fan đã đạt giới hạn 2 nhóm.')
    );

    await expect(
      addChatGroupMembers(
        OWNER_ID,
        { groupId: GROUP_ID, memberUserIds: [MEMBER_ID] },
        state.db as never
      )
    ).rejects.toMatchObject({ status: 409, code: 'CIRCLE_LIMIT_REACHED' });
    expect(mockAssertCapacity.mock.lastCall?.[1]).toEqual([MEMBER_ID]);
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
