import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));

import { canViewShare } from '@/lib/groups/share-visibility';

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const SHARE_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const SHARED_AT = new Date('2026-07-10T12:00:00.000Z');

function queuedDb(...rowSets: unknown[][]) {
  const queue = [...rowSets];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    return query;
  });
  return { select };
}

function share(overrides: Record<string, unknown> = {}) {
  return {
    ownerId: OWNER_ID,
    sharedAt: SHARED_AT,
    visibility: 'circle',
    ...overrides,
  };
}

describe('canViewShare', () => {
  beforeEach(() => vi.clearAllMocks());

  it('allows the meal owner even when the share is private', async () => {
    const db = queuedDb([share({ ownerId: ACTOR_ID, visibility: 'private' })]);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      true
    );
    expect(db.select).toHaveBeenCalledTimes(1);
  });

  it('allows a currently accepted friend of the owner', async () => {
    const db = queuedDb([share()], [{ id: 'friendship' }], []);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      true
    );
  });

  it('allows a current co-member when both joined before the share', async () => {
    const db = queuedDb(
      [share()],
      [],
      [
        {
          groupId: 'group',
          viewerJoinedAt: new Date('2026-07-08T00:00:00.000Z'),
          ownerJoinedAt: new Date('2026-07-09T00:00:00.000Z'),
        },
      ]
    );

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      true
    );
  });

  it.each([
    {
      label: 'viewer joined later',
      viewerJoinedAt: new Date('2026-07-11T00:00:00.000Z'),
      ownerJoinedAt: new Date('2026-07-09T00:00:00.000Z'),
    },
    {
      label: 'owner joined later',
      viewerJoinedAt: new Date('2026-07-08T00:00:00.000Z'),
      ownerJoinedAt: new Date('2026-07-11T00:00:00.000Z'),
    },
  ])('rejects a co-member when $label', async (membership) => {
    const db = queuedDb([share()], [], [{ groupId: 'group', ...membership }]);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
  });

  it('rejects a stranger', async () => {
    const db = queuedDb([share()], [], []);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
  });

  // The co-membership query filters chatGroups.kind = 'group', so a pair whose
  // only tie is a kept-for-history direct chat (after an unfriend/block) returns
  // no group rows here — direct relationships are authorized only by the live
  // accepted-friendship branch, which is empty for an ex-friend.
  it('rejects an unfriended ex-friend whose only tie is a stale direct chat', async () => {
    const db = queuedDb([share()], [], []);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
  });

  it('rejects an unfriended viewer when no group grants access', async () => {
    const db = queuedDb([share()], [], []);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
  });

  it('rejects a former co-member after their membership row is gone', async () => {
    const db = queuedDb([share()], [], []);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
  });

  it("does not expose another owner's private share to a friend", async () => {
    const db = queuedDb([share({ visibility: 'private' })]);

    await expect(canViewShare(ACTOR_ID, SHARE_ID, db as never)).resolves.toBe(
      false
    );
    expect(db.select).toHaveBeenCalledTimes(1);
  });
});
