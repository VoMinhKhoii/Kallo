import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/lib/db', () => ({ db: {} }));
vi.mock('@/lib/actions/chat-groups/membership', () => ({
  requireGroupAccess: vi.fn().mockResolvedValue({
    kind: 'group',
    role: 'member',
    joinedAt: new Date('2026-07-10T00:00:00.000Z'),
    directUserLow: null,
    directUserHigh: null,
  }),
}));
vi.mock('@/lib/groups/shares/reactions', () => ({
  reactionsForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { count: 0, mine: false }]))
  ),
}));
vi.mock('@/lib/groups/shares/replies', () => ({
  repliesForShares: vi.fn(
    async (_actorId: string, shareIds: string[]) =>
      new Map(shareIds.map((id) => [id, { replies: [], total: 0 }]))
  ),
}));

import { listGroupMealFeed } from '@/lib/actions/chat-groups/feed';
import { reactionsForShares } from '@/lib/groups/shares/reactions';

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
  };
}

function meal(index: number, sharedAt: Date, ownerJoinedAt: Date) {
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
    ownerJoinedAt,
    visibilitySharedAt: sharedAt,
  };
}

describe('listGroupMealFeed', () => {
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
    const db = queuedDb(rows);

    const page = await listGroupMealFeed(
      ACTOR_ID,
      { groupId: GROUP_ID },
      db as never
    );

    expect(page.entries).toHaveLength(1);
    expect(page.entries[0]).toMatchObject({ meal: { rawInput: 'meal 3' } });
    expect(db.update).toHaveBeenCalledTimes(1);
  });

  it('does not advance lastReadAt when enrichment fails', async () => {
    vi.mocked(reactionsForShares).mockRejectedValueOnce(
      new Error('reaction read failed')
    );
    const db = queuedDb([
      meal(
        3,
        new Date('2026-07-13T12:00:00.000Z'),
        new Date('2026-07-12T00:00:00.000Z')
      ),
    ]);

    await expect(
      listGroupMealFeed(ACTOR_ID, { groupId: GROUP_ID }, db as never)
    ).rejects.toThrow('reaction read failed');
    expect(db.update).not.toHaveBeenCalled();
  });
});
