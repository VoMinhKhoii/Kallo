import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the thread read runs entirely on the `db` singleton (owner role).
// The REAL schema and the REAL share-lookup query are used, so the visibility
// predicate this action leans on is the one under test, not a stand-in.
// ---------------------------------------------------------------------------

const { mockDbSelect, mockDbInsert, mockDbUpdate } = vi.hoisted(() => ({
  mockDbSelect: vi.fn(),
  mockDbInsert: vi.fn(),
  mockDbUpdate: vi.fn(),
}));

vi.mock('@/lib/infra/db/client', () => ({
  db: { select: mockDbSelect, insert: mockDbInsert, update: mockDbUpdate },
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

import { sql } from 'drizzle-orm';
import { PgDialect } from 'drizzle-orm/pg-core';
import { getSharedMealEntry } from '@/lib/actions/groups/thread';
import { ACTOR, INVITER } from './circle-doubles';

const SHARE_ID = '3f1d2c4b-5a6e-4f70-8b91-0c2d3e4f5a6b';

/** The share lookup: select().from().innerJoin().innerJoin().where().limit().
 * `where` is captured on every call — the last one is the outer query's, the
 * earlier ones belong to the EXISTS subqueries. */
function shareQuery(rows: unknown[], capture?: { wheres: unknown[] }) {
  const query = {
    from: vi.fn(),
    innerJoin: vi.fn(),
    where: vi.fn(),
    limit: vi.fn().mockResolvedValue(rows),
    // The EXISTS subqueries are embedded in the outer predicate, so the double
    // has to be compilable — otherwise the predicate can't be inspected below.
    getSQL: () => sql`select 1 from subquery`,
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

  it('returns null when the share is not the actor to see', async () => {
    // The visibility predicate is in SQL: an unauthorized share simply does not
    // come back, and the action must translate that to "gone", not to an error.
    shareQuery([]);

    await expect(getSharedMealEntry(ACTOR, SHARE_ID)).resolves.toBeNull();
  });

  it('returns null for an id that matches no share', async () => {
    shareQuery([]);

    await expect(
      getSharedMealEntry(ACTOR, '00000000-0000-4000-8000-000000000000')
    ).resolves.toBeNull();
  });

  it('scopes the read to this actor and this share, non-private only', async () => {
    const capture = { wheres: [] as unknown[] };
    shareQuery([], capture);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    const outer = compile(capture.wheres.at(-1));
    expect(outer.params).toContain(SHARE_ID);
    expect(outer.params).toContain(ACTOR);
    expect(outer.sql).toContain("<> 'private'");
    // Both admission routes are in the same predicate: the friendship edge and
    // the shared-group membership, each as an EXISTS beside the owner check.
    expect(outer.sql.match(/exists/gi)?.length).toBe(2);
  });

  it('rejects a malformed share id before touching the database', async () => {
    shareQuery([]);

    await expect(getSharedMealEntry(ACTOR, 'not-a-uuid')).rejects.toThrow();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('never advances a read marker — one post is not the whole feed', async () => {
    shareQuery([sharedMealRow(new Date('2026-05-03T08:00:00Z'))]);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
