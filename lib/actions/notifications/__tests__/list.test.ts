import { describe, expect, it, vi } from 'vitest';
import { listNotifications } from '@/lib/actions/notifications/list';
import { decodeSharedMealCursor } from '@/lib/domain/social/feed/cursor';

const USER = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const ACTOR = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const INVITE = 'e4ccff33-d04f-4cc2-af01-affdf0724e55';

function row(overrides: Record<string, unknown> = {}) {
  return {
    id: 'd3bbef22-cf3e-4bb1-9e90-9eecef613d44',
    type: 'share.reaction',
    actorIds: [ACTOR],
    actorCount: 1,
    objectType: 'share',
    objectId: 'f5dd0044-e150-4dd3-b012-b00e01835f66',
    targetType: null,
    targetId: null,
    data: null,
    createdAt: new Date('2026-08-01T10:00:00.000Z'),
    createdAtText: '2026-08-01 10:00:00+00',
    updatedAt: new Date('2026-08-01T10:00:00.000Z'),
    seenAt: null,
    readAt: null,
    inviteStatus: null,
    ...overrides,
  };
}

function profile(userId = ACTOR) {
  return {
    userId,
    handle: 'lan',
    displayName: 'Lan',
    avatarSeed: 'seed',
    avatarUrl: null,
    avatarPath: null,
  };
}

/** db double: first select is the feed page, second the actor hydration. */
function fakeDb(rows: unknown[], profiles: unknown[] = [profile()]) {
  const captured: { where?: unknown; limit?: number } = {};
  const select = vi
    .fn()
    .mockReturnValueOnce({
      from: () => ({
        leftJoin: () => ({
          where: (where: unknown) => {
            captured.where = where;
            return {
              orderBy: () => ({
                limit: (limit: number) => {
                  captured.limit = limit;
                  return Promise.resolve(rows);
                },
              }),
            };
          },
        }),
      }),
    })
    .mockReturnValueOnce({
      from: () => ({ where: () => Promise.resolve(profiles) }),
    });
  return { db: { select } as never, captured, select };
}

/** Collect the bound values out of a Drizzle SQL tree (Param = {value,
 *  encoder}), so a predicate can be asserted without stringifying the
 *  self-referential table objects it also holds. */
function paramValues(node: unknown, out: unknown[] = []): unknown[] {
  if (Array.isArray(node)) {
    for (const child of node) paramValues(child, out);
    return out;
  }
  if (!node || typeof node !== 'object') return out;
  const record = node as Record<string, unknown>;
  if ('value' in record && 'encoder' in record) out.push(record.value);
  if ('queryChunks' in record) paramValues(record.queryChunks, out);
  return out;
}

describe('listNotifications', () => {
  it('scopes the query to the recipient', async () => {
    const { db, captured } = fakeDb([row()]);

    await listNotifications(USER, { limit: 25 }, db);

    expect(paramValues(captured.where)).toContain(USER);
  });

  it('hydrates actor identities onto each row', async () => {
    const { db } = fakeDb([row()]);

    const { items } = await listNotifications(USER, { limit: 25 }, db);

    expect(items[0].actors).toEqual([
      expect.objectContaining({ userId: ACTOR, handle: 'lan' }),
    ]);
    expect(items[0].actorCount).toBe(1);
  });

  it('drops actors whose profile no longer exists', async () => {
    const { db } = fakeDb([row()], []);

    const { items } = await listNotifications(USER, { limit: 25 }, db);

    expect(items[0].actors).toEqual([]);
  });

  it('attaches the live invite status to share.invite rows only', async () => {
    const { db } = fakeDb([
      row({ type: 'share.invite', objectId: INVITE, inviteStatus: 'pending' }),
      row({ id: '11111111-1111-4111-8111-111111111111' }),
    ]);

    const { items } = await listNotifications(USER, { limit: 25 }, db);

    expect(items[0].invite).toEqual({ status: 'pending' });
    expect(items[1].invite).toBeNull();
  });

  it('over-fetches by one and returns a decodable cursor when more remain', async () => {
    const rows = [
      row({ id: '11111111-1111-4111-8111-111111111111' }),
      row({
        id: '22222222-2222-4222-8222-222222222222',
        createdAtText: '2026-07-31 09:00:00+00',
      }),
    ];
    const { db, captured } = fakeDb(rows);

    const { items, nextCursor } = await listNotifications(
      USER,
      { limit: 1 },
      db
    );

    expect(captured.limit).toBe(2);
    expect(items).toHaveLength(1);
    expect(decodeSharedMealCursor(nextCursor ?? undefined)).toEqual({
      ts: '2026-08-01 10:00:00+00',
      id: '11111111-1111-4111-8111-111111111111',
    });
  });

  it('returns a null cursor on the last page', async () => {
    const { db } = fakeDb([row()]);

    const { nextCursor } = await listNotifications(USER, { limit: 25 }, db);

    expect(nextCursor).toBeNull();
  });

  it('rejects a malformed cursor with an activity-specific message', async () => {
    const { db } = fakeDb([]);

    await expect(
      listNotifications(USER, { cursor: 'not-a-cursor', limit: 25 }, db)
    ).rejects.toThrow('Con trỏ thông báo không hợp lệ.');
  });

  it('serializes timestamps as ISO strings', async () => {
    const { db } = fakeDb([
      row({ seenAt: new Date('2026-08-02T00:00:00.000Z') }),
    ]);

    const { items } = await listNotifications(USER, { limit: 25 }, db);

    expect(items[0].createdAt).toBe('2026-08-01T10:00:00.000Z');
    expect(items[0].seenAt).toBe('2026-08-02T00:00:00.000Z');
    expect(items[0].readAt).toBeNull();
  });
});
