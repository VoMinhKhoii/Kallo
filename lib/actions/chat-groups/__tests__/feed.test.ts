import type { SQL } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/infra/db/client', () => ({ db: {} }));
vi.mock('@/lib/actions/chat-groups/membership', () => ({
  requireGroupAccess: vi.fn().mockResolvedValue({
    kind: 'group',
    role: 'member',
    joinedAt: new Date('2026-07-10T00:00:00.000Z'),
    directUserLow: null,
    directUserHigh: null,
  }),
}));
vi.mock('@/lib/domain/social/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/domain/social/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { reactionsForShares } from '@/lib/domain/social/shares/reactions';
import { groupShareVisibleSql } from '@/lib/domain/social/shares/share-visibility';
import { mealShares } from '@/lib/infra/db/schema';

// Whitespace and parameter numbers vary with where a fragment is embedded.
const flat = (sql: string) => sql.replace(/\s+/g, ' ').replace(/\$\d+/g, '$?');

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';

function queuedDb(rows: unknown[]) {
  const query = {
    innerJoin: vi.fn(),
    where: vi.fn(),
    orderBy: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  query.innerJoin.mockReturnValue(query);
  query.where.mockReturnValue(query);
  query.orderBy.mockReturnValue(query);
  const update = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  }));
  return {
    select: vi.fn(() => ({ from: vi.fn().mockReturnValue(query) })),
    update,
    query,
  };
}

function meal(index: number, sharedAt: Date) {
  return {
    friendUserId: OWNER_ID,
    mealId: `00000000-0000-4000-8000-${(index + 100)
      .toString(16)
      .padStart(12, '0')}`,
    shareId: `00000000-0000-4000-8000-${(index + 200)
      .toString(16)
      .padStart(12, '0')}`,
    rawInput: `meal ${index}`,
    caloriesKcal: 500,
    proteinG: 30,
    carbohydrateG: 50,
    fatG: 15,
    portionFactor: 1,
    sharedAt,
    loggedAt: sharedAt,
    sharedAtText: sharedAt.toISOString(),
    handle: 'owner',
    displayName: 'Owner',
    avatarSeed: 'owner',
    avatarUrl: null,
  };
}

describe('listGroupMealFeed', () => {
  beforeEach(() => vi.clearAllMocks());

  // The post-join bounds, private and block checks are ONE predicate in the
  // read's WHERE (groupShareVisibleSql) — the database refuses the rows, so
  // there is no in-memory second copy of the rule to drift from it.
  it('admits shares by the group-share rule, in SQL', async () => {
    const rows = [
      meal(3, new Date('2026-07-13T12:00:00.000Z')),
      meal(2, new Date('2026-07-11T12:00:00.000Z')),
    ];
    const db = queuedDb(rows);

    const page = await listGroupMealFeed(
      ACTOR_ID,
      { groupId: GROUP_ID },
      db as never
    );

    expect(page.entries.map((entry) => entry.meal.rawInput)).toEqual([
      'meal 3',
      'meal 2',
    ]);
    const where = new PgDialect().sqlToQuery(
      db.query.where.mock.calls[0][0] as SQL
    ).sql;
    const rule = new PgDialect().sqlToQuery(
      groupShareVisibleSql(ACTOR_ID, GROUP_ID, mealShares)
    ).sql;
    expect(flat(where)).toContain(flat(rule));
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('does not advance lastReadAt when enrichment fails', async () => {
    vi.mocked(reactionsForShares).mockRejectedValueOnce(
      new Error('reaction read failed')
    );
    const db = queuedDb([meal(3, new Date('2026-07-13T12:00:00.000Z'))]);

    await expect(
      listGroupMealFeed(ACTOR_ID, { groupId: GROUP_ID }, db as never)
    ).rejects.toThrow('reaction read failed');
    expect(db.update).not.toHaveBeenCalled();
  });
});
