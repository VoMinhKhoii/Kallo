import { describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db', () => ({ db: {} }));

import {
  ensureDirectChatsForAcceptedFriends,
  getOrCreateDirectChatGroup,
} from '@/lib/actions/chat-groups/direct-chats';

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const FRIEND_A = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const FRIEND_B = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const GROUP_ID = 'd3bbde22-cf3e-4bb1-9e9f-9eecef613d44';
const [LOW, HIGH] =
  ACTOR_ID < FRIEND_A ? [ACTOR_ID, FRIEND_A] : [FRIEND_A, ACTOR_ID];

function selectPairs(rows: unknown[]) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      leftJoin: vi.fn(() => ({
        where: vi.fn().mockResolvedValue(rows),
      })),
    })),
  }));
}

function selectRows(rows: unknown[]) {
  return vi.fn(() => ({
    from: vi.fn(() => ({
      where: vi.fn(() => ({
        limit: vi.fn().mockResolvedValue(rows),
      })),
    })),
  }));
}

describe('getOrCreateDirectChatGroup', () => {
  it('creates the pair in canonical order and ensures both member rows', async () => {
    const insertCalls: unknown[] = [];
    const insert = vi.fn(() => ({
      values: vi.fn().mockImplementation((vals: unknown) => {
        insertCalls.push(vals);
        return { onConflictDoNothing: vi.fn().mockResolvedValue(undefined) };
      }),
    }));
    const select = selectRows([{ id: GROUP_ID }]);

    // Call with args in reverse-of-canonical order — the function must still
    // resolve to the low/high canonical ordering, not argument order.
    const result = await getOrCreateDirectChatGroup(HIGH, LOW, {
      select,
      insert,
    } as never);

    expect(result).toEqual({ id: GROUP_ID });
    const groupInsert = insertCalls[0] as Record<string, unknown>;
    expect(groupInsert.kind).toBe('direct');
    expect(groupInsert.directUserLow).toBe(LOW);
    expect(groupInsert.directUserHigh).toBe(HIGH);

    const memberInsert = insertCalls[1] as {
      groupId: string;
      userId: string;
    }[];
    expect(memberInsert).toHaveLength(2);
    expect(memberInsert.map((m) => m.userId).sort()).toEqual(
      [LOW, HIGH].sort()
    );
  });
});

describe('ensureDirectChatsForAcceptedFriends', () => {
  it('uses one statement when every accepted pair already has a chat', async () => {
    const select = selectPairs([
      { userLow: ACTOR_ID, userHigh: FRIEND_A, groupId: 'group-a' },
      { userLow: ACTOR_ID, userHigh: FRIEND_B, groupId: 'group-b' },
    ]);
    const insert = vi.fn();

    const friendIds = await ensureDirectChatsForAcceptedFriends(ACTOR_ID, {
      select,
      insert,
    } as never);

    expect(friendIds).toEqual([FRIEND_A, FRIEND_B]);
    expect(select).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
  });

  it('batches all missing groups and member rows into two inserts', async () => {
    const select = selectPairs([
      { userLow: ACTOR_ID, userHigh: FRIEND_A, groupId: null },
      { userLow: ACTOR_ID, userHigh: FRIEND_B, groupId: null },
    ]);
    const valueBatches: unknown[] = [];
    const insert = vi
      .fn()
      .mockReturnValueOnce({
        values: vi.fn((values: unknown) => {
          valueBatches.push(values);
          return {
            onConflictDoNothing: vi.fn(() => ({
              returning: vi.fn().mockResolvedValue([
                {
                  id: 'group-a',
                  userLow: ACTOR_ID,
                  userHigh: FRIEND_A,
                },
                {
                  id: 'group-b',
                  userLow: ACTOR_ID,
                  userHigh: FRIEND_B,
                },
              ]),
            })),
          };
        }),
      })
      .mockReturnValueOnce({
        values: vi.fn((values: unknown) => {
          valueBatches.push(values);
          return {
            onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
          };
        }),
      });

    await ensureDirectChatsForAcceptedFriends(ACTOR_ID, {
      select,
      insert,
    } as never);

    expect(select).toHaveBeenCalledTimes(1);
    expect(insert).toHaveBeenCalledTimes(2);
    expect(valueBatches[0]).toHaveLength(2);
    expect(valueBatches[1]).toHaveLength(4);
  });
});
