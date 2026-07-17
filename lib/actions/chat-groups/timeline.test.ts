import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/actions/chat-groups/membership', () => ({
  requireMembership: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/groups/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));

import { listGroupTimeline } from '@/lib/actions/chat-groups/timeline';
import { reactionsForShares } from '@/lib/groups/shares/reactions';

const ACTOR_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11';
const OWNER_ID = 'b1ffcd00-ad1c-4ff9-8c7e-7ccace491b22';
const GROUP_ID = 'c2aade11-be2d-4aa0-8d8f-8ddbdf502c33';
const JOINED_AT = new Date('2026-07-10T00:00:00.000Z');

function queuedDb(...rowSets: unknown[][]) {
  const queue = [...rowSets];
  const select = vi.fn(() => {
    const rows = queue.shift() ?? [];
    const query = {
      from: vi.fn(),
      innerJoin: vi.fn(),
      where: vi.fn(),
      orderBy: vi.fn(),
      limit: vi.fn().mockResolvedValue(rows),
    };
    query.from.mockReturnValue(query);
    query.innerJoin.mockReturnValue(query);
    query.where.mockReturnValue(query);
    query.orderBy.mockReturnValue(query);
    return query;
  });
  const update = vi.fn(() => ({
    set: vi.fn(() => ({ where: vi.fn().mockResolvedValue(undefined) })),
  }));
  return { select, update };
}

function uuid(index: number): string {
  return `00000000-0000-4000-8000-${index.toString(16).padStart(12, '0')}`;
}

function entryId(
  entry: Awaited<ReturnType<typeof listGroupTimeline>>['entries'][number]
): string {
  return entry.type === 'message' ? entry.id : entry.meal.shareId;
}

function message(index: number, createdAt: Date) {
  return {
    id: uuid(index),
    senderId: OWNER_ID,
    body: `message ${index}`,
    createdAt,
    handle: 'owner',
    displayName: 'Owner',
    avatarSeed: 'owner',
  };
}

function meal(index: number, sharedAt: Date, ownerJoinedAt: Date) {
  return {
    friendUserId: OWNER_ID,
    mealId: uuid(index + 100),
    shareId: uuid(index + 200),
    rawInput: `meal ${index}`,
    caloriesKcal: 500,
    proteinG: 30,
    carbohydrateG: 50,
    fatG: 15,
    portionFactor: 1,
    sharedAt,
    handle: 'owner',
    displayName: 'Owner',
    avatarSeed: 'owner',
    ownerJoinedAt,
    visibilitySharedAt: sharedAt,
  };
}

describe('listGroupTimeline', () => {
  beforeEach(() => vi.clearAllMocks());

  it('filters shares from before either the viewer or owner joined', async () => {
    const rows = [
      meal(
        1,
        new Date('2026-07-09T12:00:00.000Z'),
        new Date('2026-07-01T00:00:00.000Z')
      ),
      meal(
        2,
        new Date('2026-07-11T12:00:00.000Z'),
        new Date('2026-07-12T00:00:00.000Z')
      ),
      meal(
        3,
        new Date('2026-07-13T12:00:00.000Z'),
        new Date('2026-07-12T00:00:00.000Z')
      ),
    ];
    const db = queuedDb([{ joinedAt: JOINED_AT }], rows, []);

    const page = await listGroupTimeline(
      ACTOR_ID,
      { groupId: GROUP_ID },
      db as never
    );

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]).toMatchObject({
      type: 'meal',
      meal: { rawInput: 'meal 3' },
    });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('uses the id half across tied meal/message page boundaries', async () => {
    const tiedAt = new Date('2026-07-13T12:00:00.123Z');
    const mealRows = Array.from({ length: 16 }, (_, index) => ({
      ...meal(index * 2 + 1, tiedAt, JOINED_AT),
      shareId: uuid(index * 2 + 1),
    }));
    const messageRows = Array.from({ length: 16 }, (_, index) =>
      message(index * 2 + 2, tiedAt)
    );
    const firstDb = queuedDb([{ joinedAt: JOINED_AT }], mealRows, messageRows);

    const firstPage = await listGroupTimeline(
      ACTOR_ID,
      { groupId: GROUP_ID },
      firstDb as never
    );
    expect(firstPage.entries).toHaveLength(30);
    expect(firstPage.nextCursor).not.toBeNull();

    const firstIds = firstPage.entries.map(entryId);
    const remainingMeals = mealRows.filter(
      (row) => !firstIds.includes(row.shareId)
    );
    const remainingMessages = messageRows.filter(
      (row) => !firstIds.includes(row.id)
    );
    const secondDb = queuedDb(
      [{ joinedAt: JOINED_AT }],
      remainingMeals,
      remainingMessages
    );
    const secondPage = await listGroupTimeline(
      ACTOR_ID,
      { groupId: GROUP_ID, before: firstPage.nextCursor ?? undefined },
      secondDb as never
    );
    const allIds = [...firstIds, ...secondPage.entries.map(entryId)];
    const expectedIds = [
      ...mealRows.map((row) => row.shareId),
      ...messageRows.map((row) => row.id),
    ];

    expect(allIds).toHaveLength(32);
    expect(new Set(allIds).size).toBe(32);
    expect(allIds.sort()).toEqual(expectedIds.sort());
    expect(secondPage.nextCursor).toBeNull();
    expect(secondDb.update).not.toHaveBeenCalled();
  });

  it('does not advance lastReadAt when enrichment fails', async () => {
    vi.mocked(reactionsForShares).mockRejectedValueOnce(
      new Error('reaction read failed')
    );
    const db = queuedDb(
      [{ joinedAt: JOINED_AT }],
      [
        meal(
          3,
          new Date('2026-07-13T12:00:00.000Z'),
          new Date('2026-07-12T00:00:00.000Z')
        ),
      ],
      []
    );

    await expect(
      listGroupTimeline(ACTOR_ID, { groupId: GROUP_ID }, db as never)
    ).rejects.toThrow('reaction read failed');
    expect(db.update).not.toHaveBeenCalled();
  });
});
