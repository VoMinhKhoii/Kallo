import { beforeEach, describe, expect, it, vi } from 'vitest';

// ---------------------------------------------------------------------------
// Mocks — the thread read runs entirely on the `db` singleton (owner role).
// The REAL schema, the REAL share-lookup and the REAL canViewShare gate are
// used, so the authorization this action leans on is the one under test, not a
// stand-in. The gate renders through `db.execute`; the row projection through
// `db.select`.
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

/** The visibility gate: `db.execute` answering one `{ visible }` row. Nothing
 * is read until it says yes, so every row-returning case has to set it. */
function gate(visible: boolean, capture?: { statements: unknown[] }) {
  mockDbExecute.mockImplementation((statement: unknown) => {
    capture?.statements.push(statement);
    return Promise.resolve([{ visible }]);
  });
}

/** The share lookup's row read: select().from().innerJoin().innerJoin()
 * .where().limit(). */
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
    gate(true);
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
    // The gate refuses, and the action must translate that to "gone", not to
    // an error — and the meal must never be read in the first place.
    gate(false);
    shareQuery([sharedMealRow(new Date('2026-05-03T08:00:00Z'))]);

    await expect(getSharedMealEntry(ACTOR, SHARE_ID)).resolves.toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
  });

  it('returns null for an id that matches no share', async () => {
    gate(true);
    shareQuery([]);

    await expect(
      getSharedMealEntry(ACTOR, '00000000-0000-4000-8000-000000000000')
    ).resolves.toBeNull();
  });

  it('asks the one gate about this actor and this share', async () => {
    const capture = { statements: [] as unknown[] };
    gate(true, capture);
    shareQuery([]);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    const asked = compile(capture.statements.at(-1));
    expect(asked.params).toContain(SHARE_ID);
    expect(asked.params).toContain(ACTOR);
    // The gate's own predicates, not a copy of them here: a shared group only
    // admits when it is a NAMED group, so the direct-chat member rows that
    // removeFriend / blockFriend leave behind grant nothing.
    expect(asked.sql).toContain('"chat_groups"."kind"');
  });

  it('scopes the row read to this share, non-private only', async () => {
    const capture = { wheres: [] as unknown[] };
    gate(true);
    shareQuery([], capture);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    const outer = compile(capture.wheres.at(-1));
    expect(outer.params).toContain(SHARE_ID);
    expect(outer.sql).toContain("<> 'private'");
  });

  it('treats a malformed share id as gone, without touching the database', async () => {
    gate(true);
    shareQuery([]);

    await expect(getSharedMealEntry(ACTOR, 'not-a-uuid')).resolves.toBeNull();
    expect(mockDbSelect).not.toHaveBeenCalled();
    expect(mockDbExecute).not.toHaveBeenCalled();
  });

  it('never advances a read marker — one post is not the whole feed', async () => {
    gate(true);
    shareQuery([sharedMealRow(new Date('2026-05-03T08:00:00Z'))]);

    await getSharedMealEntry(ACTOR, SHARE_ID);

    expect(mockDbInsert).not.toHaveBeenCalled();
    expect(mockDbUpdate).not.toHaveBeenCalled();
  });
});
