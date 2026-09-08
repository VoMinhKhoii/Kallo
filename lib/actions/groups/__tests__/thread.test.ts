import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the thread read runs entirely on the `db` singleton (owner role).
// The REAL schema, the REAL share-lookup and the REAL `shareAccessSql`
// predicate are used, so the authorization this action leans on is the one
// under test, not a stand-in. Admission and row projection are ONE `db.select`
// statement: what the gate refuses simply does not come back.
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbExecute, mockDbInsert, mockDbUpdate } = vi.hoisted(
  () => ({
    mockDbSelect: vi.fn(),
    mockDbExecute: vi.fn(),
    mockDbInsert: vi.fn(),
    mockDbUpdate: vi.fn(),
  })
);

vi.mock('@/lib/infra/db/client', () => ({
  db: {
    select: mockDbSelect,
    execute: mockDbExecute,
    insert: mockDbInsert,
    update: mockDbUpdate,
  },
}));

vi.mock('@/lib/domain/social/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 2, mine: true }]))
  ),
}));
vi.mock('@/lib/domain/social/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

import { PgDialect } from 'drizzle-orm/pg-core';
import { getSharedMealEntry } from '@/lib/actions/groups/thread';
import { ACTOR, INVITER } from './circle-doubles';

const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';

/** The share lookup's one statement: select().from().innerJoin().innerJoin()
 * .where().limit(). Its WHERE carries the visibility predicate, so a refusal
 * is arranged the way Postgres expresses one — no rows. */
function shareQuery(rows: unknown[], capture?: { wheres: unknown[] }) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
  };
  query.from.mockReturnValue(query);
  query.innerJoin.mockReturnValue(query);
  query.where.mockImplementation((arg: unknown) => {
    capture?.wheres.push(arg);
    return query;
  });
  mockDbSelect.mockReturnValue(query);
  return query;
}

function sharedMealRow(sharedAt: Date) {
  return {
    friendUserId: INVITER,
    mealId: 'meal-1',
    shareId: SHARE_ID,
    rawInput: 'bún chả',
    caloriesKcal: 640,
    proteinG: 30,
    carbohydrateG: 70,
    fatG: 20,
    portionFactor: 1,
    sharedAt,
    loggedAt: sharedAt,
    sharedAtText: sharedAt.toISOString(),
    handle: 'phofan',
    displayName: 'Phở Fan',
    avatarSeed: 'phofan',
    avatarUrl: null,
    avatarPath: null,
  };
}

/** Compile a captured predicate to real SQL + params — the predicate object
 * itself is a cyclic drizzle graph, and what matters is what Postgres sees. */
function compile(predicate: unknown) {
  return new PgDialect().sqlToQuery(predicate as never);
}

describe('getSharedMealEntry', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the visible share in the feed entry shape, enriched', async () => {
    const sharedAt = new Date('2026-05-03T08:00:00Z');
    shareQuery([sharedMealRow(sharedAt)]);

    const entry = await getSharedMealEntry(ACTOR, SHARE_ID);

    expect(entry).not.toBeNull();
    expect(entry?.meal.shareId).toBe(SHARE_ID);
    expect(entry?.meal.sharedAt).toBe(sharedAt.toISOString());
    expect(entry?.friend.userId).toBe(INVITER);
    expect(entry?.isSelf).toBe(false);
    // The same enrichment the feeds apply — the page must not render a post
    // whose heart is blank while the feed behind it shows two.
    expect(entry?.reactions).toEqual({ count: 2, mine: true });
    expect(entry?.repliesTotal).toBe(0);
  });

  it('returns null when nothing comes back — refused and gone read alike', async () => {
    // A share the actor may not see and a share that never existed are the
    // same empty result, and the action must translate either to "gone"
    // rather than to an error.
    shareQuery([]);

    await expect(getSharedMealEntry(ACTOR, SHARE_ID)).resolves.toBeNull();
    await expect(
      getSharedMealEntry(ACTOR, '00000000-0000-4000-8000-000000000000')
    ).resolves.toBeNull();
  });

  it('asks and reads in one statement, carrying the whole gate', async () => {
    const capture = { wheres: [] as unknown[] };
    shareQuery([], capture);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    // No separate gate round trip: admission cannot go stale between two
    // statements if there is only one.
    expect(mockDbExecute).not.toHaveBeenCalled();
    expect(mockDbSelect).toHaveBeenCalledTimes(1);

    const where = compile(capture.wheres.at(-1));
    expect(where.params).toContain(SHARE_ID);
    expect(where.params).toContain(ACTOR);
    // The shared predicate, not a copy of it here: a shared group only admits
    // when it is a NAMED group, so the direct-chat member rows that
    // removeFriend / blockFriend leave behind grant nothing.
    expect(where.sql).toContain('"chat_groups"."kind"');
    // And the page stays in step with the feeds, which render no private share.
    expect(where.sql).toContain("<> 'private'");
  });

  it('treats a malformed share id as gone, without touching the database', async () => {
    shareQuery([]);

    await expect(getSharedMealEntry(ACTOR, 'not-a-uuid')).resolves.toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it('never advances a read marker — one post is not the whole feed', async () => {
    shareQuery([sharedMealRow(new Date('2026-05-03T08:00:00Z'))]);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
